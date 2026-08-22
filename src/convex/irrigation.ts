import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  verifyFarmOwnership,
  verifyIrrigationOwnership,
  createAuditLog,
  validateString,
  validateNumber,
  sanitizeInput,
} from "./authHelpers";

// ============================================================
// Allowed values
// ============================================================

export const IRRIGATION_FREQUENCIES = ["daily", "alternate_days", "weekly", "custom"] as const;
export type IrrigationFrequency = (typeof IRRIGATION_FREQUENCIES)[number];

export const IRRIGATION_METHODS = ["drip", "sprinkler", "flood", "manual"] as const;

// ============================================================
// Pure helpers (exported for unit testing)
// ============================================================

export interface ScheduleInput {
  farmId: string;
  name: string;
  frequency: string;
  customDays?: number[];
  startTime: string; // "HH:MM"
  duration: number; // minutes
  waterAmount: number; // liters
  zone?: string;
  soilMoistureTarget?: number;
  weatherDependent?: boolean;
}

/**
 * Validate irrigation schedule input. Returns a list of error messages
 * (empty array means the input is valid). Called server-side before any
 * write; the frontend mirrors these rules but never bypasses them.
 */
export function validateScheduleInput(input: ScheduleInput): string[] {
  const errors: string[] = [];

  if (!input.name || !input.name.trim()) {
    errors.push("Name is required");
  } else if (input.name.trim().length > 200) {
    errors.push("Name must be 200 characters or fewer");
  }

  if (!IRRIGATION_FREQUENCIES.includes(input.frequency as IrrigationFrequency)) {
    errors.push("Frequency must be one of: daily, alternate_days, weekly, custom");
  }

  if (input.frequency === "custom") {
    if (!input.customDays || input.customDays.length === 0) {
      errors.push("Custom frequency requires at least one day of the week");
    } else if (input.customDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      errors.push("Custom days must be integers between 0 (Sunday) and 6 (Saturday)");
    }
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime || "")) {
    errors.push("Start time must be in HH:MM 24-hour format");
  }

  if (!Number.isFinite(input.duration) || input.duration < 1 || input.duration > 600) {
    errors.push("Duration must be between 1 and 600 minutes");
  }

  if (!Number.isFinite(input.waterAmount) || input.waterAmount < 1 || input.waterAmount > 100000) {
    errors.push("Water amount must be between 1 and 100,000 liters");
  }

  if (
    input.soilMoistureTarget !== undefined &&
    (!Number.isFinite(input.soilMoistureTarget) ||
      input.soilMoistureTarget < 0 ||
      input.soilMoistureTarget > 100)
  ) {
    errors.push("Soil moisture target must be between 0 and 100");
  }

  return errors;
}

/**
 * Compute the next run time for a schedule after a given instant.
 * Deterministic: the same inputs always produce the same output.
 *
 * - daily: next occurrence of HH:MM after `from`
 * - alternate_days: next occurrence where the day offset from `from` is even (0, 2, 4...)
 * - weekly: next occurrence where the day offset from `from` is a multiple of 7
 * - custom: next occurrence on one of the configured weekdays
 */
export function computeNextRunAt(
  frequency: IrrigationFrequency,
  startTime: string,
  customDays: number[] | undefined,
  from: number
): number {
  const [h, m] = startTime.split(":").map((p) => parseInt(p, 10));
  const base = new Date(from);
  const candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);

  if (candidate.getTime() <= from) {
    candidate.setDate(candidate.getDate() + 1);
  }

  const dayOffset = (target: Date, anchor: Date) =>
    Math.floor(target.getTime() / 86400000) - Math.floor(anchor.getTime() / 86400000);

  switch (frequency) {
    case "daily":
      return candidate.getTime();
    case "alternate_days": {
      // Advance until the day offset from `base` is even (0, 2, 4, ...)
      let offset = dayOffset(candidate, base);
      if (offset % 2 !== 0) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate.getTime();
    }
    case "weekly": {
      let offset = dayOffset(candidate, base);
      while (offset % 7 !== 0) {
        candidate.setDate(candidate.getDate() + 1);
        offset = dayOffset(candidate, base);
      }
      return candidate.getTime();
    }
    case "custom": {
      const days = [...new Set((customDays ?? []).filter((d) => d >= 0 && d <= 6))];
      if (days.length === 0) {
        // Fall back to daily when no valid days configured
        return candidate.getTime();
      }
      for (let i = 0; i < 8; i++) {
        if (days.includes(candidate.getDay())) {
          return candidate.getTime();
        }
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate.getTime();
    }
  }
}

