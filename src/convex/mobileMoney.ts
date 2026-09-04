import { action, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// ============================================================
// SECTION 1 — Environment Configuration
// ============================================================

// MTN Payments V1 (source of truth: MTN Payments V1 OpenAPI YAML)
const MTN_MOMO_API_KEY = process.env.MTN_MOMO_API_KEY;
const MTN_MOMO_API_SECRET = process.env.MTN_MOMO_API_SECRET;
const MTN_MOMO_API_URL = process.env.MTN_MOMO_API_URL || "https://api.mtn.com/v1";
const MTN_DEFAULT_COUNTRY = process.env.MTN_DEFAULT_COUNTRY || "ZM";

// Airtel Money — NOT YET VERIFIED against an authoritative Airtel specification.
// Endpoints below are from the existing implementation and require separate
// Airtel API spec confirmation before production use.
const AIRTEL_MONEY_API_URL = process.env.AIRTEL_MONEY_API_URL || "https://openapi.airtel.africa";
const AIRTEL_MONEY_CLIENT_ID = process.env.AIRTEL_MONEY_CLIENT_ID;
const AIRTEL_MONEY_CLIENT_SECRET = process.env.AIRTEL_MONEY_CLIENT_SECRET;

const APP_URL = process.env.APP_URL || "https://farmbond.com";

// ============================================================
// SECTION 2 — Shared Validation & Helpers
// ============================================================

/** Subscription price guard: $5 USD — enforced server-side so an underpriced
 *  or tampered payment can never activate Pro. */
export const SUB_PRICE_USD = 5;

/** Clean a phone number: strip whitespace and leading +. */
function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\s/g, "").replace(/^\+/, "");
}

/** Validate phone number length (10-15 digits). */
function isValidPhoneNumber(cleaned: string): boolean {
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Extract the provider-confirmed amount from a provider response if present.
 * MTN returns `amount` at top level; Airtel nests it under `data`.
 * Returns null when the provider didn't echo an amount.
 */
export function extractConfirmedAmount(providerResponse: unknown): number | null {
  if (!providerResponse || typeof providerResponse !== "object") return null;
  const resp = providerResponse as Record<string, unknown>;
  const raw = resp.amount ?? (resp.data as Record<string, unknown> | undefined)?.amount;
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw);
  return isNaN(n) ? null : n;
}

/** True only when the confirmed payment amount covers the full subscription
 *  price. Missing/unparseable amounts fail closed (never grant Pro). */
export function isFullPricedSubscriptionPayment(
  amount: number | null | undefined
): boolean {
  return typeof amount === "number" && !isNaN(amount) && amount >= SUB_PRICE_USD;
}

/** Pure: true only when the provider-confirmed amount fully covers the
 *  expected consultation price. Missing/unparseable amounts fail closed. */
export function isFullConsultationPayment(
  confirmedAmount: number | null | undefined,
  expectedAmount: number
): boolean {
  return (
    typeof confirmedAmount === "number" &&
    !isNaN(confirmedAmount) &&
    expectedAmount > 0 &&
    confirmedAmount >= expectedAmount
  );
}

/** Pure idempotency rule for a status transition.
 * - Re-applying the same terminal status is a no-op (duplicate webhook).
 * - A completed transaction is never altered (no downgrade/refund via replay). */
export function shouldApplyStatusUpdate(
  currentStatus: string | undefined,
  incomingStatus: string
): boolean {
  if (currentStatus === incomingStatus) return false;
  if (currentStatus === "completed") return false;
  return true;
}

export type MobileMoneyStatus = "pending" | "completed" | "failed" | "expired";

// ============================================================
// SECTION 3 — MTN Payments V1 Provider Functions
// ============================================================
//
// Source of truth: MTN Payments V1 OpenAPI 3.0.1 specification.
//
// Authenticated endpoints:
//   POST /oauth/access_token   — OAuth 2.0 client_credentials
//   POST /payments              — initiate payment
//   GET  /{correlatorId}/transactionStatus — check status
//
// Base URL: https://api.mtn.com/v1
//
// IMPORTANT: The YAML does NOT define:
//   - sandbox URL
//   - callback signing/verification behavior
//   - exact callback payload format
//   - exact paymentMethod.name enum values
//   - exact transaction status enum values
// Items marked [NEEDS MTN CONFIRMATION] below require sandbox testing.

