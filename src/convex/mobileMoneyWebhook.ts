import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================================
// Mobile Money Webhook Handlers
// Receives payment status updates from MTN MoMo and Airtel Money
//
// SECURITY: These endpoints are public on the internet, so they MUST NOT be
// trusted. Every handler verifies an HMAC-SHA256 signature of the raw body
// against MOBILE_MONEY_WEBHOOK_SECRET (sent by the provider in the
// x-farmbond-signature header). If the secret is not configured the
// endpoint fails CLOSED (503), and invalid signatures are rejected (401).
// ============================================================

const WEBHOOK_SECRET = process.env.MOBILE_MONEY_WEBHOOK_SECRET;

/**
 * Pure-ish helper (Web Crypto) — computes the expected HMAC-SHA256 hex
 * signature for a raw payload using the configured secret.
 */
export async function computeWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a webhook payload signature (constant-time via Web Crypto).
 * Returns true only when the signature matches and is well-formed.
 */
export async function verifyWebhookSignature(
  payload: string,
  signatureHex: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHex) return false;
  const expected = await computeWebhookSignature(payload, secret);
  const actual = signatureHex.toLowerCase().replace(/^sha256=/, "");
  if (actual.length !== expected.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Shared pre-flight: verify the request is genuine.
 * Returns a Response to reject with, or null when the request is authentic.
 */
async function authenticateWebhook(request: Request, rawBody: string): Promise<Response | null> {
  if (!WEBHOOK_SECRET) {
    return new Response(
      JSON.stringify({ error: "Webhook secret not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  const signature = request.headers.get("x-farmbond-signature");
  const valid = await verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}

/**
 * MTN MoMo Webhook Handler
 * Receives payment status updates when user approves/rejects payment
 */
export const mtnMoMoWebhook = httpAction(async (ctx, request) => {
  try {
    const rawBody = await request.text();
    const rejected = await authenticateWebhook(request, rawBody);
    if (rejected) return rejected;
    const body = JSON.parse(rawBody);

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
    await ctx.runMutation(internal.mobileMoney.updateTransactionStatus, {
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
    const rawBody = await request.text();
    const rejected = await authenticateWebhook(request, rawBody);
    if (rejected) return rejected;
    const body = JSON.parse(rawBody);

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
    await ctx.runMutation(internal.mobileMoney.updateTransactionStatus, {
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
    const rawBody = await request.text();
    const rejected = await authenticateWebhook(request, rawBody);
    if (rejected) return rejected;
    const body = JSON.parse(rawBody);

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
    await ctx.runMutation(internal.mobileMoney.updateTransactionStatus, {
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
