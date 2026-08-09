import { describe, test, expect } from "bun:test";
import { shouldApplyStatusUpdate } from "../convex/mobileMoney";
import { verifyWebhookSignature, computeWebhookSignature } from "../convex/mobileMoneyWebhook";
import { isAccountSuspended, isSubscriptionActive, isProActive } from "../convex/authHelpers";
import { getAiDailyLimit } from "../convex/aiAssistant";

// ============================================================
// P0 fix — mobile money status transitions are idempotent
// ============================================================

describe("shouldApplyStatusUpdate — payment idempotency", () => {
  test("pending -> completed is allowed (first completion)", () => {
    expect(shouldApplyStatusUpdate("pending", "completed")).toBe(true);
  });

  test("pending -> failed is allowed", () => {
    expect(shouldApplyStatusUpdate("pending", "failed")).toBe(true);
  });

  test("duplicate terminal update is a no-op (replayed webhook)", () => {
    expect(shouldApplyStatusUpdate("completed", "completed")).toBe(false);
    expect(shouldApplyStatusUpdate("failed", "failed")).toBe(false);
    expect(shouldApplyStatusUpdate("expired", "expired")).toBe(false);
  });

  test("a completed transaction is never altered (no downgrade via replay)", () => {
    expect(shouldApplyStatusUpdate("completed", "failed")).toBe(false);
    expect(shouldApplyStatusUpdate("completed", "expired")).toBe(false);
    expect(shouldApplyStatusUpdate("completed", "pending")).toBe(false);
  });

  test("missing/unknown current status allows the transition", () => {
    expect(shouldApplyStatusUpdate(undefined, "completed")).toBe(true);
  });
});

// ============================================================
// P0 fix — webhook authenticity (HMAC signature)
// ============================================================

describe("verifyWebhookSignature — webhook authenticity", () => {
  test("valid signature is accepted", async () => {
    const payload = JSON.stringify({ externalId: "abc", status: "SUCCESSFUL" });
    const secret = "test-secret";
    const sig = await computeWebhookSignature(payload, secret);
    expect(await verifyWebhookSignature(payload, sig, secret)).toBe(true);
  });

  test("tampered body is rejected", async () => {
    const secret = "test-secret";
    const sig = await computeWebhookSignature('{"status":"FAILED"}', secret);
    expect(await verifyWebhookSignature('{"status":"SUCCESSFUL"}', sig, secret)).toBe(false);
  });

  test("missing signature is rejected", async () => {
    expect(await verifyWebhookSignature('{"status":"SUCCESSFUL"}', null, "secret")).toBe(false);
  });

  test("wrong secret is rejected", async () => {
    const payload = '{"status":"SUCCESSFUL"}';
    const sig = await computeWebhookSignature(payload, "real-secret");
    expect(await verifyWebhookSignature(payload, sig, "wrong-secret")).toBe(false);
  });

  test("prefixed sha256= signature format is accepted", async () => {
    const payload = '{"status":"SUCCESSFUL"}';
    const sig = await computeWebhookSignature(payload, "secret");
    expect(await verifyWebhookSignature(payload, `sha256=${sig}`, "secret")).toBe(true);
  });
});

// ============================================================
// P1 fix — account suspension is enforced at the auth layer
// ============================================================

describe("isAccountSuspended", () => {
  test("returns true only when explicitly suspended", () => {
    expect(isAccountSuspended({ isSuspended: true })).toBe(true);
    expect(isAccountSuspended({ isSuspended: false })).toBe(false);
    expect(isAccountSuspended({})).toBe(false);
    expect(isAccountSuspended({ isSuspended: undefined })).toBe(false);
  });
});

// ============================================================
// P1 fix — subscription expiry is honored (tier alone is never enough)
// ============================================================

describe("isSubscriptionActive — expiry enforcement", () => {
  test("free tier is always active", () => {
    expect(isSubscriptionActive({ subscriptionTier: "free" })).toBe(true);
  });

  test("pro with a future end date is active", () => {
    expect(
      isSubscriptionActive({ subscriptionTier: "pro", subscriptionEndDate: Date.now() + 86400000 })
    ).toBe(true);
  });

  test("pro with a past end date is EXPIRED — no premium access", () => {
    expect(
      isSubscriptionActive({ subscriptionTier: "pro", subscriptionEndDate: Date.now() - 1000 })
    ).toBe(false);
  });

  test("pro without any end date is treated as expired (fail closed)", () => {
    expect(isSubscriptionActive({ subscriptionTier: "pro" })).toBe(false);
  });
});

// ============================================================
// P2 fix — free-tier resource limits (1 farm / 5 crops) are
// enforced against ACTIVE Pro entitlements, never a bare tier field
// ============================================================

describe("isProActive — free-tier limit gate", () => {
  test("free tier is never Pro-active", () => {
    expect(isProActive({ subscriptionTier: "free" })).toBe(false);
    expect(isProActive({})).toBe(false);
  });

  test("pro with a future end date (paid or in-trial) is active", () => {
    expect(
      isProActive({ subscriptionTier: "pro", subscriptionEndDate: Date.now() + 86400000 })
    ).toBe(true);
  });

  test("expired pro (tier field left behind after downgrade) is NOT active", () => {
    expect(
      isProActive({ subscriptionTier: "pro", subscriptionEndDate: Date.now() - 1000 })
    ).toBe(false);
  });

  test("pro with no end date fails closed — free limits apply", () => {
    expect(isProActive({ subscriptionTier: "pro" })).toBe(false);
  });
});

// ============================================================
// P2 fix — AI usage limits (free quota vs Pro)
// ============================================================

describe("getAiDailyLimit — AI usage quotas", () => {
  test("free users get a small daily chat allowance", () => {
    expect(getAiDailyLimit(false, "ai_chat")).toBe(5);
  });

  test("pro users get a large (near-unlimited) chat allowance", () => {
    expect(getAiDailyLimit(true, "ai_chat")).toBe(500);
  });

  test("disease detection is more tightly capped for free users", () => {
    expect(getAiDailyLimit(false, "ai_disease")).toBe(3);
    expect(getAiDailyLimit(true, "ai_disease")).toBe(100);
  });
});