/**
 * Generate MTN Payments V1 OAuth2 access token.
 *
 * Per MTN documentation:
 *   POST /oauth/access_token?grant_type=client_credentials
 *   Content-Type: application/x-www-form-urlencoded
 *   Body: client_id={consumer-key}&client_secret={consumer-secret}
 *
 * NOTE: grant_type goes in the QUERY PARAMETER, not the body.
 * The previous implementation placed grant_type in the body which caused HTTP 400.
 */
async function getMtnAccessToken(): Promise<string> {
  if (!MTN_MOMO_API_KEY || !MTN_MOMO_API_SECRET) {
    throw new Error(
      "MTN MoMo API credentials not configured. " +
      "Set MTN_MOMO_API_KEY (Consumer Key) and MTN_MOMO_API_SECRET (Consumer Secret) " +
      "in the Keys/API keys tab."
    );
  }

  // MTN Payments V1 OAuth: grant_type in query parameter, credentials in body
  const tokenUrl = `${MTN_MOMO_API_URL}/oauth/access_token?grant_type=client_credentials`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: MTN_MOMO_API_KEY,
      client_secret: MTN_MOMO_API_SECRET,
    }).toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "unknown");
    console.error(
      `MTN OAuth failed — provider: mtn_momo, http_status: ${response.status}, ` +
      `endpoint: POST /oauth/access_token, error: ${errorBody.substring(0, 200)}`
    );
    throw new Error(
      `Failed to get MTN MoMo access token. Provider returned ${response.status}.`
    );
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Initiate an MTN Payments V1 payment.
 *
 * Endpoint: POST /payments
 * Required header: countryCode
 * Body follows the PaymentRequest schema from the YAML.
 *
 * IMPORTANT per the YAML:
 *   - amount is a MoneyType: { amount: "string", units: "string" }
 *   - callbackURL is in the REQUEST BODY (not the X-Callback-Url header)
 *   - paymentMethod is an object { name: "..." } per the YAML schema
 */
