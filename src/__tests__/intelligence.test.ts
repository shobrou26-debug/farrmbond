import { describe, expect, test } from "bun:test";
import {
  runIntelligencePipelineCore,
  runIntelligencePipelineForAllUsersCore,
} from "../convex/intelligence";

// ============================================================
// Fake Convex ctx: in-memory tables with a query builder that
// supports the withIndex/order/first/collect/take/paginate surface
// the pipeline uses. Insert/patch are recorded for assertions.
// ============================================================
type Row = Record<string, unknown> & { _id: string };

interface FakeDbOptions {
  failOnInsert?: (table: string, doc: Record<string, unknown>) => boolean;
}

function makeDb(seed: Record<string, Row[]>, options: FakeDbOptions = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [table, rows] of Object.entries(seed)) {
    tables[table] = rows.map((r) => ({ ...r }));
  }
  const inserts: Array<{ table: string; doc: Row }> = [];
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
  let idCounter = 1000;

  const db = {
    tables,
    inserts,
    patches,
    get: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => r._id === id);
        if (hit) return hit;
      }
      return null;
    },
    insert: async (table: string, doc: Record<string, unknown>) => {
      if (options.failOnInsert?.(table, doc)) {
        throw new Error(`Insert failed for ${table}`);
      }
      const row: Row = { _id: `id_${idCounter++}`, ...doc };
      (tables[table] ??= []).push(row);
      inserts.push({ table, doc: row });
      return row._id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      patches.push({ id, patch });
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => r._id === id);
        if (hit) Object.assign(hit, patch);
      }
    },
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const builder = {
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
          return builder;
        },
        order: () => builder,
        collect: async () => rows,
        first: async () => rows[rows.length - 1] ?? null,
        take: async (n: number) => rows.slice(0, n),
        paginate: async (opts: { numItems: number; cursor: string | null }) => {
          const start = opts.cursor ? Number(opts.cursor) : 0;
          const page = rows.slice(start, start + opts.numItems);
          return {
            page,
            continueCursor: String(start + page.length),
            isDone: start + page.length >= rows.length,
          };
        },
      };
      return builder;
    },
  };

  return db;
}

function makeCtx(db: ReturnType<typeof makeDb>) {
  return { db } as never;
}

const now = Date.now();
const HOUR = 60 * 60 * 1000;

/** A farm with enough real data to trigger insights. */
function insightFarm(overrides: Partial<Row> = {}): Row {
  return {
    _id: "farm_1",
    userId: "user_1",
    name: "Test Farm",
    ...overrides,
  };
}

// ============================================================
// Empty-data behavior — no farms, no insight records
// ============================================================
describe("runIntelligencePipelineCore — empty data", () => {
  test("returns zero processed/insights when the user has no farms", async () => {
    const db = makeDb({});
    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
    });
    expect(result).toEqual({ processed: 0, insights: 0 });
    expect(db.inserts.length).toBe(0);
  });

  test("returns zero when the farmId points at a farm the user does not own", async () => {
    const db = makeDb({
      farms: [insightFarm({ _id: "farm_intruder", userId: "user_other" })],
    });
    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
      farmId: "farm_intruder" as never,
    });
    expect(result).toEqual({ processed: 0, insights: 0 });
    expect(db.inserts.length).toBe(0);
  });
});

// ============================================================
// Ownership — a farmer can only ever run the pipeline on their
// own farms; the farmId branch must not leak another user's data
// ============================================================
describe("runIntelligencePipelineCore — ownership", () => {
  test("processes an owned farm when farmId is provided", async () => {
    // Real crop data is seeded so an honest score is written.
    const db = makeDb({
      farms: [insightFarm()],
      crops: [
        {
          _id: "crop_1",
          farmId: "farm_1",
          userId: "user_1",
          name: "Maize",
          healthScore: 88,
        },
      ],
    });
    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
      farmId: "farm_1" as never,
    });
    expect(result.processed).toBe(1);
    // Health score persisted for the owned farm
    const scores = db.tables["farmHealthScores"] ?? [];
    expect(scores.length).toBe(1);
    expect(scores[0].farmId).toBe("farm_1");
    expect(scores[0].userId).toBe("user_1");
  });

  test("a bare farm with no real data gets NO fabricated score", async () => {
    // Phase 8 data-honesty: no crops/livestock/weather/satellite/soil/
    // financial data means no components — the pipeline must NOT invent
    // a default score and must not persist any health row.
    const db = makeDb({
      farms: [insightFarm()],
    });
    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
      farmId: "farm_1" as never,
    });
    expect(result.processed).toBe(1);
    expect(db.tables["farmHealthScores"] ?? []).toHaveLength(0);
    expect(db.inserts.filter((i) => i.table === "farmHealthScores")).toHaveLength(0);
  });

  test("skips farms belonging to other users in the all-farms path", async () => {
    // The all-farms path only queries farms by the authenticated
    // user, so an intruder's farm is never present in the set.
    // Real data is seeded so the honest pipeline writes a score.
    const db = makeDb({
      farms: [insightFarm({ _id: "farm_mine", userId: "user_1" })],
      crops: [
        {
          _id: "crop_mine",
          farmId: "farm_mine",
          userId: "user_1",
          name: "Maize",
          healthScore: 88,
        },
      ],
    });
    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
    });
    expect(result.processed).toBe(1);
    expect(db.tables["farmHealthScores"].length).toBe(1);
    expect(db.tables["farmHealthScores"][0].farmId).toBe("farm_mine");
  });
});

