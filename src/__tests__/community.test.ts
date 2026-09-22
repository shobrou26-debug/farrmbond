import { describe, test, expect } from "bun:test";
import {
  nextCommentCounts,
  moderationAuditChanges,
  nextModerationVisibility,
  extractHashtags,
  POST_CATEGORIES,
} from "../convex/community";

// ============================================================
// Community — pure rule invariants
// ============================================================

describe("community: comment counter floor rule", () => {
  test("decrementing a positive count stays positive", () => {
    expect(nextCommentCounts(5, 1)).toBe(4);
  });

  test("counter never goes negative (deleted-post race guard)", () => {
    expect(nextCommentCounts(0, 1)).toBe(0);
    expect(nextCommentCounts(1, 3)).toBe(0);
  });
});

describe("community: moderation audit payload", () => {
  test("hide actions record item_hidden with report count", () => {
    const payload = moderationAuditChanges({ action: "hide", reportsResolved: 3 });
    expect(payload.auditAction).toBe("item_hidden");
    expect(payload.reportsResolved).toBe(3);
  });

  test("restore actions record item_restored", () => {
    const payload = moderationAuditChanges({ action: "restore", reportsResolved: 0 });
    expect(payload.auditAction).toBe("item_restored");
    expect(payload.reportsResolved).toBe(0);
  });
});

describe("community: moderation visibility rule (regression guard)", () => {
  test("hide makes a visible post hidden; restore flips it back", () => {
    expect(nextModerationVisibility("hide", true).isApproved).toBe(false);
    expect(nextModerationVisibility("restore", false).isApproved).toBe(true);
  });

  test("unknown actions are invalid (never silently mutate)", () => {
    expect(nextModerationVisibility("delete", true).valid).toBe(false);
    expect(nextModerationVisibility("", true).valid).toBe(false);
  });
});

describe("community: hashtag extraction (composer contract)", () => {
  test("extracts hashtags from content", () => {
    expect(extractHashtags("great #maize season #farming")).toEqual(["maize", "farming"]);
  });

  test("caps extraction at max", () => {
    const tags = extractHashtags("#a #b #c #d #e #f #g", 5);
    expect(tags.length).toBe(5);
  });

  test("bare hash symbols are dropped", () => {
    expect(extractHashtags("# ### ok")).toEqual([]);
  });

  test("no hashtags returns empty", () => {
    expect(extractHashtags("no tags here")).toEqual([]);
  });
});

describe("community: category allowlist", () => {
  test("all UI composer categories are accepted by the backend", () => {
    const uiCategories = ["general", "crop_health", "market", "tips", "questions"];
    for (const c of uiCategories) {
      expect(POST_CATEGORIES).toContain(c);
    }
  });

  test("unexpected categories are not part of the allowlist", () => {
    expect(POST_CATEGORIES).not.toContain("politics");
  });
});