export interface IrrigationAlertInput {
  id: string;
  name: string;
  isActive: boolean;
  nextRunAt?: number;
  lastRunAt?: number;
  waterAmount?: number;
}

export interface DerivedAlert {
  id: string;
  type: "low_moisture" | "high_moisture" | "rain_expected" | "schedule_due" | "schedule_overdue";
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  timestamp: number;
}

/**
 * Derive irrigation alerts from REAL data only — the schedules passed in,
 * the farm's cached weather forecast and soil analysis. No fabricated
 * sensor readings: if soil/weather data is absent, those alerts simply do
 * not appear. Alerts are scoped by construction because the query only
 * passes the authenticated user's own schedules and farms.
 */
export function buildIrrigationAlerts(
  schedules: IrrigationAlertInput[],
  weatherDaily: { date: number; precipitationSum: number }[] | null | undefined,
  soilMoisture: number | null | undefined,
  now: number
): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];

  for (const schedule of schedules) {
    if (!schedule.isActive || schedule.nextRunAt === undefined) continue;

    if (schedule.nextRunAt <= now) {
      alerts.push({
        id: `overdue-${schedule.id}`,
        type: "schedule_overdue",
        severity: "high",
        title: `Irrigation overdue — ${schedule.name}`,
        message: `Scheduled irrigation was due at ${new Date(schedule.nextRunAt).toLocaleString()}. Consider running it now.`,
        timestamp: now,
      });
    } else if (schedule.nextRunAt <= now + 30 * 60 * 1000) {
      alerts.push({
        id: `due-${schedule.id}`,
        type: "schedule_due",
        severity: "low",
        title: `Irrigation due soon — ${schedule.name}`,
        message: `Scheduled irrigation is due within 30 minutes (${new Date(schedule.nextRunAt).toLocaleTimeString()}).`,
        timestamp: now,
      });
    }
  }

  const nextTwoDays = 2 * 24 * 60 * 60 * 1000;
  const rainExpected = (weatherDaily ?? []).some(
    (d) => d.date > now - 24 * 60 * 60 * 1000 && d.date < now + nextTwoDays && d.precipitationSum > 10
  );
  if (rainExpected) {
    alerts.push({
      id: "rain-expected",
      type: "rain_expected",
      severity: "medium",
      title: "Rain expected — consider skipping irrigation",
      message: "Significant rainfall is forecast within the next 48 hours. You may want to pause scheduled irrigation.",
      timestamp: now,
    });
  }

  if (soilMoisture !== null && soilMoisture !== undefined) {
    if (soilMoisture < 30) {
      alerts.push({
        id: "low-moisture",
        type: "low_moisture",
        severity: "high",
        title: "Low soil moisture",
        message: `Soil moisture is at ${Math.round(soilMoisture)}%. Irrigation is recommended soon.`,
        timestamp: now,
      });
    } else if (soilMoisture > 75) {
      alerts.push({
        id: "high-moisture",
        type: "high_moisture",
        severity: "medium",
        title: "High soil moisture — excessive irrigation risk",
        message: `Soil moisture is at ${Math.round(soilMoisture)}%. Waterlogging is possible; consider delaying irrigation.`,
        timestamp: now,
      });
    }
  }

  return alerts;
}

// ============================================================
// Queries
// ============================================================

/** List the current user's irrigation schedules (optionally for one farm). */
export const listMySchedules = query({
  args: { farmId: v.optional(v.id("farms")) },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    let base = ctx.db
      .query("irrigationSchedules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    const farmId = args.farmId;
    if (farmId) {
      base = ctx.db
        .query("irrigationSchedules")
        .withIndex("by_farm", (q) => q.eq("farmId", farmId));
    }

    const schedules = await base.collect();

    // If a farm filter was requested, still enforce ownership on the results
    if (farmId) {
      const farm = await ctx.db.get(farmId);
      if (!farm || farm.userId !== userId) {
        throw new Error("Access denied: You do not own this farm");
      }
      return schedules.filter((s) => s.userId === userId);
    }

    return schedules;
  },
});

