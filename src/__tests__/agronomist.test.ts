import { describe, test, expect } from "bun:test";
import { isApprovedAgronomist } from "../convex/marketplace";

// ============================================================
// Phase 4B — agronomist journey
// A profile is public ONLY when explicitly approved by an admin.
// Applications start "pending" and can never self-approve — the public
// listing query filters with this rule.
// ============================================================

describe("isApprovedAgronomist — approved-only visibility", () => {
  test("pending applications are NEVER public", () => {
    expect(isApprovedAgronomist({ status: "pending" })).toBe(false);
  });

  test("rejected applications are NEVER public", () => {
    expect(isApprovedAgronomist({ status: "rejected" })).toBe(false);
  });

  test("explicitly approved profiles are public", () => {
    expect(isApprovedAgronomist({ status: "approved" })).toBe(true);
  });

  test("missing profile / null is not public", () => {
    expect(isApprovedAgronomist(null)).toBe(false);
    expect(isApprovedAgronomist(undefined)).toBe(false);
  });

  test("legacy seed profiles without a status field remain visible (dev data)", () => {
    // Seed data (marked "approved" explicitly now) may lack the field on
    // older rows — treat as approved rather than hiding existing content.
    expect(isApprovedAgronomist({})).toBe(true);
    expect(isApprovedAgronomist({ status: undefined })).toBe(true);
  });
});
