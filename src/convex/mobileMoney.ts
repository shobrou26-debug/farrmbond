import { action, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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
const AIRTEL_MONEY_PIN = process.env.AIRTEL_MONEY_PIN;

const APP_URL = process.env.APP_URL || "https://farmbond.com";

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

      // Log the transaction attempt
      await ctx.runMutation("mobileMoney:logTransaction" as any, {
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
        await ctx.runMutation("mobileMoney:updateTransactionStatus" as any, {
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

      // Log the transaction attempt
      await ctx.runMutation("mobileMoney:logTransaction" as any, {
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
        await ctx.runMutation("mobileMoney:updateTransactionStatus" as any, {
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
 * Log a mobile money transaction
 */
export const logTransaction = mutation({
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
 * Update transaction status
 */
export const updateTransactionStatus = mutation({
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
      .filter((q) => q.eq(q.field("referenceId"), args.referenceId))
      .first();

    if (!transaction) {
      console.error("Transaction not found:", args.referenceId);
      return;
    }

    const updates: Record<string, any> = {
      status: args.status,
      providerResponse: args.providerResponse,
      updatedAt: now,
    };

    if (args.status === "completed") {
      updates.completedAt = now;
    }

    await ctx.db.patch(transaction._id, updates);      // If payment successful, activate subscription
      if (args.status === "completed") {
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
