import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

// ============================================================
// Phase 9 — Payment History data-integrity regression tests
//
// The Payment History page previously rendered fabricated billing
// records (INV-001, "$500", Visa ••••4242, "Next Payment $5.00 in
// 15 days") and could generate PDFs / send emails for invoices that
// did not exist. These source-level guards lock the honest contract:
//
//  * No hardcoded invoice numbers, amounts, card numbers, or
//    fabricated payment dates may exist in the page.
//  * PDF/email actions must not be callable from the page unless a
//    real invoice object exists (none exists today).
//  * The page must read real billing state from the backend
//    (stripe.getStripeStatus + mobileMoney.getUserTransactions).
//  * Empty states must be honest ("No payment history yet.").
// ============================================================

const readPage = (): string =>
  readFileSync(new URL("../pages/PaymentHistory.tsx", import.meta.url), "utf8");

describe("PaymentHistory — no fabricated billing data", () => {
  const src = readPage();

  test("no hardcoded invoice records remain", () => {
    expect(src).not.toContain("Mock data for demonstration");
    expect(src).not.toContain("INV-001");
    expect(src).not.toContain("INV-002");
    expect(src).not.toContain("inv_1234567890");
    expect(src).not.toContain("inv_0987654321");
  });

  test("no hardcoded payment amounts remain", () => {
    // The old page hardcoded amountPaid: 500 / amountDue: 500 (and a
    // literal "$5.00" next-payment stat). Real amounts must only ever
    // come from stored payment records.
    expect(src).not.toContain("amountPaid: 500");
    expect(src).not.toContain("amountDue: 500");
    expect(src).not.toContain("Next Payment");
  });

  test("no fake card numbers or payment methods remain", () => {
    expect(src).not.toContain("4242");
    expect(src).not.toContain("pm_123");
    expect(src).not.toContain("paymentMethodLast4");
  });

  test("no fabricated payment dates / status transitions remain", () => {
    expect(src).not.toContain("statusTransitions");
    expect(src).not.toContain("nextPaymentAttempt");
    expect(src).not.toContain("hostedInvoiceUrl");
    expect(src).not.toContain("receiptUrl");
  });

  test("PDF generation and invoice emailing are not callable from the page", () => {
    // No invoice objects exist in the database, so the page must not
    // offer PDF/email actions for them.
    expect(src).not.toContain("generateInvoicePDF");
    expect(src).not.toContain("generateAllInvoicesPDF");
    expect(src).not.toContain("generateReceiptPDF");
    expect(src).not.toContain("sendInvoiceEmail");
    expect(src).not.toContain("Export All");
    expect(src).not.toContain("Download PDF");
    expect(src).not.toContain("Email Invoice");
  });

  test("the page reads real billing state from the backend", () => {
    expect(src).toContain("api.stripe.getStripeStatus");
    expect(src).toContain("api.mobileMoney.getUserTransactions");
  });

  test("empty states are honest about missing payment history", () => {
    expect(src).toContain("No payment history yet.");
    expect(src).toContain("Payments will appear here after you complete a payment");
  });

  test("plan/payment-method/failure stats are derived, not hardcoded", () => {
    // Plan label must come from the user record, not a constant.
    expect(src).toContain("user?.subscriptionTier");
    expect(src).toContain("stripeStatus?.stripeCurrentPeriodEnd");
    expect(src).toContain("stripeStatus?.paymentFailureCount");
    expect(src).not.toContain("value: \"$");
  });
});
