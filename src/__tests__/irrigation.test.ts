import { describe, expect, test } from "bun:test";
import {
  validateScheduleInput,
  computeNextRunAt,
  buildIrrigationAlerts,
  type IrrigationAlertInput,
} from "../convex/irrigation";
import { verifyIrrigationOwnership, createAuditLog } from "../convex/authHelpers";

// ============================================================
// Fake Convex ctx: only the `db.get` surface used by the
// ownership verifiers is mocked.
// ============================================================
function makeCtx(docs: Record<string, unknown>) {
  return {
    db: {
      get: async (id: string) => docs[id] ?? null,
    },
  } as never;
}

const userId = "user_owner";

const validInput = {
  farmId: "farm_1",
  name: "Vegetable Garden Drip",
  frequency: "daily",
  startTime: "06:00",
  duration: 30,
  waterAmount: 200,
};

// ============================================================
// Input validation (server-side rules mirrored by the UI)
// ============================================================
describe("validateScheduleInput", () => {
  test("accepts a valid schedule", () => {
    expect(validateScheduleInput(validInput)).toEqual([]);
  });

  test("rejects a missing name", () => {
    expect(validateScheduleInput({ ...validInput, name: "" })).toContain(
      "Name is required"
    );
  });

  test("rejects an over-long name", () => {
    expect(
      validateScheduleInput({ ...validInput, name: "x".repeat(201) }).join("; ")
    ).toContain("200 characters or fewer");
  });

  test("rejects an unknown frequency", () => {
    expect(
      validateScheduleInput({ ...validInput, frequency: "hourly" }).join("; ")
    ).toContain("Frequency must be one of");
  });

  test("rejects custom frequency with no days", () => {
    expect(
      validateScheduleInput({ ...validInput, frequency: "custom", customDays: [] }).join("; ")
    ).toContain("at least one day");
  });

  test("rejects custom frequency with out-of-range days", () => {
    expect(
      validateScheduleInput({
        ...validInput,
        frequency: "custom",
        customDays: [7],
      }).join("; ")
    ).toContain("between 0 (Sunday) and 6 (Saturday)");
  });

  test("rejects a malformed start time", () => {
    expect(
      validateScheduleInput({ ...validInput, startTime: "25:99" }).join("; ")
    ).toContain("HH:MM");
  });

  test("rejects duration outside 1..600", () => {
    expect(validateScheduleInput({ ...validInput, duration: 0 }).join("; ")).toContain(
      "1 and 600"
    );
    expect(validateScheduleInput({ ...validInput, duration: 601 }).join("; ")).toContain(
      "1 and 600"
    );
  });

  test("rejects water amount outside 1..100000", () => {
    expect(validateScheduleInput({ ...validInput, waterAmount: 0 }).join("; ")).toContain(
      "1 and 100,000"
    );
  });

  test("rejects an out-of-range soil moisture target", () => {
    expect(
      validateScheduleInput({ ...validInput, soilMoistureTarget: 150 }).join("; ")
    ).toContain("0 and 100");
  });

  test("accepts a valid soil moisture target", () => {
    expect(
      validateScheduleInput({ ...validInput, soilMoistureTarget: 65 })
    ).toEqual([]);
  });
});

