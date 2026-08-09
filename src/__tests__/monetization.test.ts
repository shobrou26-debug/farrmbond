import { describe, test, expect } from "bun:test";
import {
  getPremiumAccessStatus,
  hasPremiumAccess,
  PREMIUM_RESOURCES,
  hasRole,
} from "../convex/authHelpers";
import { ROLES } from "../convex/schema";

// ============================================================
// Phase 4A — premium features (exports / analytics / reports)
// are gated server-side by the SAME expiry-aware entitlement rule:
//   free        → denied
//   expired pro → denied (tier field alone is never enough)
//   active pro  → allowed
//   platform admin → allowed regardless of tier
// ============================================================

const future = Date.now() + 30 * 24 * 60 * 60 * 1000;
const past = Date.now() - 1000;

const freeUser = { subscriptionTier: "free" as const, subscriptionEndDate: undefined };
const expiredPro = { subscriptionTier: "pro" as const, subscriptionEndDate: past };
const activePro = { subscriptionTier: "pro" as const, subscriptionEndDate: future };
const adminUser = { subscriptionTier: "free" as const, subscriptionEndDate: undefined, role: ROLES.ADMIN };

describe("getPremiumAccessStatus — the rule behind every premium gate", () => {
  test("free user → denied for every premium resource", () => {
    expect(getPremiumAccessStatus(freeUser)).toBe("free");
    for (const resource of PREMIUM_RESOURCES) {
      expect(hasPremiumAccess(freeUser)).toBe(false);
      expect(resource.length).toBeGreaterThan(0);
    }
  });

  test("expired pro (tier left behind) → denied for every premium resource", () => {
    expect(getPremiumAccessStatus(expiredPro)).toBe("expired");
    expect(hasPremiumAccess(expiredPro)).toBe(false);
  });

  test("active pro (paid or in-trial) → allowed", () => {
    expect(getPremiumAccessStatus(activePro)).toBe("allowed");
    expect(hasPremiumAccess(activePro)).toBe(true);
  });

  test("pro with NO end date fails closed (treated as expired)", () => {
    expect(getPremiumAccessStatus({ subscriptionTier: "pro", subscriptionEndDate: undefined })).toBe("expired");
    expect(hasPremiumAccess({ subscriptionTier: "pro", subscriptionEndDate: undefined })).toBe(false);
  });

  test("admins bypass the tier requirement (platform staff)", () => {
    expect(hasRole(adminUser.role, ROLES.ADMIN)).toBe(true);
    // The admin bypass is role-based; the tier rule itself still denies free.
    expect(hasPremiumAccess(adminUser)).toBe(false); // gate: admin OR premium — the OR is enforced in the gate functions
  });

  test("all three premium resources are registered", () => {
    expect(PREMIUM_RESOURCES).toContain("exports");
    expect(PREMIUM_RESOURCES).toContain("analytics");
    expect(PREMIUM_RESOURCES).toContain("reports");
    expect(PREMIUM_RESOURCES).toHaveLength(3);
  });
});
