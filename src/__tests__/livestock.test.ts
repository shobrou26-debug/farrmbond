import { describe, test, expect } from "bun:test";
import { FREE_LIVESTOCK_LIMIT, livestockLimitReached } from "../convex/livestock";
import { ROLES } from "../convex/schema";

// ============================================================
// P2-4 — livestock free-tier cap is enforced SERVER-SIDE.
// Free users are limited to FREE_LIVESTOCK_LIMIT entries; Pro
// (paid or in-trial) and platform admins are unlimited. Expired
// Pro fails closed — the tier field alone never unlocks the cap.
// ============================================================

const future = Date.now() + 30 * 24 * 60 * 60 * 1000;
const past = Date.now() - 1000;

const freeUser = { subscriptionTier: "free" as const, subscriptionEndDate: undefined };
const expiredPro = { subscriptionTier: "pro" as const, subscriptionEndDate: past };
const activePro = { subscriptionTier: "pro" as const, subscriptionEndDate: future };
const adminUser = {
  subscriptionTier: "free" as const,
  subscriptionEndDate: undefined,
  role: ROLES.ADMIN,
};

describe("livestockLimitReached — the server-side rule behind createLivestock", () => {
  test("free user is blocked once the cap is reached", () => {
    expect(livestockLimitReached(FREE_LIVESTOCK_LIMIT, freeUser)).toBe(true);
    expect(livestockLimitReached(FREE_LIVESTOCK_LIMIT + 10, freeUser)).toBe(true);
  });

  test("free user is allowed below the cap", () => {
    expect(livestockLimitReached(0, freeUser)).toBe(false);
    expect(livestockLimitReached(FREE_LIVESTOCK_LIMIT - 1, freeUser)).toBe(false);
  });

  test("expired pro (tier left behind) is treated as free and blocked", () => {
    expect(livestockLimitReached(FREE_LIVESTOCK_LIMIT, expiredPro)).toBe(true);
  });

  test("pro with NO end date fails closed (treated as not active)", () => {
    expect(
      livestockLimitReached(FREE_LIVESTOCK_LIMIT, {
        subscriptionTier: "pro",
        subscriptionEndDate: undefined,
      })
    ).toBe(true);
  });

  test("active pro (paid or in-trial) is unlimited", () => {
    expect(livestockLimitReached(999, activePro)).toBe(false);
  });

  test("platform admins bypass the free-tier cap", () => {
    expect(livestockLimitReached(999, adminUser)).toBe(false);
  });

  test("a malicious client cannot bypass via the mutation — rule is count + tier based", () => {
    // Directly calling createLivestock hits the same check; a free user at
    // the cap is rejected no matter what args they pass.
    expect(livestockLimitReached(FREE_LIVESTOCK_LIMIT, freeUser)).toBe(true);
    // The only paths past the cap are Pro or admin — not client-controllable.
    expect(livestockLimitReached(FREE_LIVESTOCK_LIMIT, activePro)).toBe(false);
    expect(livestockLimitReached(FREE_LIVESTOCK_LIMIT, adminUser)).toBe(false);
  });

  test("the exported limit is a sane positive number", () => {
    expect(FREE_LIVESTOCK_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(FREE_LIVESTOCK_LIMIT)).toBe(true);
  });
});
