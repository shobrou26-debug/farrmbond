import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { createAuditLog } from "./authHelpers";

// ============================================================
// pawaPay — SANDBOX-ONLY payment integration
//
// Source of truth: official pawaPay Merchant API v2 documentation
// (https://docs.pawapay.io/v2/), verified 2026-10-10 against:
//   - Initiate deposit:     POST /v2/deposits
//     https://docs.pawapay.io/v2/api-reference/deposits/initiate-deposit
//   - Check deposit status: GET  /v2/deposits/{depositId}
//     https://docs.pawapay.io/v2/api-reference/deposits/check-deposit-status
//   - Public keys (callback signing keys):
//     GET /v2/public-key/http
//     https://docs.pawapay.io/v2/api-reference/toolkit/public-keys
//   - Signatures (RFC 9421): https://docs.pawapay.io/v2/docs/signatures
//   - Sandbox test numbers:  https://docs.pawapay.io/v2/docs/test_numbers
//
// SECURITY MODEL (fail-closed on every axis)
//   1. SANDBOX ONLY. The base URL resolves to
//      https://api.sandbox.pawapay.io; the optional PAWAPAY_BASE_URL env
//      may only ever point at that exact host — anything else throws, so
//      no production host can be reached from this module.
//   2. PAWAPAY_API_TOKEN (sandbox token, Keys/API keys tab) is read
//      server-side only and is never logged, returned, or sent to clients.
//   3. Pro is granted ONLY through the shared
//      internal.mobileMoney.updateTransactionStatus mutation (which keeps
//      terminal-state immutability and the existing price guard) and ONLY
//      after validateVerifiedDeposit() passes every check below AND an
//      independent GET /v2/deposits/{depositId} reports COMPLETED.
//      ACCEPTED / SUBMITTED / PROCESSING / unknown / underpaid / mismatched
//      deposits never grant Pro.
//   4. Callbacks at /pawapay/webhook additionally require a valid RFC 9421
//      signature verified against pawaPay's published public key
//      (see pawapayWebhook.ts).
//   5. Prices: this module is the SANDBOX test price only —
//      ZMW 115 / month (clearly labelled in the UI). The production
//      subscription price (USD 5/month) and the MTN/Airtel/Stripe flows
//      are untouched.
// ============================================================

const PAWAPAY_API_TOKEN = process.env.PAWAPAY_API_TOKEN;

export const PAWAPAY_SANDBOX_BASE_URL = "https://api.sandbox.pawapay.io";

/** Verified Zambia providers (docs.pawapay.io/v2/docs/providers). Only these
 *  two are enabled for the sandbox test; Zamtel (ZAMTEL_ZMB) is documented
 *  but deliberately not offered. */
export const PAWAPAY_ZAMBIA_PROVIDERS = ["MTN_MOMO_ZMB", "AIRTEL_OAPI_ZMB"] as const;
export type PawaPayZambiaProvider = (typeof PAWAPAY_ZAMBIA_PROVIDERS)[number];

export const PAWAPAY_CURRENCY = "ZMW";
export const PAWAPAY_COUNTRY = "ZMB";

/** Sandbox-only subscription test price. NOT the production price (USD 5). */
export const PAWAPAY_SANDBOX_SUB_PRICE_ZMW = 115;

// ============================================================
// Pure helpers (exported for tests)
// ============================================================

/**
 * Resolve the API base URL, sandbox-only. PAWAPAY_BASE_URL (optional) may
 * only ever equal the sandbox host; any other host or scheme throws so a
 * production endpoint can never be reached from this module.
 */
export function resolvePawaPayBaseUrl(envUrl?: string): string {
  if (!envUrl || envUrl.trim() === "") return PAWAPAY_SANDBOX_BASE_URL;
  let url: URL;
  try {
    url = new URL(envUrl.trim());
  } catch {
    throw new Error(
      "PAWAPAY_BASE_URL is not a valid URL. Only the sandbox base URL (https://api.sandbox.pawapay.io) is allowed."
    );
  }
  if (url.protocol !== "https:" || url.host.toLowerCase() !== "api.sandbox.pawapay.io") {
    throw new Error(
      "Only the pawaPay SANDBOX host (https://api.sandbox.pawapay.io) is permitted. Production payments are not enabled for this deployment."
    );
  }
  return PAWAPAY_SANDBOX_BASE_URL;
}

