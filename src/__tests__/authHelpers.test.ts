import { describe, expect, test } from "bun:test";
import {
  hasRole,
  hasAnyRole,
  hasSubscriptionTier,
  isSubscriptionActive,
  validateString,
  validateNumber,
  sanitizeInput,
  validateCoordinates,
} from "../convex/authHelpers";
import { ROLES } from "../convex/schema";

// ============================================================
// Role hierarchy (RBAC)
// ============================================================
describe("hasRole — role hierarchy", () => {
  test("admin passes admin check", () => {
    expect(hasRole(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
  });

  test("super_admin passes admin check", () => {
    expect(hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN)).toBe(true);
  });

  test("farmer fails admin check (farmer audit-log scope)", () => {
    expect(hasRole(ROLES.FARMER, ROLES.ADMIN)).toBe(false);
  });

  test("agronomist fails admin check", () => {
    expect(hasRole(ROLES.AGRONOMIST, ROLES.ADMIN)).toBe(false);
  });

  test("undefined role defaults to farmer", () => {
    expect(hasRole(undefined, ROLES.ADMIN)).toBe(false);
    expect(hasRole(undefined, ROLES.FARMER)).toBe(true);
  });

  test("farmer passes farmer check", () => {
    expect(hasRole(ROLES.FARMER, ROLES.FARMER)).toBe(true);
  });

  test("admin passes farmer check (hierarchy includes lower roles)", () => {
    expect(hasRole(ROLES.ADMIN, ROLES.FARMER)).toBe(true);
  });
});

describe("hasAnyRole — exact role membership", () => {
  test("matches an allowed role", () => {
    expect(hasAnyRole(ROLES.AGRONOMIST, [ROLES.FARMER, ROLES.AGRONOMIST])).toBe(true);
  });

  test("rejects non-matching roles", () => {
    expect(hasAnyRole(ROLES.FARMER, [ROLES.ADMIN, ROLES.AGRONOMIST])).toBe(false);
  });
});

// ============================================================
// Subscription gating
// ============================================================
describe("subscription helpers", () => {
  test("pro tier meets pro requirement", () => {
    expect(hasSubscriptionTier("pro", "pro")).toBe(true);
  });

  test("free tier fails pro requirement", () => {
    expect(hasSubscriptionTier("free", "pro")).toBe(false);
    expect(hasSubscriptionTier(undefined, "pro")).toBe(false);
  });

  test("free tier is always considered active", () => {
    expect(isSubscriptionActive({ subscriptionTier: "free" })).toBe(true);
    expect(isSubscriptionActive({})).toBe(true);
  });

  test("pro subscription is active before end date", () => {
    const future = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(
      isSubscriptionActive({ subscriptionTier: "pro", subscriptionEndDate: future })
    ).toBe(true);
  });

  test("pro subscription is inactive after end date", () => {
    const past = Date.now() - 24 * 60 * 60 * 1000;
    expect(
      isSubscriptionActive({ subscriptionTier: "pro", subscriptionEndDate: past })
    ).toBe(false);
  });
});

// ============================================================
// Input validation
// ============================================================
describe("validateString", () => {
  test("trims and returns valid string", () => {
    expect(validateString("  hello  ", "Name")).toBe("hello");
  });

  test("throws on empty string", () => {
    expect(() => validateString("   ", "Name")).toThrow(/cannot be empty/);
  });

  test("throws when exceeding max length", () => {
    expect(() => validateString("a".repeat(600), "Description", 500)).toThrow(
      /cannot exceed/
    );
  });
});

describe("validateNumber", () => {
  test("accepts numbers within bounds", () => {
    expect(validateNumber(5, "Amount", 0, 10)).toBe(5);
  });

  test("rejects NaN", () => {
    expect(() => validateNumber(NaN, "Amount")).toThrow(/valid number/);
  });

  test("rejects values below min", () => {
    expect(() => validateNumber(0, "Amount", 0.01)).toThrow(/at least/);
  });

  test("rejects values above max", () => {
    expect(() => validateNumber(101, "Percent", 0, 100)).toThrow(/at most/);
  });
});

describe("validateCoordinates", () => {
  test("accepts valid coordinates", () => {
    expect(() => validateCoordinates(-1.2921, 36.8219)).not.toThrow();
  });

  test("rejects latitude out of range", () => {
    expect(() => validateCoordinates(91, 36)).toThrow();
  });

  test("rejects longitude out of range", () => {
    expect(() => validateCoordinates(0, -181)).toThrow();
  });
});

describe("sanitizeInput", () => {
  test("strips HTML brackets and trims", () => {
    expect(sanitizeInput("  <script>alert(1)</script>  ")).toBe("scriptalert(1)/script");
  });

  test("leaves safe text unchanged", () => {
    expect(sanitizeInput("Tomato seedlings")).toBe("Tomato seedlings");
  });
});
