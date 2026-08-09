import { describe, test, expect } from "bun:test";
import {
  buildUpcomingTasksFromCalendar,
  deriveRisks,
  dueLabel,
} from "../convex/weeklyReport";

// ============================================================
// Phase 4 verification — weekly report data honesty
// The generator previously hardcoded upcoming tasks ("Harvest Zone A
// tomatoes") and risks ("Pest outbreak") as if they were real farm data.
// These helpers now derive content ONLY from real calendar/intelligence
// data; empty inputs yield empty output.
// ============================================================

const DAY = 24 * 60 * 60 * 1000;

describe("buildUpcomingTasksFromCalendar — real tasks only", () => {
  const now = Date.now();

  test("empty calendar → no invented upcoming tasks", () => {
    expect(buildUpcomingTasksFromCalendar([], now)).toEqual([]);
    expect(buildUpcomingTasksFromCalendar(undefined, now)).toEqual([]);
  });

  test("only future, incomplete events become tasks (nearest first)", () => {
    const tasks = buildUpcomingTasksFromCalendar(
      [
        { title: "Harvest maize", startDate: now + 3 * DAY, isCompleted: false },
        { title: "Irrigate tomatoes", startDate: now + DAY, isCompleted: false },
        { title: "Past planting task", startDate: now - 5 * DAY, isCompleted: false },
        { title: "Already completed", startDate: now + 2 * DAY, isCompleted: true },
      ],
      now
    );
    expect(tasks.map((t) => t.task)).toEqual(["Irrigate tomatoes", "Harvest maize"]);
    expect(tasks[0].due).toBe("Tomorrow");
  });

  test("tasks are capped at five", () => {
    const events = Array.from({ length: 9 }, (_, i) => ({
      title: `Task ${i}`,
      startDate: now + (i + 1) * DAY,
      isCompleted: false,
    }));
    expect(buildUpcomingTasksFromCalendar(events, now)).toHaveLength(5);
  });

  test("dueLabel renders honest relative labels", () => {
    expect(dueLabel(now, now)).toBe("Today");
    expect(dueLabel(now + DAY, now)).toBe("Tomorrow");
    expect(dueLabel(now + 3 * DAY, now)).toBe("In 3 days");
  });
});

describe("deriveRisks — real signals only", () => {
  test("no health score or satellite data → no fabricated risks", () => {
    expect(deriveRisks(null, null)).toEqual([]);
    expect(deriveRisks({}, {})).toEqual([]);
    expect(deriveRisks({ waterStress: false }, { riskFactors: undefined })).toEqual([]);
  });

  test("real intelligence risk factors become risks", () => {
    const risks = deriveRisks(
      { waterStress: false },
      { riskFactors: ["Low soil fertility", "Irregular rainfall"], riskLevel: "high" }
    );
    expect(risks.map((r) => r.risk)).toEqual(["Low soil fertility", "Irregular rainfall"]);
    expect(risks[0].level).toBe("high");
    expect(risks.every((r) => typeof r.mitigation === "string")).toBe(true);
  });

  test("real satellite water stress adds a high risk", () => {
    const risks = deriveRisks({ waterStress: true }, null);
    expect(risks).toHaveLength(1);
    expect(risks[0].risk).toContain("Water stress");
    expect(risks[0].level).toBe("high");
  });

  test("duplicate risk texts are collapsed", () => {
    const risks = deriveRisks(
      { waterStress: true },
      { riskFactors: ["Drought"], riskLevel: "high" }
    );
    const droughts = risks.filter((r) => r.risk === "Drought");
    expect(droughts).toHaveLength(1);
  });
});
