import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";

// ============================================================
// Batched Cron Core (Phase 5 scale hardening)
//
// Every all-user/all-record cron in FarmBond follows the same shape:
//
//   1. The cron entry point is an internalMutation taking { cursor }.
//   2. It processes ONE bounded batch (CRON_BATCH_SIZE records).
//   3. When more records remain, it schedules the next batch with
//      ctx.scheduler.runAfter(0, ...) passing the pagination cursor.
//
// This keeps each individual mutation bounded in reads, writes, and
// execution time while still covering the whole dataset over the chain.
// Cursors are only ever used with the exact same query shape they were
// generated from, which is the Convex contract for pagination cursors.
// ============================================================

/** Max records processed per scheduled batch. */
export const CRON_BATCH_SIZE = 200;

/** Shared args schema for all batched cron entry points. */
export const cronBatchArgs = {
  cursor: v.union(v.string(), v.null()),
};

export interface CronBatchResult {
  processed: number;
  failures: number;
  isDone: boolean;
  scheduledNext: boolean;
}

export interface CronPage<T> {
  page: T[];
  continueCursor: string;
  isDone: boolean;
}

export type PageFetcher<T> = (
  ctx: MutationCtx,
  cursor: string | null,
  batchSize: number
) => Promise<CronPage<T>>;

export type ItemProcessor<T> = (ctx: MutationCtx, item: T) => Promise<void>;

export type NextScheduler = (ctx: MutationCtx, cursor: string) => Promise<unknown>;

// ============================================================
// Cron-run lease (overlap protection)
//
// A batched cron whose chain could outlive its own interval (e.g. the
// 30-minute weather-alert job at 200k users) must never run two chains
// at once. The cron entry fires with `{ cursor: null }`; it claims a
// lease row first. A live lease means another chain is already covering
// the dataset, so the fire exits immediately. Continuation batches
// (cursor !== null) never re-claim. The chain releases the lease when
// it finishes (isDone or all-failed stop). Lease expiry via TTL
// guarantees a crashed/interrupted chain can never deadlock the job.
//
// Correctness NEVER depends on the lease: every cron is idempotent, so
// a racing double-chain is merely wasteful, never harmful. The claim is
// best-effort (Convex has no unique constraints); two fires within the
// same instant can both pass, which is safe for the same reason.
// ============================================================

export interface CronLease {
  jobName: string;
  ttlMs: number;
}

/**
 * Claim the lease for `jobName`. Returns true when the caller may start
 * a chain; false when a live lease already exists. Expired leases are
 * reclaimed atomically-ish (delete-or-patch the single row).
 */
export async function acquireCronLease(
  ctx: MutationCtx,
  jobName: string,
  ttlMs: number
): Promise<boolean> {
  const now = Date.now();
  const existing = await ctx.db
    .query("cronRuns")
    .withIndex("by_job", (q) => q.eq("jobName", jobName))
    .first();

  if (existing) {
    if (existing.leaseExpiresAt > now) return false; // another chain is live
    await ctx.db.patch(existing._id, { startedAt: now, leaseExpiresAt: now + ttlMs });
    return true;
  }

  await ctx.db.insert("cronRuns", { jobName, startedAt: now, leaseExpiresAt: now + ttlMs });
  return true;
}

/**
 * Extend the lease for `jobName` (continuation batches only). Long chains
 * refresh on every batch so the lease never expires mid-run; a crashed
 * chain stops refreshing and self-heals once the TTL lapses.
 */
export async function refreshCronLease(
  ctx: MutationCtx,
  jobName: string,
  ttlMs: number
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("cronRuns")
    .withIndex("by_job", (q) => q.eq("jobName", jobName))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, { startedAt: now, leaseExpiresAt: now + ttlMs });
  } else {
    await ctx.db.insert("cronRuns", { jobName, startedAt: now, leaseExpiresAt: now + ttlMs });
  }
}