function baseUrl(): string {
  return resolvePawaPayBaseUrl(process.env.PAWAPAY_BASE_URL);
}

function requireToken(): string {
  if (!PAWAPAY_API_TOKEN) {
    throw new Error(
      "pawaPay API token not configured. Set PAWAPAY_API_TOKEN (sandbox token) in the Keys/API keys tab."
    );
  }
  return PAWAPAY_API_TOKEN;
}

export function isAllowedPawaPayProvider(provider: string): provider is PawaPayZambiaProvider {
  return (PAWAPAY_ZAMBIA_PROVIDERS as readonly string[]).includes(provider);
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuidV4(id: string): boolean {
  return UUID_V4_RE.test(id);
}

/** UUIDv4 from the runtime CSPRNG (crypto.getRandomValues is available in
 *  the Convex runtime and in Node). Used as the pawaPay depositId, which
 *  doubles as our idempotency key. */
export function generateUuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Format an amount per the pawaPay pattern
 *  ^([0]|([1-9][0-9]{0,17}))([.][0-9]{0,3}[1-9])?$ — no leading zeros, no
 *  trailing zeros in decimals. Returns null when the amount is invalid. */
export function formatAmountString(amount: number): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const s = String(amount);
  return /^[0-9]{1,18}(\.[0-9]{0,3}[1-9])?$/.test(s) ? s : null;
}

/** Full MSISDN, country calling code first, no "+": e.g. 260763456789. */
export function normalizePawaPayMsisdn(raw: string): string {
  return raw.replace(/\s/g, "").replace(/^\+/, "");
}

/** Zambian MSISDNs are 260 + 9 digits (all official pawaPay Zambia test
 *  numbers are 12 digits starting 260). */
export function isZambiaMsisdn(cleaned: string): boolean {
  return /^260\d{9}$/.test(cleaned);
}

/** Digits-only comparison key for phone numbers (tolerates formatting). */
function msisdnDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** Initiation response status → our internal status.
 *  ACCEPTED / DUPLICATE_IGNORED → pending (the deposit exists; final
 *  status comes from the status API or callback). REJECTED → failed. */
export function mapInitiationStatus(status: unknown): "pending" | "failed" | null {
  if (status === "ACCEPTED" || status === "DUPLICATE_IGNORED") return "pending";
  if (status === "REJECTED") return "failed";
  return null;
}

/** Final deposit status (data.status) → our internal status.
 *  ONLY COMPLETED maps to "completed". SUBMITTED/PROCESSING stay pending
 *  (never grant). Anything unknown maps to null (never applied). */
export function mapDepositDataStatus(status: unknown): "completed" | "failed" | "pending" | null {
  if (status === "COMPLETED") return "completed";
  if (status === "FAILED") return "failed";
  if (status === "PROCESSING" || status === "SUBMITTED" || status === "ACCEPTED" || status === "ENQUEUED") {
    return "pending";
  }
  return null;
}

export interface PawaPayDepositData {
  depositId?: string;
  status?: string;
  amount?: string;
  currency?: string;
  country?: string;
  payer?: {
    type?: string;
    accountDetails?: { phoneNumber?: string; provider?: string };
  };
  [key: string]: unknown;
}

export interface PawaPayTxnSnapshot {
  referenceId: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  purpose?: string;
  pawaPayProvider?: string;
}

export type DepositVerdict = { ok: true } | { ok: false; reason: string };

/**
 * The Pro-grant gate. Every check must pass before a COMPLETED deposit may
 * settle a subscription transaction. Reasons are PII-free and audit-safe.
 */