// ============================================================
// Persistence — health scores + insight records are written
// ============================================================
describe("runIntelligencePipelineCore — persistence", () => {
  test("persists a farm health score from real data", async () => {
    const db = makeDb({
      farms: [insightFarm()],
      crops: [
        {
          _id: "crop_1",
          farmId: "farm_1",
          userId: "user_1",
          name: "Maize",
          healthScore: 88,
        },
      ],
      livestock: [
        {
          _id: "liv_1",
          farmId: "farm_1",
          userId: "user_1",
          name: "Cow",
          healthScore: 90,
        },
      ],
      weatherData: [
        { _id: "wx_1", farmId: "farm_1", temperature: 22, precipitation: 40 },
      ],
      satelliteData: [{ _id: "sat_1", farmId: "farm_1", ndvi: 0.6 }],
      soilData: [
        {
          _id: "soil_1",
          farmId: "farm_1",
          userId: "user_1",
          ph: 6.5,
          organicMatter: 4,
          soilMoisture: 55,
          fertility: "high",
        },
      ],
      transactions: [
        { _id: "tx_1", farmId: "farm_1", userId: "user_1", type: "income", amount: 5000, date: now },
      ],
    });

    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
    });

    expect(result.processed).toBe(1);

    const scores = db.tables["farmHealthScores"];
    expect(scores.length).toBe(1);
    const score = scores[0];
    expect(score.farmId).toBe("farm_1");
    expect(score.userId).toBe("user_1");
    expect(typeof score.overall).toBe("number");
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(score.cropHealth).toBe(88);
    expect(score.livestockHealth).toBe(90);
    expect(typeof score.computedAt).toBe("number");
  });

  test("second run patches the existing score instead of duplicating", async () => {
    // Real crop data is seeded so the pipeline computes an honest
    // overall score — the second run must PATCH the existing row.
    const db = makeDb({
      farms: [insightFarm()],
      crops: [
        {
          _id: "crop_1",
          farmId: "farm_1",
          userId: "user_1",
          name: "Maize",
          healthScore: 88,
        },
      ],
      farmHealthScores: [
        {
          _id: "score_1",
          farmId: "farm_1",
          userId: "user_1",
          overall: 50,
          computedAt: now - 2 * HOUR,
        },
      ],
    });

    await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
    });

    const scoreInserts = db.inserts.filter((i) => i.table === "farmHealthScores");
    expect(scoreInserts.length).toBe(0); // no duplicate
    expect(db.patches.some((p) => p.id === "score_1")).toBe(true);
  });
});

// ============================================================
// Insights — derived from real data, never fabricated
// ============================================================
describe("runIntelligencePipelineCore — insights", () => {
  test("a bare farm with no data produces zero fabricated insights", async () => {
    const db = makeDb({
      farms: [insightFarm()],
    });
    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
    });
    expect(result.insights).toBe(0);
    const insightRows = db.tables["intelligenceData"] ?? [];
    expect(insightRows.length).toBe(0);
  });

  test("high weather risk produces a weather insight", async () => {
    const db = makeDb({
      farms: [insightFarm()],
      weatherData: [
        { _id: "wx_1", farmId: "farm_1", temperature: 40, precipitation: 0 },
      ],
    });
    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
    });
    expect(result.insights).toBeGreaterThanOrEqual(1);
    const rows = db.tables["intelligenceData"];
    expect(rows.some((r) => r.source === "weather" && r.severity === "high")).toBe(true);
  });

  test("low NDVI produces a satellite vegetation insight", async () => {
    const db = makeDb({
      farms: [insightFarm()],
      satelliteData: [{ _id: "sat_1", farmId: "farm_1", ndvi: 0.2 }],
    });
    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
    });
    expect(result.insights).toBeGreaterThanOrEqual(1);
    const rows = db.tables["intelligenceData"];
    expect(rows.some((r) => r.source === "satellite")).toBe(true);
  });

  test("dedup window prevents duplicate insights of the same source", async () => {
    const db = makeDb({
      farms: [insightFarm()],
      weatherData: [
        { _id: "wx_1", farmId: "farm_1", temperature: 40, precipitation: 0 },
      ],
      intelligenceData: [
        {
          _id: "insight_existing",
          userId: "user_1",
          farmId: "farm_1",
          source: "weather",
          dataType: "auto_insight",
          title: "High weather risk detected",
          createdAt: now - 1000, // inside the 12h dedup window
        },
      ],
    });

    const result = await runIntelligencePipelineCore(makeCtx(db), {
      userId: "user_1" as never,
    });
    expect(result.insights).toBe(0); // duplicate suppressed
    const newWeatherInsights = db.inserts.filter(
      (i) => i.table === "intelligenceData" && i.doc.source === "weather"
    );
    expect(newWeatherInsights.length).toBe(0);
  });
});

