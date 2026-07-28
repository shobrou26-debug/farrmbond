import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

// ============================================================
// Mobile Money Webhook Handlers
// Receives payment status updates from MTN MoMo and Airtel Money
// ============================================================

/**
 * MTN MoMo Webhook Handler
 * Receives payment status updates when user approves/rejects payment
 */
export const mtnMoMoWebhook = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();

    console.log("MTN MoMo webhook received:", JSON.stringify(body, null, 2));

    // Extract reference ID from the webhook payload
    const referenceId = body.externalId || body.referenceId || body.financialTransactionId;

    if (!referenceId) {
      console.error("No reference ID found in MTN MoMo webhook");
      return new Response(
        JSON.stringify({ error: "Missing reference ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Map MTN status to our internal status
    const statusMap: Record<string, string> = {
      SUCCESSFUL: "completed",
      FAILED: "failed",
      REJECTED: "failed",
      TIMEOUT: "expired",
      PENDING: "pending",
    };

    const status = statusMap[body.status] || body.status;

    // Update transaction status in database
    await ctx.runMutation(api.mobileMoney.updateTransactionStatus, {
      referenceId: referenceId,
      status: status,
      providerResponse: body,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("MTN MoMo webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Airtel Money Webhook Handler
 * Receives payment status updates when user approves/rejects payment
 */
export const airtelMoneyWebhook = httpAction(async (ctx, request) => {
  try {
    const body = await request.json();

    console.log("Airtel Money webhook received:", JSON.stringify(body, null, 2));

    // Extract transaction ID from the webhook payload
    const transactionId = body.transactionId || body.reference || body.id;

    if (!transactionId) {
      console.error("No transaction ID found in Airtel Money webhook");
      return new Response(
        JSON.stringify({ error: "Missing transaction ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Map Airtel status to our internal status
    const statusMap: Record<string, string> = {
      SUCCESS: "completed",
      FAILED: "failed",
      REJECTED: "failed",
      EXPIRED: "expired",
      PENDING: "pending",
      INITIATED: "pending",
    };

    const status = statusMap[body.status] || body.status;

    // Update transaction status in database
    await ctx.runMutation(api.mobileMoney.updateTransactionStatus, {
      referenceId: transactionId,
      status: status,
      providerResponse: body,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Airtel Money webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

/**
 * Generic Mobile Money Webhook Handler
 * Routes to the appropriate provider handler based on URL parameter
 */
export const mobileMoneyWebhook = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") || "mtn";

  try {
    const body = await request.json();

    console.log(`Mobile Money webhook received (provider: ${provider}):`, JSON.stringify(body, null, 2));

    // Extract reference ID based on provider
    let referenceId: string | null = null;
    let status: string | null = null;

    if (provider === "airtel") {
      referenceId = body.transactionId || body.reference || body.id;
      const statusMap: Record<string, string> = {
        SUCCESS: "completed",
        FAILED: "failed",
        REJECTED: "failed",
        EXPIRED: "expired",
        PENDING: "pending",
        INITIATED: "pending",
      };
      status = statusMap[body.status] || body.status;
    } else {
      // MTN MoMo
      referenceId = body.externalId || body.referenceId || body.financialTransactionId;
      const statusMap: Record<string, string> = {
        SUCCESSFUL: "completed",
        FAILED: "failed",
        REJECTED: "failed",
        TIMEOUT: "expired",
        PENDING: "pending",
      };
      status = statusMap[body.status] || body.status;
    }

    if (!referenceId) {
      console.error("No reference ID found in webhook");
      return new Response(
        JSON.stringify({ error: "Missing reference ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update transaction status in database
    await ctx.runMutation(api.mobileMoney.updateTransactionStatus, {
      referenceId: referenceId,
      status: status || "pending",
      providerResponse: body,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Mobile Money webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