export function validateVerifiedDeposit(
  data: PawaPayDepositData | null | undefined,
  txn: PawaPayTxnSnapshot
): DepositVerdict {
  if (!data || typeof data !== "object") return { ok: false, reason: "missing_deposit_data" };
  if (mapDepositDataStatus(data.status) !== "completed") return { ok: false, reason: "status_not_completed" };
  if (data.depositId !== txn.referenceId) return { ok: false, reason: "deposit_id_mismatch" };
  if (txn.purpose !== "subscription") return { ok: false, reason: "purpose_not_subscription" };
  if (data.currency !== PAWAPAY_CURRENCY) return { ok: false, reason: "currency_mismatch" };
  if (data.country !== PAWAPAY_COUNTRY) return { ok: false, reason: "country_mismatch" };
  if (txn.currency !== PAWAPAY_CURRENCY) return { ok: false, reason: "txn_currency_mismatch" };
  if (txn.amount < PAWAPAY_SANDBOX_SUB_PRICE_ZMW) return { ok: false, reason: "txn_price_below_sandbox_price" };

  const confirmed = Number(data.amount);
  if (!Number.isFinite(confirmed)) return { ok: false, reason: "amount_unparseable" };
  if (confirmed + 1e-9 < txn.amount) return { ok: false, reason: "amount_mismatch" };

  const reportedProvider = data.payer?.accountDetails?.provider;
  if (!reportedProvider || !isAllowedPawaPayProvider(reportedProvider)) {
    return { ok: false, reason: "provider_not_allowed" };
  }
  if (!txn.pawaPayProvider || reportedProvider !== txn.pawaPayProvider) {
    return { ok: false, reason: "provider_mismatch" };
  }

  // pawaPay docs show `phoneNumber`; one documented response example carries
  // a `phoneNUmber` typo — accept either spelling, compare digits only.
  const accountDetails = data.payer?.accountDetails as
    | { phoneNumber?: string; phoneNUmber?: string }
    | undefined;
  const reportedPhone = accountDetails?.phoneNumber ?? accountDetails?.phoneNUmber;
  if (!reportedPhone || msisdnDigits(reportedPhone) !== msisdnDigits(txn.phoneNumber)) {
    return { ok: false, reason: "phone_mismatch" };
  }

  return { ok: true };
}

// ============================================================
// RFC 9421 signature helpers (callback verification)
// Per https://docs.pawapay.io/v2/docs/signatures — pawaPay signs callbacks
// with their private key; the public key is fetched from
// GET /v2/public-key/http. No custom scheme — this is the documented flow.
// ============================================================

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 encode without btoa/atob (not guaranteed in every isolate). */
export function base64Encode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : BASE64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : BASE64_ALPHABET[b2 & 0x3f];
  }
  return out;
}

/** Strict base64 decode; returns null on invalid input. */
export function base64Decode(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length % 4 !== 0) return null;
  const clean = text.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let bits = 0;
  let acc = 0;
  let idx = 0;
  for (const ch of clean) {
    const val = BASE64_ALPHABET.indexOf(ch);
    if (val < 0) return null;
    acc = (acc << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[idx++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

function constantTimeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface ParsedSignatureInput {
  labels: string[];
  /** Everything after the label list, including the leading ";" — used
   *  verbatim for the @signature-params line. */
  paramsPart: string;
  alg: string | null;
  keyid: string | null;
  created: number | null;
  expires: number | null;
}

/** Parse a Signature-Input header, e.g.
 *  sig-pp=("@method" "@authority" ...);alg="ecdsa-p256-sha256";keyid="K:1";created=…;expires=… */
export function parseSignatureInput(header: string): ParsedSignatureInput | null {
  const trimmed = header.trim();
  const eq = trimmed.indexOf("=");
  const open = trimmed.indexOf("(", eq + 1);
  const close = trimmed.indexOf(")", open + 1);
  if (eq < 0 || open < 0 || close < 0) return null;
  const labels = trimmed.slice(open + 1, close).match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1));
  if (!labels || labels.length === 0) return null;
  const paramsPart = trimmed.slice(close + 1);
  const alg = /;\s*alg="([^"]+)"/.exec(paramsPart)?.[1] ?? null;
  const keyid = /;\s*keyid="([^"]+)"/.exec(paramsPart)?.[1] ?? null;
  const createdRaw = /;\s*created=(\d+)/.exec(paramsPart)?.[1] ?? null;
  const expiresRaw = /;\s*expires=(\d+)/.exec(paramsPart)?.[1] ?? null;
  return {
    labels,
    paramsPart,
    alg,
    keyid,
    created: createdRaw === null ? null : Number(createdRaw),
    expires: expiresRaw === null ? null : Number(expiresRaw),
  };
}

/** Rebuild the RFC 9421 signature base from the Signature-Input labels.
 *  Returns null when any component is unavailable or unsupported — the
 *  caller must then fail closed. */