// ============================================================
// computeNextRunAt — deterministic scheduling
// ============================================================
describe("computeNextRunAt", () => {
  const now = new Date("2026-08-09T10:00:00").getTime();

  test("daily schedule runs later the same day when start time is ahead", () => {
    const next = computeNextRunAt("daily", "18:00", undefined, now);
    expect(next).toBe(new Date("2026-08-09T18:00:00").getTime());
  });

  test("daily schedule rolls to tomorrow when start time has passed", () => {
    const next = computeNextRunAt("daily", "06:00", undefined, now);
    expect(next).toBe(new Date("2026-08-10T06:00:00").getTime());
  });

  test("weekly schedule lands exactly 7 days after a passed time", () => {
    const next = computeNextRunAt("weekly", "06:00", undefined, now);
    expect(next).toBe(new Date("2026-08-16T06:00:00").getTime());
  });

  test("custom schedule lands on the next configured weekday", () => {
    // 2026-08-09 is a Sunday. Configure Monday (1) — next run is tomorrow.
    const next = computeNextRunAt("custom", "06:00", [1], now);
    expect(next).toBe(new Date("2026-08-10T06:00:00").getTime());
  });

  test("custom schedule with no valid days falls back to daily", () => {
    const next = computeNextRunAt("custom", "18:00", [], now);
    expect(next).toBe(new Date("2026-08-09T18:00:00").getTime());
  });

  test("is deterministic for identical inputs", () => {
    const a = computeNextRunAt("daily", "07:30", undefined, now);
    const b = computeNextRunAt("daily", "07:30", undefined, now);
    expect(a).toBe(b);
  });
});

// ============================================================
// buildIrrigationAlerts — derived from REAL data only
// ============================================================
describe("buildIrrigationAlerts", () => {
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  test("raises an overdue alert for an active past-due schedule", () => {
    const schedules: IrrigationAlertInput[] = [
      {
        id: "sch_1",
        name: "Maize Drip",
        isActive: true,
        nextRunAt: now - hour,
      },
    ];
    const alerts = buildIrrigationAlerts(schedules, null, null, now);
    expect(alerts.some((a) => a.type === "schedule_overdue")).toBe(true);
    expect(alerts.some((a) => a.severity === "high")).toBe(true);
  });

  test("raises a low-severity due-soon alert inside the 30-minute window", () => {
    const schedules: IrrigationAlertInput[] = [
      {
        id: "sch_1",
        name: "Maize Drip",
        isActive: true,
        nextRunAt: now + 10 * 60 * 1000,
      },
    ];
    const alerts = buildIrrigationAlerts(schedules, null, null, now);
    expect(alerts.some((a) => a.type === "schedule_due")).toBe(true);
  });

  test("inactive schedules produce no schedule alerts", () => {
    const schedules: IrrigationAlertInput[] = [
      {
        id: "sch_1",
        name: "Maize Drip",
        isActive: false,
        nextRunAt: now - hour,
      },
    ];
    const alerts = buildIrrigationAlerts(schedules, null, null, now);
    expect(alerts.some((a) => a.type.startsWith("schedule_"))).toBe(false);
  });

  test("forecast rain within 48h triggers a rain alert", () => {
    const weatherDaily = [
      { date: now + 10 * hour, precipitationSum: 25 },
    ];
    const alerts = buildIrrigationAlerts([], weatherDaily, null, now);
    expect(alerts.some((a) => a.type === "rain_expected")).toBe(true);
  });

  test("no rain alert when precipitation is below threshold", () => {
    const weatherDaily = [
      { date: now + 10 * hour, precipitationSum: 2 },
    ];
    const alerts = buildIrrigationAlerts([], weatherDaily, null, now);
    expect(alerts.some((a) => a.type === "rain_expected")).toBe(false);
  });

  test("low soil moisture produces a high-severity alert", () => {
    const alerts = buildIrrigationAlerts([], null, 22, now);
    expect(alerts.some((a) => a.type === "low_moisture")).toBe(true);
  });

  test("high soil moisture produces an excessive-irrigation alert", () => {
    const alerts = buildIrrigationAlerts([], null, 80, now);
    expect(alerts.some((a) => a.type === "high_moisture")).toBe(true);
  });

  test("healthy soil moisture produces no moisture alert", () => {
    const alerts = buildIrrigationAlerts([], null, 55, now);
    expect(alerts.some((a) => a.type.endsWith("_moisture"))).toBe(false);
  });

  test("no fabricated sensor data: absent soil/weather yields no such alerts", () => {
    const alerts = buildIrrigationAlerts([], null, null, now);
    expect(alerts.some((a) => a.type.endsWith("_moisture"))).toBe(false);
    expect(alerts.some((a) => a.type === "rain_expected")).toBe(false);
  });

  test("alerts are scoped to the schedules passed in (authorized set only)", () => {
    // The backend only passes the authenticated user's own schedules;
    // an intruder's schedule is simply not present in the input set.
    const mine: IrrigationAlertInput[] = [
      { id: "sch_mine", name: "My Drip", isActive: true, nextRunAt: now - hour },
    ];
    const alerts = buildIrrigationAlerts(mine, null, null, now);
    // Only schedule-derived alert references the caller's own schedule
    expect(alerts.filter((a) => a.type === "schedule_overdue")).toHaveLength(1);
    expect(alerts[0].id).toBe("overdue-sch_mine");
    // No alert can reference a schedule the user was never given
    expect(alerts.some((a) => a.id.includes("sch_intruder"))).toBe(false);
  });
});

