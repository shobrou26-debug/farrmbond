import { action, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// ============================================================
// Mobile Money Integration (MTN MoMo & Airtel Money)
// For African farmers to pay subscriptions via mobile money
// ============================================================

// Environment variables for MTN MoMo API
const MTN_MOMO_API_URL = process.env.MTN_MOMO_API_URL || "https://sandbox.momodeveloper.mtn.com";
const MTN_MOMO_API_KEY = process.env.MTN_MOMO_API_KEY;
const MTN_MOMO_API_USER = process.env.MTN_MOMO_API_USER;
const MTN_MOMO_SUBSCRIPTION_KEY = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
const MTN_MOMO_ENVIRONMENT = process.env.MTN_MOMO_ENVIRONMENT || "sandbox"; // sandbox or production

// Environment variables for Airtel Money API
const AIRTEL_MONEY_API_URL = process.env.AIRTEL_MONEY_API_URL || "https://openapi.airtel.africa";
const AIRTEL_MONEY_CLIENT_ID = process.env.AIRTEL_MONEY_CLIENT_ID;
const AIRTEL_MONEY_CLIENT_SECRET = process.env.AIRTEL_MONEY_CLIENT_SECRET;

const APP_URL = process.env.APP_URL || "https://farmbond.com";

// A Pro subscription month is $5 — enforced at grant time so an underpriced
// or tampered payment can never activate Pro.
export const SUB_PRICE_USD = 5;

/**
 * Extract the provider-confirmed amount from a provider response if present
 * (MTN returns `amount` at top level; Airtel nests it under `data`).
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

/**
 * True only when the confirmed payment amount covers the full subscription
 * price. Missing/unparseable amounts fail closed (never grant Pro).
 */
export function isFullPricedSubscriptionPayment(
  amount: number | null | undefined
): boolean {
  return typeof amount === "number" && !isNaN(amount) && amount >= SUB_PRICE_USD;
}

// ============================================================
// MTN MoMo Integration
// ============================================================

/**
 * Generate MTN MoMo API access token
 */
async function getMtnAccessToken(): Promise<string> {
  if (!MTN_MOMO_API_KEY || !MTN_MOMO_API_USER) {
    throw new Error("MTN MoMo API credentials not configured");
  }

  const response = await fetch(
    `${MTN_MOMO_API_URL}/collection/token/`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${MTN_MOMO_API_USER}:${MTN_MOMO_API_KEY}`).toString("base64")}`,
        "Ocp-Apim-Subscription-Key": MTN_MOMO_SUBSCRIPTION_KEY || "",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get MTN MoMo access token");
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Initiate MTN MoMo Collection (Request to Pay)
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

    // Validate phone number format (MTN MoMo requires international format)
    const cleanPhone = args.phoneNumber.replace(/\s/g, "").replace(/^\+/, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error("Invalid phone number format");
    }

    // Generate reference ID
    const referenceId = `FARMBOND-${userId}-${Date.now()}`;
    const externalId = `SUB-${Date.now()}`;

    try {
      const accessToken = await getMtnAccessToken();

      const response = await fetch(
        `${MTN_MOMO_API_URL}/collection/v1_0/requesttopay`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Reference-Id": referenceId,
            "X-Target-Environment": MTN_MOMO_ENVIRONMENT,
            "Ocp-Apim-Subscription-Key": MTN_MOMO_SUBSCRIPTION_KEY || "",
            "X-Callback-Url": `${APP_URL}/api/momo/webhook`,
            "X-Callback-Host": APP_URL,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: args.amount.toString(),
            currency: args.currency,
            externalId: externalId,
            payer: {
              partyIdType: "MSISDN",
              partyId: cleanPhone,
            },
            payerMessage: args.description || "FarmBond Pro Subscription",
            payeeNote: `Payment from ${args.name} for FarmBond subscription`,
          }),
        }
      );

      if (!response.ok && response.status !== 202) {
        const error = await response.text();
        console.error("MTN MoMo request failed:", error);
        throw new Error("Failed to initiate mobile money payment");
      }

      // Log the transaction attempt (internal mutation — the caller's
      // identity is resolved from the authenticated action session, never
      // from client-supplied userId)
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
      console.error("MTN MoMo error:", error);
      throw error;
    }
  },
});

/**
 * Check MTN MoMo payment status
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
        `${MTN_MOMO_API_URL}/collection/v1_0/requesttopay/${args.referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Target-Environment": MTN_MOMO_ENVIRONMENT,
            "Ocp-Apim-Subscription-Key": MTN_MOMO_SUBSCRIPTION_KEY || "",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check payment status");
      }

      const data = await response.json();

      // Update transaction status
      if (data.status === "SUCCESSFUL" || data.status === "FAILED") {
        // Ownership check: only the user who initiated the transaction may
        // poll and settle it. Prevents settling another user's transaction.
        const txn = await ctx.runQuery(internal.mobileMoney.getTransactionByReference, {
          referenceId: args.referenceId,
        });
        if (!txn || txn.userId !== userId) {
          throw new Error("Transaction not found");
        }
        await ctx.runMutation(internal.mobileMoney.updateTransactionStatus, {
          referenceId: args.referenceId,
          status: data.status === "SUCCESSFUL" ? "completed" : "failed",
          providerResponse: data,
        });
      }

      return {
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        externalId: data.externalId,
        reason: data.reason,
      };
    } catch (error) {
      console.error("MTN status check error:", error);
      throw error;
    }
  },
});

// ============================================================
// Airtel Money Integration
// ============================================================

/**
 * Get Airtel Money access token
 */
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
    throw new Error("Failed to get Airtel Money access token");
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Initiate Airtel Money Collection (Customer Push)
 */