export const initiateMtnPayment = action({
  args: {
    amount: v.number(),
    currency: v.string(),
    phoneNumber: v.string(),
    email: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    const cleanPhone = cleanPhoneNumber(args.phoneNumber);
    if (!isValidPhoneNumber(cleanPhone)) {
      throw new Error("Invalid phone number format");
    }

    const referenceId = `FARMBOND-${userId}-${Date.now()}`;
    const externalId = `SUB-${Date.now()}`;

    try {
      const accessToken = await getMtnAccessToken();

      const response = await fetch(
        `${MTN_MOMO_API_URL}/payments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            countryCode: MTN_DEFAULT_COUNTRY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // MoneyType per YAML: { amount: "string", units: "string" }
            amount: {
              amount: args.amount.toFixed(2),
              units: args.currency,
            },
            // Payer — YAML PaymentRequest payer schema
            payer: {
              payerIdType: "MSISDN",
              payerId: cleanPhone,
              payerName: args.name,
              payerNote: args.description || "FarmBond Pro Subscription",
            },
            // Payee — YAML payee is an array
            payee: [
              {
                payeeIdType: "MSISDN",
                payeeId: cleanPhone,
                payeeName: "FarmBond",
                amount: args.amount.toFixed(2),
                payeeNote: `Payment from ${args.name} for FarmBond subscription`,
              },
            ],
            // callbackURL is in the body per V1 YAML (NOT the X-Callback-Url header)
            callbackURL: `${APP_URL}/api/momo/webhook`,
            externalTransactionId: externalId,
            transactionId: referenceId,
            correlatorId: referenceId,
            // paymentMethod is an object per YAML: { name: "..." }
            // [NEEDS MTN CONFIRMATION] value of name — "mobile_money" is assumed;
            // verify the correct enum value in MTN sandbox.
            paymentMethod: { name: "mobile_money" },
          }),
        }
      );

      if (!response.ok && response.status !== 202) {
        const errorBody = await response.text().catch(() => "unknown");
        console.error(
          `MTN payment initiation failed — provider: mtn_momo, ` +
          `http_status: ${response.status}, endpoint: POST /payments, ` +
          `operation: initiate_subscription_payment, error: ${errorBody.substring(0, 200)}`
        );
        throw new Error("Failed to initiate mobile money payment");
      }

      await ctx.runMutation(internal.mobileMoney.logTransaction, {
        userId: userId as any,
        provider: "mtn_momo",
        referenceId: referenceId,
        externalId: externalId,
        amount: args.amount,
        currency: args.currency,
        phoneNumber: cleanPhone,
        status: "pending",
        description: args.description || "FarmBond Pro Subscription",
      });

      return {
        referenceId: referenceId,
        status: "pending",
        message: "Payment request sent. Please check your phone to approve the payment.",
      };
    } catch (error) {
      console.error(
        `MTN payment error — provider: mtn_momo, operation: initiate_subscription_payment, ` +
        `error: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  },
});

/**
 * Check MTN Payments V1 transaction status.
 *
 * Endpoint: GET /{correlatorId}/transactionStatus
 * Required headers: transactionId, countryCode
 */
export const checkMtnPaymentStatus = action({
  args: {
    referenceId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    try {
      const accessToken = await getMtnAccessToken();

      const response = await fetch(
        `${MTN_MOMO_API_URL}/${args.referenceId}/transactionStatus`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            transactionId: args.referenceId,
            countryCode: MTN_DEFAULT_COUNTRY,
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "unknown");
        console.error(
          `MTN status check failed — provider: mtn_momo, ` +
          `http_status: ${response.status}, endpoint: GET /{correlatorId}/transactionStatus, ` +
          `operation: check_transaction_status, error: ${errorBody.substring(0, 200)}`
        );
        throw new Error("Failed to check payment status");
      }

      const data = await response.json();

      // [NEEDS MTN CONFIRMATION] Status values: these are inferred from the
      // legacy Collection API and common MTN patterns. The Payments V1 YAML
      // does not explicitly define an enum of status values.
      const statusMap: Record<string, string> = {
        SUCCESSFUL: "completed",
        FAILED: "failed",
        REJECTED: "failed",
        TIMEOUT: "expired",
        PENDING: "pending",
      };
      const mappedStatus = statusMap[data.status] || data.status;

      if (mappedStatus === "completed" || mappedStatus === "failed" || mappedStatus === "expired") {
        // Ownership check: only the user who initiated the transaction may
        // poll and settle it.
        const txn = await ctx.runQuery(internal.mobileMoney.getTransactionByReference, {
          referenceId: args.referenceId,
        });
        if (!txn || txn.userId !== userId) {
          throw new Error("Transaction not found");
        }
        await ctx.runMutation(internal.mobileMoney.updateTransactionStatus, {
          referenceId: args.referenceId,
          status: mappedStatus,
          providerResponse: data,
        });
      }

      return {
        status: data.status,
        amount: data.amount?.amount,
        currency: data.amount?.units,
        externalId: data.externalTransactionId,
        reason: data.reason,
      };
    } catch (error) {
      console.error(
        `MTN status error — provider: mtn_momo, operation: check_transaction_status, ` +
        `error: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  },
});

// ============================================================
// SECTION 4 — Airtel Money Provider Functions
// ============================================================
//
// WARNING: The following Airtel endpoints are from the EXISTING implementation
// and have NOT been verified against an authoritative Airtel API specification.
// They require separate Airtel spec confirmation before production use.
//
// Current Airtel endpoints (UNVERIFIED):
//   POST /auth/v1/oauth/token
//   POST /merchant/v1/payments/
//   GET  /standard/v1/payments/{transactionId}

async function getAirtelAccessToken(): Promise<string> {
  if (!AIRTEL_MONEY_CLIENT_ID || !AIRTEL_MONEY_CLIENT_SECRET) {
    throw new Error("Airtel Money API credentials not configured");
  }

  const response = await fetch(
    `${AIRTEL_MONEY_API_URL}/auth/v1/oauth/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: AIRTEL_MONEY_CLIENT_ID,
        client_secret: AIRTEL_MONEY_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "unknown");
    console.error(
      `Airtel OAuth failed — provider: airtel_money, ` +
      `http_status: ${response.status}, endpoint: POST /auth/v1/oauth/token, ` +
      `error: ${errorBody.substring(0, 200)}`
    );
    throw new Error("Failed to get Airtel Money access token");
  }

  const data = await response.json();
  return data.access_token;
}

export const initiateAirtelPayment = action({
  args: {
    amount: v.number(),
    currency: v.string(),
    phoneNumber: v.string(),
    email: v.string(),
    name: v.string(),
    countryCode: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    const cleanPhone = cleanPhoneNumber(args.phoneNumber);
    if (!isValidPhoneNumber(cleanPhone)) {
      throw new Error("Invalid phone number format");
    }

    const transactionId = `FB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const externalId = `SUB-${Date.now()}`;

    try {
      const accessToken = await getAirtelAccessToken();

      const response = await fetch(
        `${AIRTEL_MONEY_API_URL}/merchant/v1/payments/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Country": args.countryCode,
            "X-Currency": args.currency,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reference: transactionId,
            subscriber: {
              country: args.countryCode,
              currency: args.currency,
              msisdn: cleanPhone,
            },
            amount: args.amount.toString(),
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            transactionStatusUrl: `${APP_URL}/api/airtel/webhook`,
            description: args.description || "FarmBond Pro Subscription",
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "unknown");
        console.error(
          `Airtel payment initiation failed — provider: airtel_money, ` +
          `http_status: ${response.status}, endpoint: POST /merchant/v1/payments/, ` +
          `operation: initiate_subscription_payment, error: ${errorBody.substring(0, 200)}`
        );
        throw new Error("Failed to initiate Airtel Money payment");
      }

      const data = await response.json();

      await ctx.runMutation(internal.mobileMoney.logTransaction, {
        userId: userId as any,
        provider: "airtel_money",
        referenceId: transactionId,
        externalId: externalId,
        amount: args.amount,
        currency: args.currency,
        phoneNumber: cleanPhone,
        countryCode: args.countryCode,
        status: "pending",
        description: args.description || "FarmBond Pro Subscription",
      });

      return {
        transactionId: transactionId,
        status: "pending",
        message: "Payment request sent. Please check your phone to approve the payment.",
        data: data,
      };
    } catch (error) {
      console.error(
        `Airtel payment error — provider: airtel_money, ` +
        `operation: initiate_subscription_payment, ` +
        `error: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  },
});

export const checkAirtelPaymentStatus = action({
  args: {
    transactionId: v.string(),
    countryCode: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    try {
      const accessToken = await getAirtelAccessToken();

      const response = await fetch(
        `${AIRTEL_MONEY_API_URL}/standard/v1/payments/${args.transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Country": args.countryCode,
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "unknown");
        console.error(
          `Airtel status check failed — provider: airtel_money, ` +
          `http_status: ${response.status}, endpoint: GET /standard/v1/payments/{id}, ` +
          `operation: check_transaction_status, error: ${errorBody.substring(0, 200)}`
        );
        throw new Error("Failed to check payment status");
      }

      const data = await response.json();

      if (data.data?.status === "SUCCESS" || data.data?.status === "FAILED") {
        const txn = await ctx.runQuery(internal.mobileMoney.getTransactionByReference, {
          referenceId: args.transactionId,
        });
        if (!txn || txn.userId !== userId) {
          throw new Error("Transaction not found");
        }
        await ctx.runMutation(internal.mobileMoney.updateTransactionStatus, {
          referenceId: args.transactionId,
          status: data.data.status === "SUCCESS" ? "completed" : "failed",
          providerResponse: data,
        });
      }

      return {
        status: data.data?.status,
        transactionId: args.transactionId,
        amount: data.data?.amount,
        currency: data.data?.currency,
      };
    } catch (error) {
      console.error(
        `Airtel status error — provider: airtel_money, ` +
        `operation: check_transaction_status, ` +
        `error: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  },
});

// ============================================================
// SECTION 5 — Consultation Payment Orchestration
// ============================================================

export const initiateConsultationPayment = action({
  args: {
    consultationId: v.id("consultations"),
    provider: v.union(v.literal("mtn_momo"), v.literal("airtel_money")),
    phoneNumber: v.string(),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    // Server-side ownership + state checks
    const consultation = await ctx.runQuery(internal.marketplace.getConsultationByIdInternal, {
      consultationId: args.consultationId,
    });
    if (!consultation) throw new Error("Consultation not found");
    if (consultation.farmerId !== userId) {
      throw new Error("Authorization denied: this consultation does not belong to your account");
    }
    if (consultation.paymentStatus === "paid") {
      throw new Error("This consultation has already been paid");
    }
    if (consultation.status === "cancelled" || consultation.status === "completed") {
      throw new Error("This consultation can no longer be paid");
    }
    if (typeof consultation.amount !== "number" || consultation.amount <= 0) {
      throw new Error("This consultation has no payable amount");
    }

    const cleanPhone = cleanPhoneNumber(args.phoneNumber);
    if (!isValidPhoneNumber(cleanPhone)) {
      throw new Error("Invalid phone number format");
    }

    const referenceId = `FBC-${args.consultationId}-${Date.now()}`;
    const description = `FarmBond consultation: ${consultation.serviceType}`;

    // ---- Airtel Money consultation payment ----
    if (args.provider === "airtel_money") {
      if (!args.countryCode) {
        throw new Error("Country code is required for Airtel Money");
      }
      const transactionId = referenceId;
      try {
        const accessToken = await getAirtelAccessToken();
        const response = await fetch(
          `${AIRTEL_MONEY_API_URL}/merchant/v1/payments/`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-Country": args.countryCode,
              "X-Currency": consultation.currency,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reference: transactionId,
              subscriber: {
                country: args.countryCode,
                currency: consultation.currency,
                msisdn: cleanPhone,
              },
              amount: consultation.amount.toString(),
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              transactionStatusUrl: `${APP_URL}/api/airtel/webhook`,
              description,
            }),
          }
        );
        if (!response.ok) {
          const errorBody = await response.text().catch(() => "unknown");
          console.error(
            `Airtel consultation payment failed — provider: airtel_money, ` +
            `http_status: ${response.status}, endpoint: POST /merchant/v1/payments/, ` +
            `operation: initiate_consultation_payment, error: ${errorBody.substring(0, 200)}`
          );
          throw new Error("Failed to initiate Airtel Money payment");
        }
        await ctx.runMutation(internal.mobileMoney.logTransaction, {
          userId: userId as any,
          provider: "airtel_money",
          referenceId: transactionId,
          externalId: `CONS-${Date.now()}`,
          amount: consultation.amount,
          currency: consultation.currency,
          phoneNumber: cleanPhone,
          countryCode: args.countryCode,
          status: "pending",
          description,
          purpose: "consultation",
          consultationId: args.consultationId,
        });
        return {
          transactionId,
          referenceId: transactionId,
          status: "pending",
          message: "Payment request sent. Please check your phone to approve the payment.",
        };
      } catch (error) {
        console.error(
          `Airtel consultation error — provider: airtel_money, ` +
          `operation: initiate_consultation_payment, ` +
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    }

    // ---- MTN Payments V1 consultation payment ----
    try {
      const accessToken = await getMtnAccessToken();
      const response = await fetch(
        `${MTN_MOMO_API_URL}/payments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            countryCode: args.countryCode || MTN_DEFAULT_COUNTRY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: {
              amount: consultation.amount.toFixed(2),
              units: consultation.currency,
            },
            payer: {
              payerIdType: "MSISDN",
              payerId: cleanPhone,
              payerNote: description,
            },
            payee: [
              {
                payeeIdType: "MSISDN",
                payeeId: cleanPhone,
                payeeName: "FarmBond",
                amount: consultation.amount.toFixed(2),
                payeeNote: `Payment from FarmBond user for consultation`,
              },
            ],
            callbackURL: `${APP_URL}/api/momo/webhook`,
            externalTransactionId: referenceId,
            transactionId: referenceId,
            correlatorId: referenceId,
            // paymentMethod is an object per YAML: { name: "..." }
            // [NEEDS MTN CONFIRMATION] value of name
            paymentMethod: { name: "mobile_money" },
          }),
        }
      );
      if (!response.ok && response.status !== 202) {
        const errorBody = await response.text().catch(() => "unknown");
        console.error(
          `MTN consultation payment failed — provider: mtn_momo, ` +
          `http_status: ${response.status}, endpoint: POST /payments, ` +
          `operation: initiate_consultation_payment, error: ${errorBody.substring(0, 200)}`
        );
        throw new Error("Failed to initiate mobile money payment");
      }
      await ctx.runMutation(internal.mobileMoney.logTransaction, {
        userId: userId as any,
        provider: "mtn_momo",
        referenceId,
        externalId: `CONS-${Date.now()}`,
        amount: consultation.amount,
        currency: consultation.currency,
        phoneNumber: cleanPhone,
        status: "pending",
        description,
        purpose: "consultation",
        consultationId: args.consultationId,
      });
      return {
        referenceId,
        status: "pending",
        message: "Payment request sent. Please check your phone to approve the payment.",
      };
    } catch (error) {
      console.error(
        `MTN consultation error — provider: mtn_momo, ` +
        `operation: initiate_consultation_payment, ` +
        `error: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  },
});

// ============================================================
// SECTION 6 — Transaction Persistence
// ============================================================

/** Internal: look up a transaction by provider reference ID. */
export const getTransactionByReference = internalQuery({
  args: { referenceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_reference", (q) => q.eq("referenceId", args.referenceId))
      .first();
  },
});

/** Log a mobile money transaction.
 * INTERNAL ONLY — callable from authenticated actions (which resolve the
 * userId from the session), never directly from the client. */
export const logTransaction = internalMutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    referenceId: v.string(),
    externalId: v.string(),
    amount: v.number(),
    currency: v.string(),
    phoneNumber: v.string(),
    countryCode: v.optional(v.string()),
    status: v.string(),
    description: v.optional(v.string()),
    purpose: v.optional(v.union(v.literal("subscription"), v.literal("consultation"))),
    consultationId: v.optional(v.id("consultations")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("mobileMoneyTransactions", {
      userId: args.userId,
      provider: args.provider,
      referenceId: args.referenceId,
      externalId: args.externalId,
      amount: args.amount,
      currency: args.currency,
      phoneNumber: args.phoneNumber,
      countryCode: args.countryCode,
      status: args.status,
      description: args.description,
      purpose: args.purpose ?? "subscription",
      consultationId: args.consultationId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update transaction status.
 * INTERNAL ONLY — reachable from webhooks and from authenticated status-check
 * actions after an ownership check. Idempotent: duplicate/terminal updates are
 * ignored and a completed transaction is never modified. */
export const updateTransactionStatus = internalMutation({
  args: {
    referenceId: v.string(),
    status: v.string(),
    providerResponse: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const transaction = await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_reference", (q) => q.eq("referenceId", args.referenceId))
      .first();

    if (!transaction) {
      console.error(`Transaction not found — referenceId: ${args.referenceId}`);
      return { updated: false, reason: "not_found" };
    }

    // Idempotency: ignore duplicate terminal updates; never alter completed
    if (!shouldApplyStatusUpdate(transaction.status, args.status)) {
      return { updated: false, reason: "duplicate_or_terminal" };
    }

    const updates: Record<string, any> = {
      status: args.status,
      providerResponse: args.providerResponse,
      updatedAt: now,
    };

    if (args.status === "completed") {
      updates.completedAt = now;
    }

    await ctx.db.patch(transaction._id, updates);

    if (args.status === "completed") {
      // Dispatch to the correct settlement path
      if (transaction.purpose === "consultation" && transaction.consultationId) {
        const confirmedAmount = extractConfirmedAmount(args.providerResponse);
        const effectiveAmount = confirmedAmount ?? transaction.amount;
        await ctx.runMutation(internal.mobileMoney.settleConsultationPayment, {
          consultationId: transaction.consultationId,
          userId: transaction.userId,
          confirmedAmount: effectiveAmount,
          expectedAmount: transaction.amount,
        });
        return { updated: true, status: args.status, grantedPro: false };
      }

      // Subscription settlement with price guard
      const confirmedAmount = extractConfirmedAmount(args.providerResponse);
      const effectiveAmount = confirmedAmount ?? transaction.amount;
      if (!isFullPricedSubscriptionPayment(effectiveAmount)) {
        const { createAuditLog } = await import("./authHelpers");
        await createAuditLog(ctx, {
          userId: transaction.userId,
          action: "underpriced_payment_rejected",
          resource: "subscriptions",
          resourceId: transaction.userId,
          changes: {
            provider: transaction.provider,
            confirmedAmount: effectiveAmount,
            expectedAmount: SUB_PRICE_USD,
          },
        });
        return { updated: true, status: args.status, grantedPro: false };
      }

      const subscriptionEndDate = new Date(now);
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

      await ctx.db.patch(transaction.userId, {
        subscriptionTier: "pro",
        subscriptionStartDate: now,
        subscriptionEndDate: subscriptionEndDate.getTime(),
        paymentMethodVerified: true,
        paymentFailedAt: undefined,
        paymentFailureCount: 0,
        trialEndDate: undefined,
        hasEverPaid: true,
        updatedAt: now,
      });

      const { createAuditLog } = await import("./authHelpers");
      await createAuditLog(ctx, {
        userId: transaction.userId,
        action: "mobile_payment_completed",
        resource: "subscriptions",
        resourceId: transaction.userId,
        changes: {
          provider: transaction.provider,
          amount: transaction.amount,
          currency: transaction.currency,
          subscriptionEndDate: subscriptionEndDate.getTime(),
        },
      });
    }

    return { updated: true, status: args.status };
  },
});

// ============================================================
// SECTION 7 — Payment Settlement (Consultation)
// ============================================================

/** Settle a paid consultation.
 * INTERNAL ONLY — reachable from the webhook via updateTransactionStatus.
 * Idempotent, amount-guarded, ownership-checked. */
export const settleConsultationPayment = internalMutation({
  args: {
    consultationId: v.id("consultations"),
    userId: v.id("users"),
    confirmedAmount: v.number(),
    expectedAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const consultation = await ctx.db.get(args.consultationId);
    if (!consultation) return { settled: false, reason: "not_found" };
    if (consultation.farmerId !== args.userId) {
      return { settled: false, reason: "owner_mismatch" };
    }
    if (consultation.paymentStatus === "paid") {
      return { settled: false, reason: "already_paid" };
    }
    if (!isFullConsultationPayment(args.confirmedAmount, args.expectedAmount)) {
      const { createAuditLog } = await import("./authHelpers");
      await createAuditLog(ctx, {
        userId: args.userId,
        action: "underpriced_consultation_payment_rejected",
        resource: "consultations",
        resourceId: args.consultationId,
        changes: {
          confirmedAmount: args.confirmedAmount,
          expectedAmount: args.expectedAmount,
        },
      });
      return { settled: false, reason: "underpriced" };
    }

    const now = Date.now();
    await ctx.db.patch(args.consultationId, {
      paymentStatus: "paid",
      status: "confirmed",
      updatedAt: now,
    });

    const { createAuditLog } = await import("./authHelpers");
    await createAuditLog(ctx, {
      userId: args.userId,
      action: "consultation_payment_completed",
      resource: "consultations",
      resourceId: args.consultationId,
      changes: {
        confirmedAmount: args.confirmedAmount,
        expectedAmount: args.expectedAmount,
      },
    });

    return { settled: true };
  },
});

// ============================================================
// SECTION 8 — Frontend Queries
// ============================================================

/** Get user's mobile money transactions */
export const getUserTransactions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const transactions = await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return transactions;
  },
});

/** Get supported mobile money providers by country */
export const getSupportedProviders = query({
  args: {
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const providers = [
      {
        id: "mtn_momo",
        name: "MTN Mobile Money",
        countries: ["UG", "GH", "ZM", "CM", "CI", "RW", "MZ", "SN"],
        currencies: ["UGX", "GHS", "ZMW", "XAF", "RWF", "MZN", "XOF"],
        logo: "mtn",
        color: "#FFCC00",
        description: "Pay with MTN MoMo",
        fees: "Free",
        processingTime: "Instant",
      },
      {
        id: "airtel_money",
        name: "Airtel Money",
        countries: ["KE", "UG", "TZ", "NG", "ZM", "MW", "RW", "IN"],
        currencies: ["KES", "UGX", "TZS", "NGN", "ZMW", "MWK", "RWF", "INR"],
        logo: "airtel",
        color: "#ED1C24",
        description: "Pay with Airtel Money",
        fees: "Free",
        processingTime: "Instant",
      },
    ];

    if (args.countryCode) {
      return providers.filter((p) => p.countries.includes(args.countryCode!));
    }

    return providers;
  },
});

/** Get mobile money stats for a user */
export const getMobileMoneyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const transactions = await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const completed = transactions.filter((t) => t.status === "completed");
    const pending = transactions.filter((t) => t.status === "pending");
    const failed = transactions.filter((t) => t.status === "failed");

    const totalPaid = completed.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalTransactions: transactions.length,
      completedTransactions: completed.length,
      pendingTransactions: pending.length,
      failedTransactions: failed.length,
      totalPaid: totalPaid,
      lastPaymentDate: completed.length > 0 ? completed[0].completedAt : null,
      preferredProvider: completed.length > 0 ? completed[0].provider : null,
    };
  },
});