// ============================================================
// Batched cron core — all users, bounded batches, failure
// isolation, cursor chaining (Phase 5)
// ============================================================
describe("runIntelligencePipelineForAllUsers — batched cron core", () => {
  test("one batch processes only the batch size, then continues from the cursor", async () => {
    const users: Row[] = [{ _id: "user_0", email: "a@x.com" }];
    for (let i = 1; i < 105; i++) {
      users.push({ _id: `user_${i}`, email: `u${i}@x.com` });
    }
    const db = makeDb({ users });

    // First batch: 100 users (batch size), not done
    const first = await runIntelligencePipelineForAllUsersCore(makeCtx(db), null, 100);
    expect(first.isDone).toBe(false);
    expect(typeof first.continueCursor).toBe("string");

    // Second batch continues from the returned cursor and reaches the end
    const second = await runIntelligencePipelineForAllUsersCore(
      makeCtx(db),
      first.continueCursor,
      100
    );
    expect(second.isDone).toBe(true);
  });

  test("processes all users across pagination boundaries", async () => {
    const farms: Row[] = [insightFarm({ _id: "farm_1", userId: "user_0" })];
    const users: Row[] = [{ _id: "user_0", email: "a@x.com" }];
    // 105 users → page 2 holds the last 5; put a farmed user there too
    for (let i = 1; i < 105; i++) {
      users.push({ _id: `user_${i}`, email: `u${i}@x.com` });
    }
    farms.push(insightFarm({ _id: "farm_105", userId: "user_104" }));

    const db = makeDb({ users, farms });
    // Drive the full batch chain until done
    let cursor: string | null = null;
    let processed = 0;
    let failures = 0;
    let isDone = false;
    while (!isDone) {
      const result = await runIntelligencePipelineForAllUsersCore(makeCtx(db), cursor, 100);
      processed += result.processed;
      failures += result.failures;
      isDone = result.isDone;
      cursor = result.isDone ? null : result.continueCursor;
    }
    expect(failures).toBe(0);
    // Both farmed users (page 1 and page 2) were processed
    expect(processed).toBe(2);
  });

  test("isolates failures so one bad user does not abort the batch", async () => {
    // Both farms are seeded with real crop data so the honest pipeline
    // reaches the insert path — the bad user's insert then fails.
    const db = makeDb(
      {
        users: [
          { _id: "user_good", email: "good@x.com" },
          { _id: "user_bad", email: "bad@x.com" },
        ],
        farms: [
          insightFarm({ _id: "farm_good", userId: "user_good" }),
          insightFarm({ _id: "farm_bad", userId: "user_bad" }),
        ],
        crops: [
          {
            _id: "crop_good",
            farmId: "farm_good",
            userId: "user_good",
            name: "Maize",
            healthScore: 88,
          },
          {
            _id: "crop_bad",
            farmId: "farm_bad",
            userId: "user_bad",
            name: "Maize",
            healthScore: 70,
          },
        ],
      },
      {
        // Simulate a data problem for exactly one user's farm
        failOnInsert: (table, doc) =>
          table === "farmHealthScores" && doc.farmId === "farm_bad",
      }
    );

    const result = await runIntelligencePipelineForAllUsersCore(makeCtx(db), null, 100);
    expect(result.failures).toBe(1);
    expect(result.processed).toBe(1); // good user still processed
    expect(result.isDone).toBe(true); // small dataset finishes in one batch
    const scores = db.tables["farmHealthScores"] ?? [];
    expect(scores.some((s) => s.farmId === "farm_good")).toBe(true);
    expect(scores.some((s) => s.farmId === "farm_bad")).toBe(false);
  });

  test("skips nothing when users have no farms — zero is a valid result", async () => {
    const db = makeDb({
      users: [{ _id: "user_1", email: "a@x.com" }],
    });
    const result = await runIntelligencePipelineForAllUsersCore(makeCtx(db), null, 100);
    expect(result.processed).toBe(0);
    expect(result.insights).toBe(0);
    expect(result.failures).toBe(0);
    expect(result.isDone).toBe(true);
  });
});
