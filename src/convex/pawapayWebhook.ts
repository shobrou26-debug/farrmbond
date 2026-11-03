import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  buildSignatureBase,
  contentDigestMatches,
  fetchDepositStatus,
  fetchPawaPayPublicKey,
  isSignatureFresh,
  isValidUuidV4,
  parseSignatureInput,
  verifyRfc9421SignatureDetailed,
} from "./pawapay";

// ============================================================
// pawaPay Webhook Handler (SANDBOX)
//
// Receives signed deposit callbacks (RFC 9421) per
// https://docs.pawapay.io/v2/docs/signatures and
// https://docs.pawapay.io/v2/api-reference/deposits/deposit-callback
//
// SECURITY MODEL — fail closed at every gate, in order:
//   1. PAWAPAY_API_TOKEN must be configured (503 otherwise — the public key
//      cannot be fetched, so verification is impossible).
//   2. Signature / Signature-Input / Content-Digest headers must be present
//      (401 otherwise — signed callbacks are required from day one).
//   3. Content-Digest must match the raw body (RFC 9530, sha-256/sha-512).
//   4. Signature-Input created/expires must be fresh (±5 min skew).
//   5. The RFC 9421 signature base must rebuild cleanly from the request's
//      method/authority/path/headers and verify against pawaPay's PUBLIC
//      key fetched from GET /v2/public-key/http (401/502 otherwise).
//   6. The body must carry a valid UUIDv4 depositId (400 otherwise).
//   7. The deposit is then INDEPENDENTLY re-fetched from pawaPay's official
//      status API (GET /v2/deposits/{depositId}) — the callback body alone
//      is NEVER treated as proof of payment (502 if the recheck fails).
//   8. Only then is it handed to internal.pawapay.applyDepositStatus,
//      which validates deposit/amount/ZMW/ZMB/provider/purpose match and
//      routes through the shared, idempotent updateTransactionStatus
//      mutation (existing price guard; terminal states immutable).
//
// The callback body is never logged. Errors log only depositId/reason.
//
// DIAGNOSTIC (temporary): every 401 rejection carries a non-secret `gate`
// id in its response body and logs `[PawaPayWebhook] rejected gate=<id>`.
// Gate name only — never headers, tokens, keys, signature material, or
// callback bodies. Verification behavior is unchanged.
// ============================================================

const PAWAPAY_API_TOKEN = process.env.PAWAPAY_API_TOKEN;

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Reject with a stable gate identifier: same 401 as before, plus a
 *  non-secret `gate` tag in the body and in the deployment logs. */
function gate401(gate: string, error: string): Response {
  console.log(`[PawaPayWebhook] rejected gate=${gate}`);
  return jsonResponse(401, { error, gate });
}

export const pawaPayWebhook = httpAction(async (ctx, request) => {
  const rawBody = await request.text();

  // Gate 1 — configuration present (verification impossible otherwise).
  if (!PAWAPAY_API_TOKEN) {
    return jsonResponse(503, { error: "pawaPay not configured" });
  }

  // Gate 2 — required RFC 9421 headers.
  const signature = request.headers.get("Signature");
  const signatureInput = request.headers.get("Signature-Input");
  const contentDigest = request.headers.get("Content-Digest");
  if (!signature || !signatureInput || !contentDigest) {
    return gate401(
      "missing_headers",
      "Missing signature headers — enable signed callbacks in the pawaPay Dashboard"
    );
  }

  // Gate 3 — content integrity (tamper detection on the exact raw bytes).
  const digestOk = await contentDigestMatches(rawBody, contentDigest);
  if (!digestOk) {
    return gate401("digest_mismatch", "Content digest mismatch");
  }

  // Parse the Signature-Input parameters.
  const parsed = parseSignatureInput(signatureInput);
  if (!parsed) {
    return gate401("malformed_signature_input", "Malformed Signature-Input");
  }

  // Gate 4 — freshness window.
  if (!isSignatureFresh(parsed.created, parsed.expires, Date.now())) {
    return gate401("freshness", "Signature expired or not yet valid");
  }

  // Gate 5 — rebuild the signature base and verify against pawaPay's key.
  const url = new URL(request.url);
  const signatureBase = buildSignatureBase(parsed, {
    method: request.method,
    authority: url.host,
    path: url.pathname,
    getHeader: (name) => request.headers.get(name),
  });
  if (!signatureBase) {
    return gate401("signature_base", "Could not rebuild signature base");
  }

  if (!parsed.keyid) {
    return gate401("missing_keyid", "Signature-Input missing keyid");
  }

  let publicKeyPem: string | null;
  try {
    publicKeyPem = await fetchPawaPayPublicKey(parsed.keyid);
  } catch {
    // Key discovery unavailable — cannot verify, so fail closed.
    return jsonResponse(502, { error: "Signature verification unavailable" });
  }
  if (!publicKeyPem) {
    return gate401("unknown_keyid", "Unknown signing key");
  }

  const { ok: verified, diag } = await verifyRfc9421SignatureDetailed({
    signatureBase,
    signatureHeader: signature,
    algorithm: parsed.alg,
    publicKeyPem,
  });
  if (!verified) {
    // TEMPORARY stage diagnostic — development logs only. Safe metadata
    // (reason/alg/encoding/lengths/outcomes); never signature, key, token,
    // base, or body bytes, and never returned to the HTTP caller — the
    // external response stays the plain 401 with gate=signature_invalid.
    // keyidLookup=ok is accurate here: this point is only reachable after
    // the keyid matched an entry in pawaPay's Public Keys response.
    console.log(`[PawaPayWebhook] sigdiag keyidLookup=ok ${JSON.stringify(diag)}`);
    return gate401("signature_invalid", "Signature verification failed");
  }

  // Gate 6 — parse the (now-authenticated) body.
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
  const depositId = typeof body?.depositId === "string" ? body.depositId : "";
  if (!isValidUuidV4(depositId)) {
    return jsonResponse(400, { error: "Invalid depositId" });
  }

  // Gate 7 — INDEPENDENT status recheck. The callback body alone is never
  // trusted as proof of payment, even though its signature verified.
  let authoritative;
  try {
    authoritative = await fetchDepositStatus(depositId);
  } catch {
    return jsonResponse(502, { error: "Status recheck unavailable" });
  }
  if (!authoritative) {
    return jsonResponse(404, { error: "Unknown deposit" });
  }
  if (authoritative.depositId !== depositId) {
    return jsonResponse(400, { error: "Deposit mismatch" });
  }

  // Gate 8 — validate + settle through the shared idempotent mutation
  // (amount, ZMW currency, ZMB country, Zambia provider, subscription
  // purpose must all match; Pro is granted only for a fully verified
  // COMPLETED deposit; duplicates are no-ops).
  const result = await ctx.runMutation(internal.pawapay.applyDepositStatus, {
    depositId,
    providerData: authoritative,
  });

  if (!result.applied && result.reason === "unknown_transaction") {
    return jsonResponse(404, { error: "No matching transaction" });
  }

  // 200 for every verified callback we processed (including already-settled
  // duplicates) so pawaPay stops retrying; the grant logic lives server-side.
  return jsonResponse(200, {
    received: true,
    applied: result.applied,
    status: result.status ?? null,
  });
});
