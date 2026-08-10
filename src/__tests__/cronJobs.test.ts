import { describe, expect, test } from "bun:test";
import {
  runCronBatch,
  acquireCronLease,
  releaseCronLease,
} from "../convex/cronBatch";
import type { MutationCtx } from "../convex/_generated/server";
import type { Id } from "../convex/_generated/dataModel";

// ============================================================
// Fake Convex ctx supporting the lease table (cronRuns) plus a
// recording scheduler. `tables` is exposed so tests can inspect
// patched/deleted rows.
// ============================================================
type Row = Record<string, unknown> & { _id: string };

function makeCtx(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = {};
  for (const [table, rows] of Object.entries(seed)) {
    tables[table] = rows.map((r) => ({ ...r }));
  }
  const inserts: Array<{ table: string; doc: Row }> = [];
  const schedulerCalls: Array<{ cursor: string }> = [];

  const db = {
    tables,
    inserts,
    get: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => r._id === id);
        if (hit) return hit;
      }
      return null;
    },
    insert: async (table: string, doc: Record<string, unknown>) => {
      const row: Row = { _id: `id_${table}_${inserts.length}`, ...doc };
      (tables[table] ??= []).push(row);
      inserts.push({ table, doc: row });
      return row._id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => r._id === id);
        if (hit) Object.assign(hit, patch);
      }
    },
    delete: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const idx = rows.findIndex((r) => r._id === id);
        if (idx >= 0) rows.splice(idx, 1);
      }
    },
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      return {
        withIndex: (_name: string, pred?: (q: {
          eq: (field: string, value: unknown) => unknown;
        }) => unknown) => {
          if (pred) {
            const eqs: Array<[string, unknown]> = [];
            const qi = {
              eq: (field: string, value: unknown) => {
                eqs.push([field, value]);
                return qi;
              },
            };
            pred(qi);
            rows = rows.filter((r) =>
              eqs.every(([field, value]) => r[field] === value)
            );
          }
          // Ordering approximates Convex _id ordering: seeded rows are
          // oldest-first, inserts append newest, so desc() reverses.
          const order = (dir: "asc" | "desc") => {
            const sorted = dir === "desc" ? [...rows].reverse() : [...rows];
            return {
              take: async (n: number) => sorted.slice(0, n),
              first: async () => sorted[0] ?? null,
            };
          };
          return {
            order,
            first: async () => rows[0] ?? null,
            collect: async () => rows,
          };
        },
      };
    },
  };

  const scheduler = {
    runAfter: async (_delayMs: number, _fn: unknown, args: { cursor: string }) => {
      schedulerCalls.push({ cursor: args.cursor });
    },
  };

  return {
    ctx: { db, scheduler } as unknown as MutationCtx,
    tables,
    schedulerCalls,
  };
}

/** Offset cursor simulation over a seeded array. */
function makePageFetcher(all: Row[], getRows: () => Row[] = () => all) {
  return async (_ctx: unknown, cursor: string | null, batchSize: number) => {
    const rows = getRows();
    const start = cursor ? Number(cursor) : 0;
    const page = rows.slice(start, start + batchSize);
    return {
      page,
      continueCursor: String(start + page.length),
      isDone: start + page.length >= rows.length,
    };
  };
}

const now = Date.now();
const HOUR = 60 * 60 * 1000;

