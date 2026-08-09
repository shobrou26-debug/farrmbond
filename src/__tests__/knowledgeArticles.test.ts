import { describe, test, expect } from "bun:test";
import { nextLikeCount } from "../convex/knowledgeArticles";

// ============================================================
// Phase 3 — article likes honesty
// toggleLike previously incremented on EVERY click (per-user state was
// checked but ignored), so one user could inflate an article's likes
// without bound. The new toggle records per-user state and computes the
// count with this pure helper.
// ============================================================

describe("nextLikeCount — like toggle arithmetic", () => {
  test("liking increments from the stored count", () => {
    expect(nextLikeCount(12, true)).toBe(13);
  });

  test("unliking decrements", () => {
    expect(nextLikeCount(12, false)).toBe(11);
  });

  test("unlike never goes below zero", () => {
    expect(nextLikeCount(0, false)).toBe(0);
    expect(nextLikeCount(undefined, false)).toBe(0);
  });

  test("missing/NaN stored count is treated as 0 (no NaN likes)", () => {
    expect(nextLikeCount(undefined, true)).toBe(1);
    expect(nextLikeCount(NaN, true)).toBe(1);
  });
});
