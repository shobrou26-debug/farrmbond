import { describe, expect, test } from "bun:test";
import { runCronBatch } from "../convex/cronBatch";
import {
  hasRecentVaccinationReminder,
  hasRecentLowCoverageAlert,
} from "../convex/livestock";
import type { MutationCtx } from "../convex/_generated/server";
import type { Id } from "../convex/_generated/dataModel";

// ============================================================
// Fake Convex ctx: a minimal db (get/insert/patch/query) plus a
// scheduler that records runAfter calls so we can assert chaining.
// ============================================================
type Row = Record<string, unknown> & { _id: string };

function makeCtx(
  seed: Record<string, Row[]>,
  schedulerCalls: Array<{ cursor: string }> = []
) {
  const tables: Record<string, Row[]> = {};
  for (const [table, rows] of Object.entries(seed)) {
    tables[table] = rows.map((r) => ({ ...r }));
  }
  const inserts: Array<{ table: string; doc: Row }> = [];

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
          return {
            order: (_dir: "asc" | "desc") => ({
              take: async (n: number) => rows.slice(0, n),
            }),
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

  // The fake ctx is structurally a MutationCtx from runCronBatch's point of
  // view; `tables` is returned alongside so tests can re-read patched rows.
  return { ctx: { db, scheduler } as unknown as MutationCtx, tables };
}

/** Simple offset cursor simulation over a seeded array. */
function makePageFetcher(
  all: Row[],
  getRows: () => Row[] = () => all
) {
  return async (
    _ctx: unknown,
    cursor: string | null,
    batchSize: number
  ) => {
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
// 1. First batch processes only the configured maximum
// ============================================================
describe("runCronBatch — bounded batches", () => {
  test("processes only CRON_BATCH_SIZE items in the first batch", async () => {
    const all: Row[] = Array.from({ length: 500 }, (_, i) => ({
      _id: `u_${i}`,
      email: `u${i}@x.com`,
    }));
    const processed: string[] = [];
    const schedulerCalls: Array<{ cursor: string }> = [];

    const { ctx } = makeCtx({}, schedulerCalls);
    const result = await runCronBatch(
      ctx,
      null,
      200,
      makePageFetcher(all),
      async (_ctx, item) => {
        processed.push((item as Row)._id);
      },
      async (_ctx, cursor) => {
        schedulerCalls.push({ cursor });
      },
      "test"
    );

    expect(processed.length).toBe(200);
    expect(result.processed).toBe(200);
    expect(result.isDone).toBe(false);
    // Exactly one next-batch was scheduled with the continuation cursor
    expect(schedulerCalls.length).toBe(1);
    expect(schedulerCalls[0].cursor).toBe("200");
  });

  // ============================================================
  // 2. A second batch can continue from the cursor
  // ============================================================
  test("a second batch continues from the cursor returned by the first", async () => {
    const all: Row[] = Array.from({ length: 450 }, (_, i) => ({
      _id: `u_${i}`,
      email: `u${i}@x.com`,
    }));
    const processed: string[] = [];
    const schedulerCalls: Array<{ cursor: string }> = [];

    const { ctx } = makeCtx({}, schedulerCalls);

    const first = await runCronBatch(
      ctx,
      null,
      200,
      makePageFetcher(all),
      async (_ctx, item) => {
        processed.push((item as Row)._id);
      },
      async (_ctx, cursor) => {
        schedulerCalls.push({ cursor });
      },
      "test"
    );
    expect(first.scheduledNext).toBe(true);
    const cursor = schedulerCalls[0].cursor;

    // Second batch starts at the recorded cursor
    const second = await runCronBatch(
      ctx,
      cursor,
      200,
      makePageFetcher(all),
      async (_ctx, item) => {
        processed.push((item as Row)._id);
      },
      async (_ctx, next) => {
        schedulerCalls.push({ cursor: next });
      },
      "test"
    );

    expect(processed[0]).toBe("u_0");
    expect(processed[199]).toBe("u_199");
    expect(processed[200]).toBe("u_200"); // no gap, no overlap
    expect(second.processed).toBe(200);
    expect(schedulerCalls.length).toBe(2);
  });

  // ============================================================
  // 3. Processing eventually reaches the end of the dataset
  // ============================================================
  test("chained batches eventually reach the end of the dataset", async () => {
    const all: Row[] = Array.from({ length: 550 }, (_, i) => ({
      _id: `u_${i}`,
      email: `u${i}@x.com`,
    }));
    const processed: string[] = [];

    const { ctx } = makeCtx({});
    let cursor: string | null = null;
    let guard = 0;
    let result;
    do {
      result = await runCronBatch(
        ctx,
        cursor,
        200,
        makePageFetcher(all),
        async (_ctx, item) => {
          processed.push((item as Row)._id);
        },
        async (_ctx, next) => {
          cursor = next;
        },
        "test"
      );
      guard++;
    } while (!result.isDone && guard < 10);

    expect(result!.isDone).toBe(true);
    expect(processed.length).toBe(550); // every record processed exactly once
    expect(new Set(processed).size).toBe(550); // no duplicates
  });

  // ============================================================
  // 4. Empty dataset completes cleanly
  // ============================================================
  test("an empty dataset completes cleanly without scheduling", async () => {
    const schedulerCalls: Array<{ cursor: string }> = [];
    const { ctx } = makeCtx({}, schedulerCalls);

    const result = await runCronBatch(
      ctx,
      null,
      200,
      makePageFetcher([]),
      async () => {},
      async (_ctx, cursor) => {
        schedulerCalls.push({ cursor });
      },
      "test"
    );

    expect(result.processed).toBe(0);
    expect(result.failures).toBe(0);
    expect(result.isDone).toBe(true);
    expect(result.scheduledNext).toBe(false);
    expect(schedulerCalls.length).toBe(0);
  });

  // ============================================================
  // 5. Retry does not duplicate effects
  // ============================================================
  test("retrying a batch does not duplicate effects (state-based idempotency)", async () => {
    // Simulate the expireTrials pattern: patch tier to "free" and only
    // act when the user still matches the expired condition. The runner
    // itself is stateless — idempotency comes from the per-item guard.
    const all: Row[] = [
      { _id: "u_1", email: "a@x.com", subscriptionTier: "pro", trialEndDate: now - HOUR },
      { _id: "u_2", email: "b@x.com", subscriptionTier: "free", trialEndDate: now - HOUR },
    ];
    let patched = 0;

    const processItem = async (ctx: MutationCtx, item: Row) => {
      const trialEnd = item.trialEndDate as number | undefined;
      if (
        trialEnd !== undefined &&
        trialEnd < now &&
        item.subscriptionTier === "pro"
      ) {
        await ctx.db.patch(item._id as Id<"users">, { subscriptionTier: "free" });
        patched++;
      }
    };

    const { ctx, tables } = makeCtx({ users: all });
    const first = await runCronBatch(
      ctx,
      null,
      200,
      makePageFetcher(all, () => tables.users),
      processItem,
      async () => {},
      "test"
    );
    expect(first.processed).toBe(2);
    expect(patched).toBe(1); // only the expired pro user was downgraded

    // Retry: the same page again — nothing matches anymore
    const second = await runCronBatch(
      ctx,
      null,
      200,
      makePageFetcher(all, () => tables.users),
      processItem,
      async () => {},
      "test"
    );
    expect(second.processed).toBe(2);
    expect(patched).toBe(1); // no duplicate downgrade
  });

  // ============================================================
  // 6. One bad record does not incorrectly abort the safe batch
  // ============================================================
  test("a single failing record does not abort the rest of the batch", async () => {
    const all: Row[] = Array.from({ length: 5 }, (_, i) => ({
      _id: `u_${i}`,
      email: `u${i}@x.com`,
    }));
    const processed: string[] = [];

    const { ctx } = makeCtx({});
    const result = await runCronBatch(
      ctx,
      null,
      200,
      makePageFetcher(all),
      async (_ctx, item) => {
        const id = (item as Row)._id;
        if (id === "u_2") {
          throw new Error("boom"); // one bad record
        }
        processed.push(id);
      },
      async () => {},
      "test"
    );

    expect(result.processed).toBe(4); // the other four still processed
    expect(result.failures).toBe(1);
    expect(processed).toEqual(["u_0", "u_1", "u_3", "u_4"]);
  });

  test("a batch where every record fails stops the chain (no runaway)", async () => {
    const all: Row[] = Array.from({ length: 500 }, (_, i) => ({
      _id: `u_${i}`,
      email: `u${i}@x.com`,
    }));
    const schedulerCalls: Array<{ cursor: string }> = [];
    const { ctx } = makeCtx({}, schedulerCalls);

    const result = await runCronBatch(
      ctx,
      null,
      200,
      makePageFetcher(all),
      async () => {
        throw new Error("systemic");
      },
      async (_ctx, cursor) => {
        schedulerCalls.push({ cursor });
      },
      "test"
    );

    expect(result.failures).toBe(200);
    expect(result.processed).toBe(0);
    expect(result.scheduledNext).toBe(false); // chain stops
    expect(schedulerCalls.length).toBe(0);
  });

  // ============================================================
  // 7. Work stays serial — no unbounded parallel execution
  // ============================================================
  test("items are processed serially, never with an unbounded Promise.all", async () => {
    const all: Row[] = Array.from({ length: 10 }, (_, i) => ({
      _id: `u_${i}`,
      email: `u${i}@x.com`,
    }));
    let concurrent = 0;
    let maxConcurrent = 0;

    const { ctx } = makeCtx({});
    await runCronBatch(
      ctx,
      null,
      200,
      makePageFetcher(all),
      async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 1));
        concurrent--;
      },
      async () => {},
      "test"
    );

    expect(maxConcurrent).toBe(1); // strictly serial within a batch
  });
});

