import { describe, expect, test } from "bun:test";
import { mapUserForAdmin } from "../convex/admin";

// ============================================================
// P2-3 — Admin user listing
//
// The admin dashboard paginates the users table instead of loading
// the full collection. `mapUserForAdmin` is the pure mapper that
// shapes each row for the admin UI (only safe display fields).
// ============================================================

describe("mapUserForAdmin — safe admin-facing user shape", () => {
  test("maps the display fields", () => {
    const mapped = mapUserForAdmin({
      _id: "user-1" as never,
      name: "Jane Farmer",
      email: "jane@example.com",
      image: "https://example.com/a.jpg",
      role: "farmer",
      subscriptionTier: "pro",
      lastActiveAt: 1234,
      createdAt: 1000,
      country: "KE",
      phone: "+254700000000",
    });

    expect(mapped).toEqual({
      _id: "user-1" as never,
      name: "Jane Farmer",
      email: "jane@example.com",
      image: "https://example.com/a.jpg",
      role: "farmer",
      subscriptionTier: "pro",
      lastActiveAt: 1234,
      createdAt: 1000,
      country: "KE",
      phone: "+254700000000",
    });
  });

  test("defaults role and subscription tier for legacy users", () => {
    const mapped = mapUserForAdmin({
      _id: "user-2" as never,
      name: "Legacy User",
    });

    expect(mapped.role).toBe("farmer");
    expect(mapped.subscriptionTier).toBe("free");
  });

  test("only exposes the intended display fields (no private data leak)", () => {
    const mapped = mapUserForAdmin({
      _id: "user-3" as never,
      name: "Jane",
    });

    // Only the documented admin display fields may appear in the output.
    expect(Object.keys(mapped).sort()).toEqual(
      [
        "_id",
        "name",
        "email",
        "image",
        "role",
        "subscriptionTier",
        "lastActiveAt",
        "createdAt",
        "country",
        "phone",
      ].sort()
    );
  });
});
