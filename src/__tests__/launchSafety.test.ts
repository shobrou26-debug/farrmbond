// ============================================================
// Launch-safety guards — paid checkout withheld at the UI, while
// server-side Pro enforcement, the free trial, and read-only status
// surfaces stay fully intact. These are source-level wiring guards in
// the same style as the pawaPay gate tests (no DOM test harness in
// this repo).
// ============================================================
import { describe, test, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAiDailyLimit } from "../convex/aiAssistant";
import { PAID_CHECKOUT_ENABLED, CHECKOUT_UNAVAILABLE_NOTICE } from "../lib/checkout";

const settingsSrc = readFileSync(new URL("../pages/Settings.tsx", import.meta.url), "utf8");
const consultationsSrc = readFileSync(
  new URL("../pages/MyConsultations.tsx", import.meta.url),
  "utf8"
);
const aiSrc = readFileSync(new URL("../convex/aiAssistant.ts", import.meta.url), "utf8");
const satelliteSrc = readFileSync(new URL("../convex/satellite.ts", import.meta.url), "utf8");
const adminSrc = readFileSync(new URL("../convex/admin.ts", import.meta.url), "utf8");
const trialsSrc = readFileSync(new URL("../convex/trials.ts", import.meta.url), "utf8");

describe("paid checkout is withheld for launch", () => {
  test("the gate ships closed", () => {
    expect(PAID_CHECKOUT_ENABLED).toBe(false);
    expect(CHECKOUT_UNAVAILABLE_NOTICE.length).toBeGreaterThan(0);
  });

  test("Settings shows an unavailable notice instead of a broken checkout", () => {
    expect(settingsSrc).toContain("CHECKOUT_UNAVAILABLE_NOTICE");
    // The notice renders at the top of the Pro pricing card when closed.
    expect(settingsSrc).toMatch(
      /!PAID_CHECKOUT_ENABLED && \(\s*<div[^>]*role="status"[^>]*>[\s\S]{0,400}CHECKOUT_UNAVAILABLE_NOTICE/
    );
  });

  test("every purchase entry point in Settings is gated behind the flag", () => {
    // Stripe card checkout + mobile-money toggle block (free, no-trial users)
    expect(settingsSrc).toContain('tier === "free" && !canUseTrial && PAID_CHECKOUT_ENABLED');
    // Stripe billing portal button (paid users)
    expect(settingsSrc).toContain('tier === "pro" && PAID_CHECKOUT_ENABLED');
    // Stripe payment-failed retry block
    expect(settingsSrc).toContain("isPaid && hasPaymentFailed && PAID_CHECKOUT_ENABLED");
    // Stripe "Card on file" management block
    expect(settingsSrc).toContain("isPaid && PAID_CHECKOUT_ENABLED");
    // Mobile-money payment form (contains the MTN/Airtel pay button and the
    // pawaPay sandbox test section) is unreachable while the gate is closed
    expect(settingsSrc).toContain("PAID_CHECKOUT_ENABLED && showMobileMoney");
  });

  test("both payment-initiation handlers fail closed even if reached", () => {
    expect(settingsSrc).toMatch(
      /const handlePawaPay = async \(\) => \{\s*if \(!PAID_CHECKOUT_ENABLED\)/
    );
    const guards = settingsSrc.split("if (!PAID_CHECKOUT_ENABLED)").length - 1;
    expect(guards).toBeGreaterThanOrEqual(2);
  });

  test("the free trial and read-only status surfaces are NOT gated", () => {
    expect(settingsSrc).toContain("handleStartTrial");
    expect(settingsSrc).toMatch(/const handleStartTrial = async \(\) => \{\s*setIsStartingTrial\(true\)/);
    expect(settingsSrc).toContain("Start Free Trial");
    // Existing sandbox deposit status polling and history stay wired so the
    // already-completed payment keeps displaying.
    expect(settingsSrc).toContain("api.pawapay.checkPawapayDepositStatus");
    expect(settingsSrc).toContain("api.mobileMoney.getUserTransactions");
  });
});

describe("server-side Pro enforcement remains intact", () => {
  test("AI quotas are computed from server-side subscription state", () => {
    expect(aiSrc).toContain('subscriptionTier === "pro" && isSubscriptionActive(user)');
    expect(getAiDailyLimit(false, "ai_chat")).toBeLessThan(getAiDailyLimit(true, "ai_chat"));
    expect(getAiDailyLimit(false, "ai_disease")).toBeLessThan(
      getAiDailyLimit(true, "ai_disease")
    );
  });

  test("satellite NDVI stays pro-gated server-side", () => {
    expect(satelliteSrc).toContain('user.subscriptionTier !== "pro" || !isSubscriptionActive(user)');
  });

  test("admin subscription changes still require admin", () => {
    expect(adminSrc).toMatch(/updateUserSubscription[\s\S]{0,600}requireAdmin\(ctx\)/);
  });

  test("one-trial-ever server rule untouched", () => {
    expect(trialsSrc).toContain("hasUsedTrial === true || user.trialEndDate !== undefined");
  });
});

// ------------------------------------------------------------
// No payment loophole outside Settings: consultation checkout and a
// whole-app sweep over every action that can initiate a payment.
// ------------------------------------------------------------
describe("consultation checkout is gated consistently", () => {
  test("Pay Now button and payment modal are behind the flag", () => {
    expect(consultationsSrc).toContain(
      "needsPayment && !hasPendingPayment && PAID_CHECKOUT_ENABLED"
    );
    expect(consultationsSrc).toContain("PAID_CHECKOUT_ENABLED && showPayModal");
  });

  test("both consultation payment handlers fail closed even if reached", () => {
    expect(consultationsSrc).toMatch(
      /const handlePayClick = useCallback\(\(consultation: any\) => \{\s*if \(!PAID_CHECKOUT_ENABLED\)/
    );
    expect(consultationsSrc).toMatch(
      /const handleInitiatePayment = async \(\) => \{\s*if \(!PAID_CHECKOUT_ENABLED\)/
    );
  });

  test("free consultations and non-payment actions are preserved", () => {
    // Payment is only ever demanded for paid consultations — free ones
    // (amount 0) never showed a pay button and must stay that way.
    expect(consultationsSrc).toContain("consultation.amount > 0");
    // Viewing, Join, and Rate stay untouched.
    expect(consultationsSrc).toContain("Awaiting Confirmation");
    expect(consultationsSrc).toContain("Rate");
    // Read-only status polling stays wired.
    expect(consultationsSrc).toContain("api.mobileMoney.checkMtnPaymentStatus");
  });
});

describe("whole-app sweep: no ungated payment initiator exists", () => {
  // Any client file referencing one of these actions can START a payment
  // and must therefore reference PAID_CHECKOUT_ENABLED. Read-only status
  // actions (check*/getStripeStatus/getUserTransactions) are intentionally
  // excluded — they initiate nothing.
  const PAYMENT_INIT_MARKERS = [
    "initiateMtnPayment",
    "initiateAirtelPayment",
    "initiateConsultationPayment",
    "createCheckoutSession",
    "createPortalSession",
    "retryPayment",
    "initiatePawapayDeposit",
  ];
  const APP_DIRS = ["../pages", "../components", "../hooks", "../lib"];

  const collectFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collectFiles(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  };

  test("every payment-initiating client file is behind the gate", () => {
    const gated: string[] = [];
    const offenders: string[] = [];
    for (const appDir of APP_DIRS) {
      const abs = fileURLToPath(new URL(appDir, import.meta.url));
      for (const file of collectFiles(abs)) {
        const src = readFileSync(file, "utf8");
        const initiates = PAYMENT_INIT_MARKERS.some((m) => src.includes(m));
        if (!initiates) continue;
        if (src.includes("PAID_CHECKOUT_ENABLED")) gated.push(file);
        else offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
    // The sweep must actually find the two known gated surfaces — guards
    // against the walk silently matching nothing (e.g. broken paths).
    expect(gated.length).toBeGreaterThanOrEqual(2);
    expect(gated.some((f) => f.endsWith("Settings.tsx"))).toBe(true);
    expect(gated.some((f) => f.endsWith("MyConsultations.tsx"))).toBe(true);
  });
});