export function buildSignatureBase(
  parsed: Pick<ParsedSignatureInput, "labels" | "paramsPart">,
  inputs: {
    method: string;
    authority: string;
    path: string;
    getHeader: (name: string) => string | null;
  }
): string | null {
  const lines: string[] = [];
  for (const label of parsed.labels) {
    let value: string | null = null;
    if (label === "@method") value = inputs.method;
    else if (label === "@authority") value = inputs.authority;
    else if (label === "@path") value = inputs.path;
    else if (label === "@scheme") value = "https";
    else if (label.startsWith("@")) return null; // unsupported derived component
    else value = inputs.getHeader(label);
    if (value === null || value === undefined || value === "") return null;
    lines.push(`"${label}": ${value}`);
  }
  lines.push(`@signature-params: ("${parsed.labels.join('" "')}")${parsed.paramsPart}`);
  return lines.join("\n");
}

/** Verify the Content-Digest header (RFC 9530: `sha-256=:BASE64:` or
 *  `sha-512=:BASE64:`) against the raw body. */
export async function contentDigestMatches(rawBody: string, headerValue: string): Promise<boolean> {
  const match = /^(sha-256|sha-512)=:([A-Za-z0-9+/=]+):$/.exec(headerValue.trim());
  if (!match) return false;
  const algorithm = match[1] === "sha-256" ? "SHA-256" : "SHA-512";
  const digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(rawBody));
  return constantTimeStringEqual(base64Encode(new Uint8Array(digest)), match[2]);
}

/** Freshness window from the Signature-Input created/expires parameters
 *  (unix seconds), with clock-skew tolerance. Fails closed when either
 *  parameter is absent. */
export function isSignatureFresh(
  created: number | null,
  expires: number | null,
  nowMs: number,
  skewSeconds = 300
): boolean {
  if (created === null || expires === null) return false;
  const now = Math.floor(nowMs / 1000);
  return now >= created - skewSeconds && now <= expires + skewSeconds;
}

function pemToSpki(pem: string): Uint8Array | null {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (body.length === 0) return null;
  return base64Decode(body);
}

/** Strict ASN.1 DER → IEEE P1363 (r || s) conversion for ECDSA signatures.
 *  pawaPay frames ECDSA signatures as an ASN.1 SEQUENCE of two INTEGERs
 *  (68–72 bytes for P-256), while WebCrypto verifies only the raw
 *  fixed-width form. Validates structure end-to-end: SEQUENCE tag and
 *  short-form length must cover the whole input (trailing/truncated bytes
 *  rejected), both INTEGER tags required, values must be positive (no
 *  negative encodings), minimally encoded (no redundant zero padding),
 *  and at most intBytes wide after padding is stripped (oversized
 *  rejected). Returns exactly intBytes*2 bytes, or null on anything
 *  malformed. */
export function derEcdsaToRaw(der: Uint8Array, intBytes: number): Uint8Array | null {
  if (intBytes < 1 || der.length < 8 || der[0] !== 0x30) return null;
  const seqLen = der[1];
  if (seqLen & 0x80) return null; // long-form/indefinite length — invalid at these sizes
  if (seqLen !== der.length - 2) return null; // length mismatch, truncation, or trailing bytes

  const readInt = (off: number): { end: number; bytes: Uint8Array } | null => {
    if (off + 2 > der.length || der[off] !== 0x02) return null; // missing INTEGER tag
    const len = der[off + 1];
    if (len === 0) return null; // empty INTEGER
    if (len > intBytes + 1) return null; // oversized encoding
    const start = off + 2;
    if (start + len > der.length) return null;
    const content = der.subarray(start, start + len);
    if (content[0] & 0x80) return null; // negative value (no 0x00 prefix allowed here)
    if (len > 1 && content[0] === 0x00 && !(content[1] & 0x80)) return null; // non-minimal
    const core = content[0] === 0x00 && len > 1 ? content.subarray(1) : content;
    if (core.length === 0 || core.length > intBytes) return null; // zero or oversized value
    return { end: start + len, bytes: core };
  };

  const r = readInt(2);
  if (!r) return null;
  const s = readInt(r.end);
  if (!s || s.end !== der.length) return null; // no trailing structure

  const out = new Uint8Array(intBytes * 2);
  out.set(r.bytes, intBytes - r.bytes.length); // left-pad r to intBytes
  out.set(s.bytes, intBytes * 2 - s.bytes.length); // left-pad s to intBytes
  return out;
}

/** Safe, non-secret stage diagnostics for callback verification failures.
 *  Contains ONLY: stage reason, algorithm id, encoding classification,
 *  byte lengths, and WebCrypto outcome. Never signature/key/body bytes. */