// ============================================================
// Ownership — cross-user access denial
// ============================================================
describe("verifyIrrigationOwnership", () => {
  test("returns the schedule when the user owns it", async () => {
    const ctx = makeCtx({
      sch_1: { _id: "sch_1", userId, name: "Vegetable Drip", farmId: "farm_1" },
    });
    const schedule = await verifyIrrigationOwnership(ctx, "sch_1", userId);
    expect(String(schedule._id)).toBe("sch_1");
    expect(String(schedule.userId)).toBe(userId);
  });

  test("throws when the schedule does not exist", async () => {
    const ctx = makeCtx({});
    await expect(
      verifyIrrigationOwnership(ctx, "missing", userId)
    ).rejects.toThrow(/not found/);
  });

  test("throws when another user owns the schedule (view)", async () => {
    const ctx = makeCtx({
      sch_1: { _id: "sch_1", userId: "user_intruder", farmId: "farm_1" },
    });
    await expect(
      verifyIrrigationOwnership(ctx, "sch_1", userId)
    ).rejects.toThrow(/do not own/);
  });

  test("throws for an intruder attempting to modify (same guard)", async () => {
    const ctx = makeCtx({
      sch_1: { _id: "sch_1", userId: "user_intruder", farmId: "farm_1" },
    });
    await expect(
      verifyIrrigationOwnership(ctx, "sch_1", userId)
    ).rejects.toThrow(/do not own/);
  });

  test("throws for an intruder attempting to delete (same guard)", async () => {
    const ctx = makeCtx({
      sch_1: { _id: "sch_1", userId: "user_intruder", farmId: "farm_1" },
    });
    await expect(
      verifyIrrigationOwnership(ctx, "sch_1", userId)
    ).rejects.toThrow(/do not own/);
  });
});

// ============================================================
// Audit logging for important irrigation mutations
// ============================================================
describe("irrigation audit logging", () => {
  test("createAuditLog persists an irrigation schedule creation entry", async () => {
    let inserted: Record<string, unknown> | null = null;
    const ctx = {
      db: {
        insert: async (_table: string, doc: Record<string, unknown>) => {
          inserted = doc;
          return "audit_irr_1";
        },
      },
    } as never;

    await createAuditLog(ctx as never, {
      userId,
      action: "irrigation_schedule_created",
      resource: "irrigationSchedules",
      resourceId: "sch_1",
      changes: { name: "Vegetable Drip", farmId: "farm_1" },
    });

    expect(inserted).not.toBeNull();
    expect(inserted!.userId).toBe(userId);
    expect(inserted!.action).toBe("irrigation_schedule_created");
    expect(inserted!.resource).toBe("irrigationSchedules");
    expect(inserted!.resourceId).toBe("sch_1");
    expect(inserted!.changes).toEqual({
      name: "Vegetable Drip",
      farmId: "farm_1",
    });
    expect(typeof inserted!.createdAt).toBe("number");
  });
});
