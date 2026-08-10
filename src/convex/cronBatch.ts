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
 */
export async function runCronBatch<T>(
  ctx: MutationCtx,
  cursor: string | null,
  batchSize: number,
  fetchPage: PageFetcher<T>,
  processItem: ItemProcessor<T>,
  scheduleNext: NextScheduler,
  label: string
): Promise<CronBatchResult> {
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
  }

  return { processed, failures, isDone: page.isDone, scheduledNext };
}