export interface VerifyDiag {
  reason:
    | "ok"
    | "sig_header_format"
    | "sig_decode_failed"
    | "key_decode_failed"
    | "alg_unsupported"
    | "sig_length_invalid"
    | "der_conversion_failed"
    | "crypto_verify_false"
    | "crypto_verify_exception";
  alg: string | null;
  enc: "raw" | "der" | "none";
  declen: number | null;
  convlen: number | null;
  key: "ok" | "fail" | null;
  crypto: "pass" | "false" | "throw" | null;
}

/** Stage-aware RFC 9421 verification: identical fail-closed semantics to
 *  verifyRfc9421Signature, but reports WHICH stage failed via safe
 *  metadata so development logs can pinpoint the rejection. */
export async function verifyRfc9421SignatureDetailed(opts: {
  signatureBase: string;
  signatureHeader: string;
  algorithm: string | null;
  publicKeyPem: string;
}): Promise<{ ok: boolean; diag: VerifyDiag }> {
  const diag: VerifyDiag = {
    reason: "sig_header_format",
    alg: opts.algorithm,
    enc: "none",
    declen: null,
    convlen: null,
    key: null,
    crypto: null,
  };
  const fail = (reason: VerifyDiag["reason"]) => ({ ok: false, diag: { ...diag, reason } });

  const sigMatch = /^[A-Za-z0-9_-]+=:([A-Za-z0-9+/=]+):$/.exec(opts.signatureHeader.trim());
  if (!sigMatch) return fail("sig_header_format");
  const sigBytes = base64Decode(sigMatch[1]);
  if (!sigBytes) return fail("sig_decode_failed");
  diag.declen = sigBytes.length;

  const keyBytes = pemToSpki(opts.publicKeyPem);
  diag.key = keyBytes ? "ok" : "fail";
  if (!keyBytes) return fail("key_decode_failed");

  let webKeyAlgorithm: RsaHashedImportParams | EcKeyImportParams;
  let verifyParams: EcdsaParams | RsaPssParams | AlgorithmIdentifier;
  let intBytes = 0; // 0 = RSA (raw by design), 32/48 = ECDSA curve width
  switch (opts.algorithm) {
    case "ecdsa-p256-sha256":
      webKeyAlgorithm = { name: "ECDSA", namedCurve: "P-256" };
      verifyParams = { name: "ECDSA", hash: "SHA-256" };
      intBytes = 32;
      break;
    case "ecdsa-p384-sha384":
      webKeyAlgorithm = { name: "ECDSA", namedCurve: "P-384" };
      verifyParams = { name: "ECDSA", hash: "SHA-384" };
      intBytes = 48;
      break;
    case "rsa-pss-sha512":
      webKeyAlgorithm = { name: "RSASSA-PSS", hash: "SHA-512" };
      verifyParams = { name: "RSASSA-PSS", saltLength: 64 };
      break;
    case "rsa-v1_5-sha256":
      webKeyAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
      verifyParams = { name: "RSASSA-PKCS1-v1_5" };
      break;
    default:
      return fail("alg_unsupported"); // unknown/absent algorithm — fail closed
  }

  // Encoding: ECDSA accepts raw fixed-width or strict DER-converted input.
  let verifySig: Uint8Array = sigBytes;
  if (intBytes > 0) {
    const rawLen = intBytes * 2;
    if (sigBytes.length === rawLen) {
      diag.enc = "raw";
    } else {
      if (sigBytes.length < 20 || sigBytes.length > 120) return fail("sig_length_invalid");
      const converted = derEcdsaToRaw(sigBytes, intBytes);
      if (!converted) return fail("der_conversion_failed");
      diag.enc = "der";
      diag.convlen = converted.length;
      verifySig = converted;
    }
  } else {
    diag.enc = "raw";
  }

  try {
    const key = await crypto.subtle.importKey("spki", keyBytes as BufferSource, webKeyAlgorithm, false, [
      "verify",
    ]);
    const pass = await crypto.subtle.verify(
      verifyParams as AlgorithmIdentifier,
      key,
      verifySig as BufferSource,
      new TextEncoder().encode(opts.signatureBase)
    );
    diag.crypto = pass ? "pass" : "false";
    return pass ? { ok: true, diag: { ...diag, reason: "ok" } } : fail("crypto_verify_false");
  } catch {
    diag.crypto = "throw";
    return fail("crypto_verify_exception");
  }
}

/** Verify an RFC 9421 signature over the rebuilt signature base using
 *  pawaPay's published public key. Supports the four algorithms pawaPay
 *  documents; anything else fails closed. */