/** Get a single schedule (ownership-checked). */
export const getSchedule = query({
  args: { scheduleId: v.id("irrigationSchedules") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    return await verifyIrrigationOwnership(ctx, args.scheduleId, userId);
  },
});

/** Irrigation history (optionally filtered by farm and limited). */
export const getIrrigationHistory = query({
  args: {
    farmId: v.optional(v.id("farms")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    if (args.farmId) {
      const farm = await ctx.db.get(args.farmId);
      if (!farm || farm.userId !== userId) {
        throw new Error("Access denied: You do not own this farm");
      }
    }

    const max = Math.min(200, Math.max(1, args.limit ?? 50));
    const runs = await ctx.db
      .query("irrigationRuns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const filtered = args.farmId ? runs.filter((r) => r.farmId === args.farmId) : runs;

    // Attach schedule names for display
    const scheduleIds = [...new Set(filtered.map((r) => r.scheduleId))];
    const schedules = await Promise.all(scheduleIds.map((id) => ctx.db.get(id)));
    const nameById = new Map(
      schedules.filter((s) => s !== null).map((s) => [s._id, s.name])
    );

    return filtered.slice(0, max).map((r) => ({
      ...r,
      scheduleName: nameById.get(r.scheduleId) ?? "Deleted schedule",
    }));
  },
});

/**
 * Derived irrigation alerts for the current user (optionally one farm).
 * Built from real schedules, cached weather forecast and soil data.
 */
export const getIrrigationAlerts = query({
  args: { farmId: v.optional(v.id("farms")) },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const schedules = await ctx.db
      .query("irrigationSchedules")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const scopedSchedules = args.farmId
      ? schedules.filter((s) => s.farmId === args.farmId)
      : schedules;

    // Farm-scoped weather + soil for the alert derivation. When no farm is
    // selected, use the first farm that has data.
    let farmIds = [...new Set(scopedSchedules.map((s) => s.farmId))];
    if (farmIds.length === 0 && args.farmId) farmIds = [args.farmId];

    let weatherDaily: { date: number; precipitationSum: number }[] | null = null;
    let soilMoisture: number | null = null;

    for (const farmId of farmIds.slice(0, 3)) {
      const weather = await ctx.db
        .query("weatherData")
        .withIndex("by_farm", (q) => q.eq("farmId", farmId))
        .order("desc")
        .first();
      if (weather?.forecast && !weatherDaily) {
        weatherDaily = weather.forecast.map((f) => ({
          date: f.date,
          precipitationSum: f.precipitation,
        }));
      }

      const soil = await ctx.db
        .query("soilData")
        .withIndex("by_farm", (q) => q.eq("farmId", farmId))
        .order("desc")
        .first();
      if (soil && soilMoisture === null) {
        soilMoisture = soil.soilMoisture;
      }

      if (weatherDaily !== null && soilMoisture !== null) break;
    }

    return buildIrrigationAlerts(
      scopedSchedules.map((s) => ({
        id: s._id,
        name: s.name,
        isActive: s.isActive,
        nextRunAt: s.nextRunAt,
        lastRunAt: s.lastRunAt,
        waterAmount: s.waterAmount,
      })),
      weatherDaily,
      soilMoisture,
      Date.now()
    );
  },
});

// ============================================================
// Mutations
// ============================================================

/** Create a new irrigation schedule. */
export const createSchedule = mutation({
  args: {
    farmId: v.id("farms"),
    cropId: v.optional(v.id("crops")),
    name: v.string(),
    frequency: v.string(),
    customDays: v.optional(v.array(v.number())),
    startTime: v.string(),
    duration: v.number(),
    waterAmount: v.number(),
    waterSource: v.optional(v.string()),
    zone: v.optional(v.string()),
    soilMoistureTarget: v.optional(v.number()),
    weatherDependent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    const errors = validateScheduleInput(args);
    if (errors.length > 0) {
      throw new Error(`Invalid irrigation schedule: ${errors.join("; ")}`);
    }

    const now = Date.now();
    const name = sanitizeInput(validateString(args.name, "Name", 200));
    const zone = args.zone ? sanitizeInput(args.zone) : undefined;

    const scheduleId = await ctx.db.insert("irrigationSchedules", {
      farmId: args.farmId,
      userId,
      cropId: args.cropId,
      name,
      frequency: args.frequency,
      customDays: args.frequency === "custom" ? args.customDays : undefined,
      startTime: args.startTime,
      duration: args.duration,
      waterAmount: args.waterAmount,
      waterSource: args.waterSource ? sanitizeInput(args.waterSource) : undefined,
      zone,
      soilMoistureTarget: args.soilMoistureTarget,
      weatherDependent: args.weatherDependent ?? false,
      isActive: true,
      nextRunAt: computeNextRunAt(
        args.frequency as IrrigationFrequency,
        args.startTime,
        args.customDays,
        now
      ),
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "irrigation_schedule_created",
      resource: "irrigationSchedules",
      resourceId: scheduleId,
      changes: {
        name,
        frequency: args.frequency,
        startTime: args.startTime,
        farmId: args.farmId,
        waterAmount: args.waterAmount,
      },
    });

    // Auto-create calendar event for the next irrigation run
    const nextRunAt = computeNextRunAt(
      args.frequency as IrrigationFrequency,
      args.startTime,
      args.customDays,
      now
    );
    await ctx.db.insert("farmCalendar", {
      userId,
      farmId: args.farmId,
      cropId: args.cropId,
      title: `Irrigate: ${name}`,
      description: `Scheduled irrigation — ${args.waterAmount}L via ${args.frequency}`,
      eventType: "irrigation",
      startDate: nextRunAt,
      isRecurring: false,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    return scheduleId;
  },
});

/** Update an irrigation schedule (ownership-checked). */
export const updateSchedule = mutation({
  args: {
    scheduleId: v.id("irrigationSchedules"),
    farmId: v.optional(v.id("farms")),
    cropId: v.optional(v.id("crops")),
    name: v.optional(v.string()),
    frequency: v.optional(v.string()),
    customDays: v.optional(v.array(v.number())),
    startTime: v.optional(v.string()),
    duration: v.optional(v.number()),
    waterAmount: v.optional(v.number()),
    waterSource: v.optional(v.string()),
    zone: v.optional(v.string()),
    soilMoistureTarget: v.optional(v.number()),
    weatherDependent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const existing = await verifyIrrigationOwnership(ctx, args.scheduleId, userId);

    if (args.farmId && args.farmId !== existing.farmId) {
      await verifyFarmOwnership(ctx, args.farmId, userId);
    }

    const merged = {
      name: args.name ?? existing.name,
      frequency: args.frequency ?? existing.frequency,
      customDays:
        args.customDays !== undefined
          ? args.customDays
          : args.frequency === "custom"
          ? existing.customDays
          : undefined,
      startTime: args.startTime ?? existing.startTime,
      duration: args.duration ?? existing.duration,
      waterAmount: args.waterAmount ?? existing.waterAmount,
      soilMoistureTarget: args.soilMoistureTarget ?? existing.soilMoistureTarget,
      farmId: args.farmId ?? existing.farmId,
    };

    const errors = validateScheduleInput(merged);
    if (errors.length > 0) {
      throw new Error(`Invalid irrigation schedule: ${errors.join("; ")}`);
    }

    const now = Date.now();
    await ctx.db.patch(args.scheduleId, {
      name: sanitizeInput(validateString(args.name ?? existing.name, "Name", 200)),
      farmId: args.farmId ?? existing.farmId,
      cropId: args.cropId,
      frequency: merged.frequency,
      customDays:
        merged.frequency === "custom" ? merged.customDays : undefined,
      startTime: merged.startTime,
      duration: merged.duration,
      waterAmount: merged.waterAmount,
      waterSource: args.waterSource !== undefined ? sanitizeInput(args.waterSource) : existing.waterSource,
      zone: args.zone !== undefined ? sanitizeInput(args.zone) : existing.zone,
      soilMoistureTarget:
        args.soilMoistureTarget !== undefined
          ? args.soilMoistureTarget
          : existing.soilMoistureTarget,
      weatherDependent:
        args.weatherDependent !== undefined
          ? args.weatherDependent
          : existing.weatherDependent,
      // Recompute next run from the current one so frequency changes take effect
      nextRunAt: computeNextRunAt(
        merged.frequency as IrrigationFrequency,
        merged.startTime,
        merged.customDays,
        Math.max(now, existing.nextRunAt ?? now)
      ),
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "irrigation_schedule_updated",
      resource: "irrigationSchedules",
      resourceId: args.scheduleId,
      changes: { name: merged.name, frequency: merged.frequency, farmId: merged.farmId },
    });

    return true;
  },
});

/** Delete an irrigation schedule (ownership-checked). */
export const deleteSchedule = mutation({
  args: { scheduleId: v.id("irrigationSchedules") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const schedule = await verifyIrrigationOwnership(ctx, args.scheduleId, userId);

    await ctx.db.delete(args.scheduleId);

    await createAuditLog(ctx, {
      userId,
      action: "irrigation_schedule_deleted",
      resource: "irrigationSchedules",
      resourceId: args.scheduleId,
      changes: { name: schedule.name, farmId: schedule.farmId },
    });

    return true;
  },
});

/** Enable an irrigation schedule. */
export const enableSchedule = mutation({
  args: { scheduleId: v.id("irrigationSchedules") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyIrrigationOwnership(ctx, args.scheduleId, userId);

    await ctx.db.patch(args.scheduleId, { isActive: true, updatedAt: Date.now() });

    await createAuditLog(ctx, {
      userId,
      action: "irrigation_schedule_enabled",
      resource: "irrigationSchedules",
      resourceId: args.scheduleId,
      changes: { isActive: true },
    });

    return true;
  },
});

/** Disable an irrigation schedule. */
export const disableSchedule = mutation({
  args: { scheduleId: v.id("irrigationSchedules") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyIrrigationOwnership(ctx, args.scheduleId, userId);

    await ctx.db.patch(args.scheduleId, { isActive: false, updatedAt: Date.now() });

    await createAuditLog(ctx, {
      userId,
      action: "irrigation_schedule_disabled",
      resource: "irrigationSchedules",
      resourceId: args.scheduleId,
      changes: { isActive: false },
    });

    return true;
  },
});

/** Record an irrigation run and advance the schedule's next run time. */
export const recordIrrigation = mutation({
  args: {
    scheduleId: v.id("irrigationSchedules"),
    date: v.optional(v.number()),
    duration: v.optional(v.number()),
    waterAmount: v.optional(v.number()),
    method: v.optional(v.string()),
    status: v.optional(v.union(v.literal("completed"), v.literal("skipped"), v.literal("manual"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const schedule = await verifyIrrigationOwnership(ctx, args.scheduleId, userId);

    const now = Date.now();
    const duration = args.duration ?? schedule.duration;
    const waterAmount = args.waterAmount ?? schedule.waterAmount;
    validateNumber(duration, "Duration", 1, 600);
    validateNumber(waterAmount, "Water amount", 1, 100000);

    const runId = await ctx.db.insert("irrigationRuns", {
      scheduleId: args.scheduleId,
      farmId: schedule.farmId,
      userId,
      date: args.date ?? now,
      duration,
      waterAmount,
      method: args.method ?? schedule.waterSource ?? "manual",
      status: args.status ?? "manual",
      notes: args.notes ? sanitizeInput(args.notes) : undefined,
      createdAt: now,
    });

    // Advance the schedule: last run = now, next run from now (frequency rules)
    await ctx.db.patch(args.scheduleId, {
      lastRunAt: args.date ?? now,
      nextRunAt: computeNextRunAt(
        schedule.frequency as IrrigationFrequency,
        schedule.startTime,
        schedule.customDays,
        Math.max(now, args.date ?? now)
      ),
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "irrigation_run_recorded",
      resource: "irrigationRuns",
      resourceId: runId,
      changes: {
        scheduleId: args.scheduleId,
        duration,
        waterAmount,
        status: args.status ?? "manual",
      },
    });

    return runId;
  },
});