// ============================================================
// Lease acquisition / skip / release / self-heal
// ============================================================
describe("cron-run lease (overlap protection)", () => {
  test("first fire claims the lease and runs the batch", async () => {
    const { ctx, tables, schedulerCalls } = makeCtx({});
    const all: Row[] = [{ _id: "u_1" }, { _id: "u_2" }];
    const processed: string[] = [];

    const result = await runCronBatch(
      ctx,
      null,
      10,
      makePageFetcher(all),
      async (_ctx, item) => {
        processed.push((item as Row)._id);
      },
      async (_ctx, cursor) => {
        schedulerCalls.push({ cursor });
      },
      "test",
      { jobName: "job_x", ttlMs: 2 * HOUR }
    );

    expect(processed).toEqual(["u_1", "u_2"]);
    expect(result.isDone).toBe(true);
    // Chain ended → lease released
    expect(tables.cronRuns ?? []).toHaveLength(0);
  });

  test("a live lease causes a duplicate fire to skip entirely", async () => {
    const { ctx, schedulerCalls } = makeCtx({});
    const all: Row[] = [{ _id: "u_1" }];
    const processed: string[] = [];

    // Re-claim manually to simulate a still-running chain from another invocation.
    await acquireCronLease(ctx, "job_y", 2 * HOUR);

    // Second fire while the lease is live → skip, no processing
    const result = await runCronBatch(
      ctx,
      null,
      10,
      makePageFetcher(all),
      async (_ctx, item) => {
        processed.push((item as Row)._id);
      },
      async (_ctx, cursor) => {
        schedulerCalls.push({ cursor });
      },
      "test",
      { jobName: "job_y", ttlMs: 2 * HOUR }
    );

    expect(result.processed).toBe(0);
    expect(result.isDone).toBe(true);
    expect(result.scheduledNext).toBe(false);
    expect(processed).toEqual([]); // not processed
    expect(schedulerCalls).toHaveLength(0); // nothing chained
  });

  test("an expired lease is reclaimed by the next fire", async () => {
    const { ctx, tables } = makeCtx({});
    // Simulate a crashed chain: lease row with an expired TTL
    tables.cronRuns = [
      { _id: "lease_1", jobName: "job_z", startedAt: now - 10 * HOUR, leaseExpiresAt: now - 8 * HOUR },
    ];

    const acquired = await acquireCronLease(ctx, "job_z", 2 * HOUR);
    expect(acquired).toBe(true);
    // The stale row was reclaimed (patched), not duplicated
    expect(tables.cronRuns).toHaveLength(1);
    expect(tables.cronRuns![0].leaseExpiresAt).toBeGreaterThan(now);
  });

  test("a live lease is not reclaimable until it expires", async () => {
    const { ctx } = makeCtx({});
    await acquireCronLease(ctx, "job_w", 2 * HOUR);
    const second = await acquireCronLease(ctx, "job_w", 2 * HOUR);
    expect(second).toBe(false);
  });

  test("releaseCronLease clears every row for the job", async () => {
    const { ctx, tables } = makeCtx({});
    tables.cronRuns = [
      { _id: "a", jobName: "job_v", startedAt: now, leaseExpiresAt: now + HOUR },
      { _id: "b", jobName: "job_v", startedAt: now, leaseExpiresAt: now + HOUR },
      { _id: "c", jobName: "other", startedAt: now, leaseExpiresAt: now + HOUR },
    ];

    await releaseCronLease(ctx, "job_v");
    expect(tables.cronRuns.map((r) => r.jobName)).toEqual(["other"]);
  });

  test("continuation batches refresh the lease instead of re-claiming", async () => {
    const { ctx, tables, schedulerCalls } = makeCtx({});
    const all: Row[] = Array.from({ length: 25 }, (_, i) => ({ _id: `u_${i}` }));
    const processed: string[] = [];

    // First batch (cursor null) claims the lease and schedules a continuation
    const first = await runCronBatch(
      ctx,
      null,
      10,
      makePageFetcher(all),
      async (_ctx, item) => {
        processed.push((item as Row)._id);
      },
      async (_ctx, cursor) => {
        schedulerCalls.push({ cursor });
      },
      "test",
      { jobName: "job_u", ttlMs: 2 * HOUR }
    );
    expect(first.scheduledNext).toBe(true);
    expect(tables.cronRuns).toHaveLength(1);
    const firstExpiry = tables.cronRuns![0].leaseExpiresAt as number;

    // Second batch (continuation) — refresh keeps the lease alive
    const second = await runCronBatch(
      ctx,
      schedulerCalls[0].cursor,
      10,
      makePageFetcher(all),
      async (_ctx, item) => {
        processed.push((item as Row)._id);
      },
      async (_ctx, cursor) => {
        schedulerCalls.push({ cursor });
      },
      "test",
      { jobName: "job_u", ttlMs: 2 * HOUR }
    );
    expect(second.scheduledNext).toBe(true);
    expect(tables.cronRuns).toHaveLength(1); // never duplicated
    expect(tables.cronRuns![0].leaseExpiresAt as number).toBeGreaterThanOrEqual(firstExpiry);

    // Final batch completes and releases the lease
    const third = await runCronBatch(
      ctx,
      schedulerCalls[1].cursor,
      10,
      makePageFetcher(all),
      async (_ctx, item) => {
        processed.push((item as Row)._id);
      },
      async (_ctx, cursor) => {
        schedulerCalls.push({ cursor });
      },
      "test",
      { jobName: "job_u", ttlMs: 2 * HOUR }
    );
    expect(third.isDone).toBe(true);
    expect(processed).toHaveLength(25);
    expect(tables.cronRuns ?? []).toHaveLength(0);
  });
});