export async function verifyRfc9421Signature(opts: {
  signatureBase: string;
  signatureHeader: string;
  algorithm: string | null;
  publicKeyPem: string;
}): Promise<boolean> {
  return (await verifyRfc9421SignatureDetailed(opts)).ok;
}

// ============================================================
// pawaPay HTTP helpers (server-side only; token never logged)
// ============================================================

export async function fetchDepositStatus(depositId: string): Promise<PawaPayDepositData | null> {
  const response = await fetch(`${baseUrl()}/v2/deposits/${encodeURIComponent(depositId)}`, {
    headers: { Authorization: `Bearer ${requireToken()}` },
  });
  if (!response.ok) throw new Error(`pawaPay status check failed: HTTP ${response.status}`);
  const body = await response.json();
  if (body?.status === "FOUND" && body.data && typeof body.data === "object") {
    return body.data as PawaPayDepositData;
  }
  if (body?.status === "NOT_FOUND") return null;
  throw new Error("pawaPay status check returned an unexpected response");
}

/** Fetch pawaPay's callback-signing public key for a keyid. Returns the PEM
 *  or null when the keyid is unknown. Throws when the API call fails. */
export async function fetchPawaPayPublicKey(keyid: string): Promise<string | null> {
  const response = await fetch(`${baseUrl()}/v2/public-key/http`, {
    headers: { Authorization: `Bearer ${requireToken()}` },
  });
  if (!response.ok) throw new Error(`pawaPay public key fetch failed: HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body)) return null;
  const match = body.find(
    (entry) =>
      entry && typeof entry === "object" && entry.id === keyid && typeof entry.key === "string"
  );
  return match ? (match.key as string) : null;
}

// ============================================================
// Database mutations
// ============================================================

/** Insert the pending transaction BEFORE calling pawaPay — every accepted
 *  deposit exists locally first, keyed by our UUIDv4 depositId. */
export const createPendingDeposit = internalMutation({
  args: {
    userId: v.id("users"),
    depositId: v.string(),
    externalId: v.string(),
    amount: v.number(),
    currency: v.string(),
    phoneNumber: v.string(),
    pawaPayProvider: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("mobileMoneyTransactions", {
      userId: args.userId,
      provider: "pawapay",
      referenceId: args.depositId,
      externalId: args.externalId,
      amount: args.amount,
      currency: args.currency,
      phoneNumber: args.phoneNumber,
      pawaPayProvider: args.pawaPayProvider,
      status: "pending",
      description: args.description ?? "FarmBond Pro (pawaPay sandbox)",
      purpose: "subscription",
      createdAt: now,
      updatedAt: now,
    });
    return { depositId: args.depositId };
  },
});

/** Mark a pending deposit failed (rejection at initiation). Never touches
 *  terminal rows. */
export const markDepositRejected = internalMutation({
  args: { referenceId: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const txn = await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_reference", (q) => q.eq("referenceId", args.referenceId))
      .first();
    if (!txn || txn.provider !== "pawapay" || txn.status !== "pending") {
      return { updated: false };
    }
    await ctx.db.patch(txn._id, {
      status: "failed",
      providerResponse: { rejected: true, reason: args.reason },
      updatedAt: Date.now(),
    });
    return { updated: true };
  },
});

/**
 * Apply an AUTHORITATIVE deposit status (from the signed callback after an
 * independent status re-check, or from the authenticated status-check
 * action, or from reconciliation).
 *
 * INTERNAL ONLY. Idempotent and fail-closed:
 *  - unknown / non-pawaPay / wrong-purpose transactions → rejected
 *  - callerUserId (client path) must own the transaction (webhook omits it
 *    and is gated by signature verification instead)
 *  - completed transactions are never modified again
 *  - FAILED → internal "failed" (never grants)
 *  - COMPLETED → validateVerifiedDeposit() must pass EVERY check, then the
 *    shared updateTransactionStatus mutation settles it (existing price
 *    guard + single Pro grant + audit log all reused)
 */
export const applyDepositStatus = internalMutation({
  args: {
    depositId: v.string(),
    providerData: v.any(),
    callerUserId: v.optional(v.id("users")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ applied: boolean; status?: string; reason?: string }> => {
    const txn = await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_reference", (q) => q.eq("referenceId", args.depositId))
      .first();
    if (!txn) return { applied: false, reason: "unknown_transaction" };
    if (txn.provider !== "pawapay") return { applied: false, reason: "provider_mismatch" };
    if (args.callerUserId && txn.userId !== args.callerUserId) {
      return { applied: false, reason: "ownership_mismatch" };
    }
    if (txn.status === "completed") {
      return { applied: false, status: "completed", reason: "already_completed" };
    }

    const data = args.providerData as PawaPayDepositData;
    const mapped = mapDepositDataStatus(data?.status);
    if (mapped === null) return { applied: false, reason: "unknown_status" };
    if (mapped === "pending") return { applied: false, reason: "not_final" };

    if (mapped === "failed") {
      await ctx.runMutation(internal.mobileMoney.updateTransactionStatus, {
        referenceId: args.depositId,
        status: "failed",
        providerResponse: data,
      });
      return { applied: true, status: "failed" };
    }

    // mapped === "completed" — the full verification gate before any grant.
    const verdict = validateVerifiedDeposit(data, {
      referenceId: txn.referenceId,
      amount: txn.amount,
      currency: txn.currency,
      phoneNumber: txn.phoneNumber,
      purpose: txn.purpose,
      pawaPayProvider: txn.pawaPayProvider,
    });
    if (!verdict.ok) {
      await createAuditLog(ctx, {
        userId: txn.userId,
        action: "pawapay_verification_rejected",
        resource: "subscriptions",
        resourceId: txn.userId,
        changes: { reason: verdict.reason, depositId: args.depositId },
      });
      return { applied: false, reason: verdict.reason };
    }

    await ctx.runMutation(internal.mobileMoney.updateTransactionStatus, {
      referenceId: args.depositId,
      status: "completed",
      providerResponse: data,
    });
    return { applied: true, status: "completed" };
  },
});

/** Oldest-first page of pending pawaPay transactions older than minAgeMs. */
export const listPendingPawaPayDeposits = internalQuery({
  args: { minAgeMs: v.number(), limit: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.minAgeMs;
    const rows = await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(500);
    return rows
      .filter((r) => r.provider === "pawapay" && r.createdAt <= cutoff)
      .slice(0, args.limit)
      .map((r) => ({ referenceId: r.referenceId, createdAt: r.createdAt }));
  },
});

// ============================================================
// Client-facing actions
// ============================================================

/**
 * Initiate a pawaPay sandbox deposit for FarmBond Pro.
 * The amount and currency are SERVER-SIDE ONLY (sandbox test price,
 * ZMW 115) — the client only chooses the Zambia provider and phone number.
 * The pending transaction is persisted BEFORE the pawaPay API call.
 */
export const initiatePawapayDeposit = action({
  args: {
    phoneNumber: v.string(),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");
    requireToken(); // fail fast, before writing anything
    if (!isAllowedPawaPayProvider(args.provider)) {
      throw new Error("Unsupported pawaPay provider for Zambia (sandbox).");
    }
    const phone = normalizePawaPayMsisdn(args.phoneNumber);
    if (!isZambiaMsisdn(phone)) {
      throw new Error("Enter a valid Zambian mobile number in international format (260XXXXXXXXX).");
    }

    const depositId = generateUuidV4();
    const externalId = `FB-PP-${Date.now()}`;
    const amount = PAWAPAY_SANDBOX_SUB_PRICE_ZMW;
    const amountStr = formatAmountString(amount);
    if (!amountStr) throw new Error("Invalid sandbox amount configuration.");

    // 1. Persist the pending transaction first (reconciliation safety).
    await ctx.runMutation(internal.pawapay.createPendingDeposit, {
      userId,
      depositId,
      externalId,
      amount,
      currency: PAWAPAY_CURRENCY,
      phoneNumber: phone,
      pawaPayProvider: args.provider,
    });

    // 2. Call pawaPay — POST /v2/deposits (idempotent on depositId).
    let response: Response;
    try {
      response = await fetch(`${baseUrl()}/v2/deposits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requireToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          depositId,
          payer: { type: "MMO", accountDetails: { phoneNumber: phone, provider: args.provider } },
          amount: amountStr,
          currency: PAWAPAY_CURRENCY,
          clientReferenceId: externalId,
          customerMessage: "FarmBond Pro",
        }),
      });
    } catch {
      // Network failure — the row stays pending; reconciliation resolves it.
      console.error(`pawaPay initiation network error — provider: pawapay, depositId: ${depositId}`);
      throw new Error(
        "Could not reach pawaPay. Your pending transaction is saved and will be reconciled automatically."
      );
    }

    let body: Record<string, unknown> | null = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const failure =
        typeof body?.failureReason === "string" ? body.failureReason : `http_${response.status}`;
      if (response.status >= 400 && response.status < 500) {
        // 4xx — pawaPay did not accept the request; the deposit was not
        // created, so marking the local row failed is safe.
        await ctx.runMutation(internal.pawapay.markDepositRejected, {
          referenceId: depositId,
          reason: failure,
        });
        return {
          depositId,
          status: "failed" as const,
          message: `pawaPay rejected the request (${failure}). Please try again.`,
        };
      }
      // 5xx — ambiguous; leave pending and let reconciliation decide.
      console.error(
        `pawaPay initiation server error — provider: pawapay, http_status: ${response.status}, depositId: ${depositId}`
      );
      return {
        depositId,
        status: "pending" as const,
        message: "pawaPay is temporarily unavailable. Your transaction will be reconciled automatically.",
      };
    }

    const mapped = mapInitiationStatus(body?.status);
    if (mapped === "failed") {
      const failure = typeof body?.failureReason === "string" ? body.failureReason : "rejected";
      await ctx.runMutation(internal.pawapay.markDepositRejected, {
        referenceId: depositId,
        reason: failure,
      });
      return { depositId, status: "failed" as const, message: `Deposit rejected: ${failure}` };
    }
    if (mapped === null) {
      // Unknown initiation status — never grant on this; reconcile decides.
      console.error(
        `pawaPay initiation unexpected status — provider: pawapay, depositId: ${depositId}`
      );
      return {
        depositId,
        status: "pending" as const,
        message: "Deposit submitted. Its status will be confirmed automatically.",
      };
    }
    return {
      depositId,
      status: "pending" as const,
      message:
        "Deposit accepted by pawaPay — awaiting confirmation. (Sandbox test numbers settle automatically.)",
    };
  },
});