// ============================================================
// Dedup helpers — retry-safe reminders and alerts
// ============================================================
describe("hasRecentVaccinationReminder", () => {
  const recent = [
    {
      type: "vaccination_reminder",
      details: JSON.stringify({ livestockId: "animal_1", nextVaccination: now + 3 * HOUR }),
      createdAt: now - 1000,
    },
  ];

  test("returns true when the same livestock was reminded within the window", () => {
    expect(hasRecentVaccinationReminder(recent, "animal_1", now, 24 * HOUR)).toBe(true);
  });

  test("returns false for a different livestock", () => {
    expect(hasRecentVaccinationReminder(recent, "animal_2", now, 24 * HOUR)).toBe(false);
  });

  test("returns false when the reminder is older than the window", () => {
    const old = [
      {
        type: "vaccination_reminder",
        details: JSON.stringify({ livestockId: "animal_1" }),
        createdAt: now - 48 * HOUR,
      },
    ];
    expect(hasRecentVaccinationReminder(old, "animal_1", now, 24 * HOUR)).toBe(false);
  });

  test("ignores non-vaccination notification types", () => {
    const unrelated = [
      { type: "system", details: JSON.stringify({ livestockId: "animal_1" }), createdAt: now },
    ];
    expect(hasRecentVaccinationReminder(unrelated, "animal_1", now, 24 * HOUR)).toBe(false);
  });

  test("tolerates malformed details without throwing", () => {
    const malformed = [
      { type: "vaccination_reminder", details: "{not json", createdAt: now },
    ];
    expect(hasRecentVaccinationReminder(malformed, "animal_1", now, 24 * HOUR)).toBe(false);
  });
});

describe("hasRecentLowCoverageAlert", () => {
  test("returns true when a low-coverage marker was written within the window", () => {
    const recent = [
      { details: JSON.stringify({ kind: "low_coverage_alert" }), createdAt: now - 1000 },
    ];
    expect(hasRecentLowCoverageAlert(recent, now, 24 * HOUR)).toBe(true);
  });

  test("returns false when the marker is absent", () => {
    const recent = [
      { details: JSON.stringify({ kind: "other" }), createdAt: now - 1000 },
    ];
    expect(hasRecentLowCoverageAlert(recent, now, 24 * HOUR)).toBe(false);
  });

  test("returns false when the alert is older than the window", () => {
    const recent = [
      { details: JSON.stringify({ kind: "low_coverage_alert" }), createdAt: now - 48 * HOUR },
    ];
    expect(hasRecentLowCoverageAlert(recent, now, 24 * HOUR)).toBe(false);
  });
});
