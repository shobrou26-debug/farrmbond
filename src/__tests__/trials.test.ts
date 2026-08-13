import { describe, test, expect } from "bun:test";
import { canStartTrial } from "../convex/trials";

// ============================================================
// Release-candidate hardening — trial security.
//
// The single server-side rule behind startTrial:
//   - first-time users        → allowed
//   - trial already consumed  → denied (active or expired, new or legacy)
//   - paid Pro, then cancelled→ denied (must re-subscribe, never re-trial)
//   - expired Pro after paying→ denied
//   - anonymous/guest accounts→ denied (blocks account-churn farming)
//   - existing subscriptions  → unchanged by the rule
// ============================================================

const future = Date.now() + 24 * 60 * 60 * 1000;
const past = Date.now() - 1000;

describe("canStartTrial — server-side trial eligibility", () => {
  test("first-time user → trial allowed", () => {
    expect(canStartTrial({}, Date.now()).allowed).toBe(true);
    expect(canStartTrial({ subscriptionTier: "free" }, Date.now()).allowed).toBe(true);
  });

  test("trial already consumed (new flag) → denied", () => {
    const d = canStartTrial({ hasUsedTrial: true, subscriptionTier: "free" }, Date.now());
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason.length).toBeGreaterThan(0);
  });

  test("trial already consumed (legacy: trialEndDate + start date, downgraded) → denied", () => {
    const d = canStartTrial(
      { trialEndDate: past, subscriptionStartDate: past, subscriptionTier: "free" },
      Date.now()
    );
    expect(d.allowed).toBe(false);
  });

  test("active trial → denied", () => {
    const d = canStartTrial({ trialEndDate: future, subscriptionTier: "pro" }, Date.now());
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && "reason" in d ? d.reason : "").toContain("active trial");
  });

  test("paid Pro → cancelled → trial denied", () => {
    const d = canStartTrial(
      { hasEverPaid: true, subscriptionTier: "free", subscriptionEndDate: undefined, trialEndDate: undefined },
      Date.now()
    );
    expect(d.allowed).toBe(false);
  });

  test("expired Pro after previous payment → trial denied", () => {
    const d = canStartTrial(
      { hasEverPaid: true, subscriptionTier: "pro", subscriptionEndDate: past },
      Date.now()
    );
    expect(d.allowed).toBe(false);
  });

  test("anonymous / guest account → trial denied", () => {
    const d = canStartTrial({ isAnonymous: true, subscriptionTier: "free" }, Date.now());
    expect(d.allowed).toBe(false);
  });

  test("existing active subscription → denied (already on Pro)", () => {
    const d = canStartTrial(
      { subscriptionTier: "pro", subscriptionEndDate: future, hasEverPaid: true },
      Date.now()
    );
    expect(d.allowed).toBe(false);
  });

  test("a first-time user who merely looks at the page is unaffected", () => {
    // getTrialStatus is a query (no state change); only startTrial mutates,
    // and it re-checks canStartTrial. First-time users pass both gates.
    expect(canStartTrial({ subscriptionTier: "free" }, Date.now()).allowed).toBe(true);
  });
});
