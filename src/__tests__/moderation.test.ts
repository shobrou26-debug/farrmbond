import { describe, test, expect } from "bun:test";
import { nextModerationVisibility } from "../convex/community";
import { nextPublishState } from "../convex/knowledgeArticles";

// ============================================================
// Phase 4D — community moderation
// ============================================================

describe("nextModerationVisibility — hide/restore rule", () => {
  test("hide makes a visible post hidden", () => {
    expect(nextModerationVisibility("hide", true)).toEqual({ isApproved: false, valid: true });
  });

  test("restore makes a hidden post visible again", () => {
    expect(nextModerationVisibility("restore", false)).toEqual({ isApproved: true, valid: true });
  });

  test("unknown actions are invalid (never silently mutate)", () => {
    expect(nextModerationVisibility("ban", true).valid).toBe(false);
    expect(nextModerationVisibility("", true).valid).toBe(false);
  });
});

// ============================================================
// Phase 4C — knowledge article publish state
// ============================================================

describe("nextPublishState — publish/unpublish rule", () => {
  test("publishing an unpublished article stamps publishedAt", () => {
    const state = nextPublishState(false, true);
    expect(state.isPublished).toBe(true);
    expect(state.publishedAt).toBeTypeOf("number");
  });

  test("re-publishing an already published article keeps the original publishedAt", () => {
    const state = nextPublishState(true, true);
    expect(state.isPublished).toBe(true);
    expect("publishedAt" in state).toBe(false);
  });

  test("unpublishing removes it from the public listing", () => {
    const state = nextPublishState(true, false);
    expect(state.isPublished).toBe(false);
  });
});
