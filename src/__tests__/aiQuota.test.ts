import { describe, test, expect } from "bun:test";
import {
  getAiDailyLimit,
  exceedsAiUsageLimit,
  getStartOfDayUtc,
} from "../convex/aiAssistant";

// ============================================================
// AI quota invariants — the pure rules behind the atomic
// usage reservation. The pre-check and the reservation share
// these functions, so testing them pins the whole enforcement
// boundary: Free = 5 chat/day, separate detection quota,
// consistent UTC day window.
// ============================================================

describe("exceedsAiUsageLimit — over-quota boundary rule", () => {
  test("under the limit does not exceed", () => {
    expect(exceedsAiUsageLimit(0, 5)).toBe(false);
    expect(exceedsAiUsageLimit(4, 5)).toBe(false);
  });

  test("exactly at the limit exceeds — the 5th request is the last allowed", () => {
    // `used` counts requests already logged today. used=4 → the incoming
    // request is the 5th and is allowed; used=5 → the next is the 6th and
    // is rejected, so a free user can never exceed 5 per day.
    expect(exceedsAiUsageLimit(4, 5)).toBe(false);
    expect(exceedsAiUsageLimit(5, 5)).toBe(true);
  });

  test("over the limit exceeds", () => {
    expect(exceedsAiUsageLimit(6, 5)).toBe(true);
    expect(exceedsAiUsageLimit(500, 500)).toBe(true);
  });

  test("zero limit always exceeds (feature closed)", () => {
    expect(exceedsAiUsageLimit(0, 0)).toBe(true);
  });

  test("NaN used is not over limit (JS semantics) — safe because `used` is always a real row count", () => {
    expect(exceedsAiUsageLimit(NaN, 5)).toBe(false);
  });
});

describe("getStartOfDayUtc — quota day scoping", () => {
  test("resets at UTC midnight: same moment inside a day returns that day's boundary", () => {
    const now = Date.UTC(2026, 8, 15, 13, 45, 30); // Sep 15 2026 13:45 UTC
    expect(getStartOfDayUtc(now)).toBe(Date.UTC(2026, 8, 15));
  });

  test("first millisecond of a day maps to itself", () => {
    const boundary = Date.UTC(2026, 8, 15);
    expect(getStartOfDayUtc(boundary)).toBe(boundary);
  });

  test("last millisecond of a day maps to that same day (not the next)", () => {
    const lastMs = Date.UTC(2026, 8, 15, 23, 59, 59, 999);
    expect(getStartOfDayUtc(lastMs)).toBe(Date.UTC(2026, 8, 15));
  });

  test("day boundary produces strictly increasing windows across days", () => {
    const day1 = getStartOfDayUtc(Date.UTC(2026, 8, 15, 10));
    const day2 = getStartOfDayUtc(Date.UTC(2026, 8, 16, 10));
    expect(day2).toBeGreaterThan(day1);
    expect(day2 - day1).toBe(24 * 60 * 60 * 1000);
  });

  test("month rollover is handled correctly", () => {
    expect(getStartOfDayUtc(Date.UTC(2026, 8, 30, 23, 59))).toBe(Date.UTC(2026, 8, 30));
    expect(getStartOfDayUtc(Date.UTC(2026, 9, 1, 0, 0))).toBe(Date.UTC(2026, 9, 1));
  });
});

describe("getAiDailyLimit — plan/action matrix (regression)", () => {
  test("free chat quota stays exactly 5/day", () => {
    expect(getAiDailyLimit(false, "ai_chat")).toBe(5);
  });

  test("pro chat quota is not subjected to the free 5/day cap", () => {
    expect(getAiDailyLimit(true, "ai_chat")).toBeGreaterThan(5);
  });

  test("disease detection has its own separate quota", () => {
    expect(getAiDailyLimit(false, "ai_disease")).toBe(3);
    expect(getAiDailyLimit(true, "ai_disease")).toBe(100);
    expect(getAiDailyLimit(false, "ai_disease")).not.toBe(getAiDailyLimit(false, "ai_chat"));
  });
});