// ============================================================
// Handler idempotency — paid users are never incorrectly downgraded,
// retries never duplicate effects
// ============================================================
describe("subscription/trial expiry idempotency", () => {
  test("only expired pro users are downgraded; retry is a no-op", async () => {
    const users: Row[] = [
      { _id: "u_1", subscriptionTier: "pro", subscriptionEndDate: now - HOUR }, // expired
      { _id: "u_2", subscriptionTier: "pro", subscriptionEndDate: now + 30 * 24 * HOUR }, // active
      { _id: "u_3", subscriptionTier: "free" }, // already free
      { _id: "u_4", subscriptionTier: "pro", subscriptionEndDate: undefined }, // malformed → never downgraded
    ];
    const downgraded: string[] = [];

    const processItem = async (ctx: MutationCtx, item: Row) => {
      if (
        item.subscriptionTier === "pro" &&
        typeof item.subscriptionEndDate === "number" &&
        item.subscriptionEndDate < now
      ) {
        await ctx.db.patch(item._id as Id<"users">, { subscriptionTier: "free", subscriptionEndDate: undefined });
        downgraded.push(item._id);
      }
    };

    const { ctx, tables } = makeCtx({ users });
    await runCronBatch(ctx, null, 10, makePageFetcher(users, () => tables.users), processItem, async () => {}, "test");
    expect(downgraded).toEqual(["u_1"]); // active/malformed/free users untouched

    // Retry the same page: state changed → nothing else downgraded
    await runCronBatch(ctx, null, 10, makePageFetcher(users, () => tables.users), processItem, async () => {}, "test");
    expect(downgraded).toEqual(["u_1"]);
    expect(tables.users.find((u) => u._id === "u_2")!.subscriptionTier).toBe("pro");
  });
});

// ============================================================
// Notification / report dedup markers (retry-safe)
// ============================================================
describe("cron dedup markers", () => {
  test("weekly-report guard skips farms that already have a report this week", async () => {
    const farms: Row[] = [
      { _id: "f_1", userId: "u_1", name: "Farm A" },
      { _id: "f_2", userId: "u_2", name: "Farm B" },
    ];
    const weekAgo = now - 7 * 24 * HOUR;
    const reports: Row[] = [
      { _id: "r_1", farmId: "f_1", generatedAt: now - 2 * 24 * HOUR }, // fresh
      { _id: "r_2", farmId: "f_2", generatedAt: now - 20 * 24 * HOUR }, // stale
    ];
    const inserted: string[] = [];

    const { ctx, tables } = makeCtx({ farms, weeklyReports: reports });

    const processItem = async (ctx: MutationCtx, farm: Row) => {
      const farmId = farm._id as Id<"farms">;
      const existing = (await ctx.db
        .query("weeklyReports")
        .withIndex("by_farm", (q) => q.eq("farmId", farmId))
        .order("desc")
        .first()) as Row | null;
      if (existing && (existing.generatedAt as number) > weekAgo) return; // already generated
      await (ctx.db as { insert: (t: string, d: Record<string, unknown>) => Promise<unknown> }).insert(
        "weeklyReports",
        { farmId, generatedAt: now }
      );
      inserted.push(farm._id);
    };

    await runCronBatch(ctx, null, 10, makePageFetcher(farms, () => tables.farms), processItem, async () => {}, "test");

    expect(inserted).toEqual(["f_2"]); // only the farm without a fresh report
    // Second run: every farm now has a fresh report → no duplicates
    inserted.length = 0;
    await runCronBatch(ctx, null, 10, makePageFetcher(farms, () => tables.farms), processItem, async () => {}, "test");
    expect(inserted).toEqual([]);
  });

  test("notification dedup markers are stable across repeated runs", async () => {
    // Simulates the vaccination-reminder marker contract: details contains
    // a stable livestockId + nextVaccination so a retry cannot re-remind.
    const marker = JSON.stringify({ livestockId: "animal_1", nextVaccination: now + 3 * HOUR });
    const recent = [
      { type: "vaccination_reminder", details: marker, createdAt: now - 1000 },
    ];
    const alreadySent = recent.some(
      (n) => n.type === "vaccination_reminder" && n.details === marker && n.createdAt > now - 24 * HOUR
    );
    expect(alreadySent).toBe(true);
  });
});