export const initiateAirtelPayment = action({
  args: {
    amount: v.number(),
    currency: v.string(),
    phoneNumber: v.string(),
    email: v.string(),
    name: v.string(),
    countryCode: v.string(), // e.g., "KE", "UG", "TZ", "NG"
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    // Validate phone number format
    const cleanPhone = args.phoneNumber.replace(/\s/g, "").replace(/^\+/, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      throw new Error("Invalid phone number format");
    }

    // Generate transaction reference
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
        const error = await response.text();
        console.error("Airtel Money request failed:", error);
        throw new Error("Failed to initiate Airtel Money payment");
      }

      const data = await response.json();

      // Log the transaction attempt (internal mutation — caller identity is
      // resolved from the authenticated action session)
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
      console.error("Airtel Money error:", error);
      throw error;
    }
  },
});

/**
 * Check Airtel Money payment status
 */
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
        throw new Error("Failed to check payment status");
      }

      const data = await response.json();

      // Update transaction status
      if (data.data?.status === "SUCCESS" || data.data?.status === "FAILED") {
        // Ownership check: only the initiator may settle their transaction.
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
      console.error("Airtel status check error:", error);
      throw error;
    }
  },
});

// ============================================================
// Common Queries & Mutations
// ============================================================

/**
 * Internal: look up a transaction by provider reference ID.
 * Used by the authenticated status-check actions to verify the caller owns
 * the transaction before settling it. Not exposed to the client.
 */
export const getTransactionByReference = internalQuery({
  args: { referenceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_reference", (q) => q.eq("referenceId", args.referenceId))
      .first();
  },
});

export type MobileMoneyStatus = "pending" | "completed" | "failed" | "expired";

const TERMINAL_STATUSES: MobileMoneyStatus[] = ["completed", "failed", "expired"];

/**
 * Pure idempotency rule for a status transition.
 * - Re-applying the same terminal status is a no-op (duplicate webhook).
 * - A completed transaction is never altered (no downgrade/refund via replay).
 */
export function shouldApplyStatusUpdate(
  currentStatus: string | undefined,
  incomingStatus: string
): boolean {
  if (currentStatus === incomingStatus) return false;
  if (currentStatus === "completed") return false;
  return true;
}

/**
 * Log a mobile money transaction.
 * INTERNAL ONLY — callable from authenticated actions (which resolve the
 * userId from the session), never directly from the client. This closes the
 * vector where any signed-in user could insert arbitrary transactions.
 */
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
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update transaction status.
 * INTERNAL ONLY — reachable from signature-verified webhooks and from the
 * authenticated status-check actions after an ownership check. A client can
 * never call this directly, which closes the Pro self-grant bypass.
 * Idempotent: duplicate/terminal updates are ignored and a completed
 * transaction is never modified.
 */
export const updateTransactionStatus = internalMutation({
  args: {
    referenceId: v.string(),
    status: v.string(),
    providerResponse: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find the transaction by referenceId
    const transaction = await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_reference", (q) => q.eq("referenceId", args.referenceId))
      .first();

    if (!transaction) {
      console.error("Transaction not found:", args.referenceId);
      return { updated: false, reason: "not_found" };
    }

    // Idempotency: ignore duplicate terminal updates; never alter a
    // completed transaction (blocks replay/downgrade attacks).
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

    // If payment successful, activate subscription (only on the first
    // transition to completed — idempotency guard above prevents re-grants)
    if (args.status === "completed") {
      // Price guard: the provider-confirmed amount (when echoed) must cover
      // the full $5 month. An underpriced payment is recorded as completed
      // but NEVER grants Pro — a $0.01 poke must not unlock premium.
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

      // Activate subscription directly via db patch
      await ctx.db.patch(transaction.userId, {
        subscriptionTier: "pro",
        subscriptionStartDate: now,
        subscriptionEndDate: subscriptionEndDate.getTime(),
        paymentMethodVerified: true,
        paymentFailedAt: undefined,
        paymentFailureCount: 0,
        trialEndDate: undefined,
        updatedAt: now,
      });

      // Log audit
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

/**
 * Get user's mobile money transactions
 */
export const getUserTransactions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const transactions = await ctx.db
      .query("mobileMoneyTransactions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();

    return transactions;
  },
});

/**
 * Get supported mobile money providers by country
 */
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

/**
 * Get mobile money stats for a user
 */
export const getMobileMoneyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const transactions = await ctx.db
      .query("mobileMoneyTransactions")
      .filter((q) => q.eq(q.field("userId"), userId))
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