/** Release every lease row for `jobName` (handles racing double-claims). */
export async function releaseCronLease(
  ctx: MutationCtx,
  jobName: string
): Promise<void> {
  const rows = await ctx.db
    .query("cronRuns")
    .withIndex("by_job", (q) => q.eq("jobName", jobName))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

// ============================================================
// Page fetchers — every chained call MUST rebuild the exact same query
// shape (table + index + order) so pagination cursors stay valid.
// ============================================================

/** Page the users table in ascending _id order. */
export function pageUsers(
  ctx: MutationCtx,
  cursor: string | null,
  batchSize: number
) {
  return ctx.db.query("users").order("asc").paginate({ numItems: batchSize, cursor });
}

/** Page the livestock table in ascending _id order. */
export function pageLivestock(
  ctx: MutationCtx,
  cursor: string | null,
  batchSize: number
) {
  return ctx.db.query("livestock").order("asc").paginate({ numItems: batchSize, cursor });
}

/** Page the farms table in ascending _id order. */
export function pageFarms(
  ctx: MutationCtx,
  cursor: string | null,
  batchSize: number
) {
  return ctx.db.query("farms").order("asc").paginate({ numItems: batchSize, cursor });
}

/** Page the weather-alert configs table in ascending _id order. */
export function pageWeatherAlertConfigs(
  ctx: MutationCtx,
  cursor: string | null,
  batchSize: number
) {
  return ctx.db
    .query("weatherAlertConfigs")
    .order("asc")
    .paginate({ numItems: batchSize, cursor });
}

/**
 * Run one bounded batch of a cron job and schedule the next batch when
 * more records remain.
 *
 * Failure isolation: each item runs in its own try/catch so one bad
 * record never aborts the rest of the batch — failures are logged and
 * counted, and the chain continues when at least one item succeeded.
 *
 * Runaway guard: if EVERY item in the batch failed (e.g. a systemic
 * error), the chain stops so we never recursively process the whole
 * table pointlessly; the cron's next scheduled fire retries from the
 * top. This avoids an uncontrolled scheduling explosion.
 *
 * Lease (overlap protection): when `lease` is provided, the chain-start
 * invocation (cursor === null) claims the job lease first and exits
 * immediately when another chain is live. When the chain ends (isDone
 * or the all-failed stop), the lease is released so the next scheduled
 * fire can start a fresh chain.
 */
export async function runCronBatch<T>(
  ctx: MutationCtx,
  cursor: string | null,
  batchSize: number,
  fetchPage: PageFetcher<T>,
  processItem: ItemProcessor<T>,
  scheduleNext: NextScheduler,
  label: string,
  lease?: CronLease
): Promise<CronBatchResult> {
  if (lease && cursor === null) {
    const acquired = await acquireCronLease(ctx, lease.jobName, lease.ttlMs);
    if (!acquired) {
      // Another chain is already covering the dataset — skip this fire.
      return { processed: 0, failures: 0, isDone: true, scheduledNext: false };
    }
  } else if (lease) {
    // Continuation batch — keep the chain's lease alive so a long chain
    // (e.g. weather alerts at 200k configs) never gets a second chain
    // started by the next interval fire while it is still running.
    await refreshCronLease(ctx, lease.jobName, lease.ttlMs);
  }

  const page = await fetchPage(ctx, cursor, batchSize);
  let processed = 0;
  let failures = 0;

  for (const item of page.page) {
    try {
      await processItem(ctx, item);
      processed++;
    } catch (error) {
      failures++;
      console.error(
        `[${label}] item ${(item as { _id?: unknown } | null)?._id ?? "unknown"} failed:`,
        error
      );
    }
  }

  const allFailed = page.page.length > 0 && failures === page.page.length;
  const scheduledNext = !page.isDone && page.page.length > 0 && !allFailed;
  if (scheduledNext) {
    await scheduleNext(ctx, page.continueCursor);
  } else if (lease) {
    // Chain ended (dataset done or stopped) — free the lease so the next
    // interval fire can retry from the top.
    await releaseCronLease(ctx, lease.jobName);
  }

  return { processed, failures, isDone: page.isDone, scheduledNext };
}