/**
 * Independently check a deposit's status with pawaPay (GET
 * /v2/deposits/{depositId}) and apply it. Callable only by the
 * authenticated transaction owner — applyDepositStatus enforces
 * ownership server-side.
 */
export const checkPawapayDepositStatus = action({
  args: { referenceId: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ status: string; applied: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");
    if (!isValidUuidV4(args.referenceId)) throw new Error("Invalid deposit reference.");

    const data = await fetchDepositStatus(args.referenceId); // throws on API failure
    if (!data) return { status: "NOT_FOUND", applied: false };

    const result: { applied: boolean; status?: string; reason?: string } =
      await ctx.runMutation(internal.pawapay.applyDepositStatus, {
        depositId: args.referenceId,
        providerData: data,
        callerUserId: userId,
      });
    return { status: String(data.status ?? "UNKNOWN"), applied: result.applied };
  },
});

// ============================================================
// Reconciliation (no callback required)
// ============================================================

/**
 * Reconcile pending pawaPay deposits via the official status endpoint.
 * Runs on a cron; also self-heals any deposit whose callback never
 * arrived. NOT_FOUND is only marked failed after a grace period.
 */
export const reconcilePendingDeposits = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.runQuery(internal.pawapay.listPendingPawaPayDeposits, {
      minAgeMs: 2 * 60 * 1000,
      limit: 50,
    });
    let checked = 0;
    for (const txn of pending) {
      checked++;
      try {
        const data = await fetchDepositStatus(txn.referenceId);
        if (data) {
          await ctx.runMutation(internal.pawapay.applyDepositStatus, {
            depositId: txn.referenceId,
            providerData: data,
          });
        } else if (now - txn.createdAt > 10 * 60 * 1000) {
          // pawaPay has never seen this deposit after a 10-minute grace
          // period — mark failed (recoverable only by a later COMPLETED).
          await ctx.runMutation(internal.mobileMoney.updateTransactionStatus, {
            referenceId: txn.referenceId,
            status: "failed",
            providerResponse: { source: "pawapay_reconciliation", result: "NOT_FOUND" },
          });
        }
      } catch (error) {
        // Deposit IDs only — never tokens, phone numbers, or raw payloads.
        console.error(
          `pawaPay reconciliation error — provider: pawapay, depositId: ${txn.referenceId}, error: ${
            error instanceof Error ? error.message : "unknown"
          }`
        );
      }
    }
    return { checked };
  },
});
