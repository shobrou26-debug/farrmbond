import { describe, test, expect } from "bun:test";
import {
  shouldApplyStatusUpdate,
  isFullPricedSubscriptionPayment,
  isFullConsultationPayment,
  extractConfirmedAmount,
} from "../convex/mobileMoney";

// ============================================================
// Consolidated payment-settlement invariants (pure rules):
// status-transition idempotency, both price guards, and
// provider-amount echo extraction.
// ============================================================

describe("payment settlement — status transition idempotency", () => {
  test("failed -> completed is allowed (successful retry/reversal)", () => {
    expect(shouldApplyStatusUpdate("failed", "completed")).toBe(true);
  });

  test("expired -> completed is allowed", () => {
    expect(shouldApplyStatusUpdate("expired", "completed")).toBe(true);
  });

  test("pending -> expired is allowed", () => {
    expect(shouldApplyStatusUpdate("pending", "expired")).toBe(true);
  });

  test("a failed transaction is not silently marked failed again, but may move to completed", () => {
    expect(shouldApplyStatusUpdate("failed", "failed")).toBe(false);
    expect(shouldApplyStatusUpdate("failed", "expired")).toBe(true);
  });

  test("unknown incoming status still applies (never settles unless completed)", () => {
    expect(shouldApplyStatusUpdate("pending", "weird_provider_status")).toBe(true);
  });
});

describe("payment settlement — full-price subscription guard ($5 USD)", () => {
  test("exact $5 passes", () => {
    expect(isFullPricedSubscriptionPayment(5)).toBe(true);
  });

  test("overpayment passes (never blocks a customer who paid more)", () => {
    expect(isFullPricedSubscriptionPayment(7.5)).toBe(true);
  });

  test("just under $5 fails closed", () => {
    expect(isFullPricedSubscriptionPayment(4.999)).toBe(false);
  });

  test("NaN fails closed", () => {
    expect(isFullPricedSubscriptionPayment(NaN)).toBe(false);
  });
});

describe("payment settlement — consultation price guard", () => {
  test("exact expected amount settles the consultation", () => {
    expect(isFullConsultationPayment(2500, 2500)).toBe(true);
  });

  test("overpayment settles the consultation", () => {
    expect(isFullConsultationPayment(3000, 2500)).toBe(true);
  });

  test("underpriced consultation payment is rejected", () => {
    expect(isFullConsultationPayment(2000, 2500)).toBe(false);
  });

  test("missing confirmed amount fails closed", () => {
    expect(isFullConsultationPayment(null, 2500)).toBe(false);
    expect(isFullConsultationPayment(undefined, 2500)).toBe(false);
  });

  test("NaN confirmed amount fails closed", () => {
    expect(isFullConsultationPayment(NaN, 2500)).toBe(false);
  });

  test("zero or negative expected amount fails closed", () => {
    expect(isFullConsultationPayment(1000, 0)).toBe(false);
    expect(isFullConsultationPayment(1000, -5)).toBe(false);
  });
});

describe("payment settlement — provider amount echo extraction", () => {
  test("numeric top-level amount is returned as-is", () => {
    expect(extractConfirmedAmount({ amount: 5 })).toBe(5);
  });

  test("string top-level amount is parsed", () => {
    expect(extractConfirmedAmount({ amount: "12.50" })).toBe(12.5);
  });

  test("Airtel-style nested data.amount is read", () => {
    expect(extractConfirmedAmount({ data: { amount: "2500" } })).toBe(2500);
  });

  test("empty object returns null", () => {
    expect(extractConfirmedAmount({})).toBe(null);
  });

  test("garbage input returns null rather than throwing", () => {
    expect(extractConfirmedAmount(undefined)).toBe(null);
    expect(extractConfirmedAmount(42)).toBe(null);
    expect(extractConfirmedAmount(true)).toBe(null);
  });

  test("non-numeric amount string returns null", () => {
    expect(extractConfirmedAmount({ amount: "abc" })).toBe(null);
  });
});
