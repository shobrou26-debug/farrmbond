// Side-effect env — must precede the ../convex/pawapay import below:
// pawapay.ts captures PAWAPAY_API_TOKEN at module-evaluation time.
import { GATE_DIAG_TEST_TOKEN } from "./gateDiagEnv";
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync } from "node:fs";
import {
  PAWAPAY_SANDBOX_BASE_URL,
  PAWAPAY_SANDBOX_SUB_PRICE_ZMW,
  PAWAPAY_CURRENCY,
  PAWAPAY_COUNTRY,
  PAWAPAY_ZAMBIA_PROVIDERS,
  resolvePawaPayBaseUrl,
  isAllowedPawaPayProvider,
  isValidUuidV4,
  generateUuidV4,
  formatAmountString,
  normalizePawaPayMsisdn,
  isZambiaMsisdn,
  mapInitiationStatus,
  mapDepositDataStatus,
  validateVerifiedDeposit,
  base64Encode,
  base64Decode,
  parseSignatureInput,
  buildSignatureBase,
  contentDigestMatches,
  isSignatureFresh,
  verifyRfc9421Signature,
  verifyRfc9421SignatureDetailed,
  derEcdsaToRaw,
  type PawaPayDepositData,
  type PawaPayTxnSnapshot,
} from "../convex/pawapay";

// ============================================================
// pawaPay SANDBOX integration — pure core + wiring guards.
//
// Every gate that stands between an incoming callback and a Pro grant is
// covered here: sandbox-only base URL, Zambia provider allowlist, amount
// format, status mapping (ONLY COMPLETED grants), the full verification
// matrix, and RFC 9421 signature verification against a real generated
// keypair. Source guards pin the wiring order in the webhook.
// ============================================================

const readConvex = (file: string): string =>
  readFileSync(new URL(`../convex/${file}`, import.meta.url), "utf8");
const readRoot = (file: string): string =>
  readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

const VALID_DEPOSIT_ID = "8917c345-4791-4285-a416-62f24b6982db";

function makeTxn(overrides: Partial<PawaPayTxnSnapshot> = {}): PawaPayTxnSnapshot {
  return {
    referenceId: VALID_DEPOSIT_ID,
    amount: PAWAPAY_SANDBOX_SUB_PRICE_ZMW,
    currency: PAWAPAY_CURRENCY,
    phoneNumber: "260763456789",
    purpose: "subscription",
    pawaPayProvider: "MTN_MOMO_ZMB",
    ...overrides,
  };
}

function makeDeposit(overrides: Partial<PawaPayDepositData> = {}): PawaPayDepositData {
  return {
    depositId: VALID_DEPOSIT_ID,
    status: "COMPLETED",
    amount: "115.00",
    currency: PAWAPAY_CURRENCY,
    country: PAWAPAY_COUNTRY,
    payer: {
      type: "MMO",
      accountDetails: { phoneNumber: "260763456789", provider: "MTN_MOMO_ZMB" },
    },
    ...overrides,
  };
}

// ------------------------------------------------------------
// Sandbox-only base URL
// ------------------------------------------------------------
describe("resolvePawaPayBaseUrl — sandbox only, production unreachable", () => {
  test("unset env → sandbox default", () => {
    expect(resolvePawaPayBaseUrl(undefined)).toBe(PAWAPAY_SANDBOX_BASE_URL);
    expect(resolvePawaPayBaseUrl("")).toBe(PAWAPAY_SANDBOX_BASE_URL);
  });

  test("explicit sandbox URL accepted", () => {
    expect(resolvePawaPayBaseUrl("https://api.sandbox.pawapay.io")).toBe(
      PAWAPAY_SANDBOX_BASE_URL
    );
  });

  test("production host throws — real money unreachable", () => {
    expect(() => resolvePawaPayBaseUrl("https://api.pawapay.io")).toThrow();
    expect(() => resolvePawaPayBaseUrl("https://api.pawapay.io/v2")).toThrow();
  });

  test("any other host or scheme throws", () => {
    expect(() => resolvePawaPayBaseUrl("http://api.sandbox.pawapay.io")).toThrow();
    expect(() => resolvePawaPayBaseUrl("https://evil.example.com")).toThrow();
    expect(() => resolvePawaPayBaseUrl("not a url")).toThrow();
  });
});

// ------------------------------------------------------------
// Deposit IDs (UUIDv4)
// ------------------------------------------------------------
describe("UUIDv4 deposit IDs", () => {
  test("generated IDs are valid UUIDv4", () => {
    const id = generateUuidV4();
    expect(isValidUuidV4(id)).toBe(true);
    expect(id.length).toBe(36);
  });

  test("generated IDs are unique", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateUuidV4()));
    expect(ids.size).toBe(50);
  });

  test("non-v4 / malformed IDs rejected", () => {
    expect(isValidUuidV4("not-a-uuid")).toBe(false);
    expect(isValidUuidV4("8917c345-4791-1285-a416-62f24b6982db")).toBe(false); // v1
    expect(isValidUuidV4("8917c345-4791-4285-c416-62f24b6982db")).toBe(false); // bad variant
    expect(isValidUuidV4("")).toBe(false);
  });
});

// ------------------------------------------------------------
// Zambia providers
// ------------------------------------------------------------
describe("provider allowlist — verified Zambia identifiers only", () => {
  test("MTN_MOMO_ZMB and AIRTEL_OAPI_ZMB accepted", () => {
    expect(isAllowedPawaPayProvider("MTN_MOMO_ZMB")).toBe(true);
    expect(isAllowedPawaPayProvider("AIRTEL_OAPI_ZMB")).toBe(true);
    expect(PAWAPAY_ZAMBIA_PROVIDERS.length).toBe(2);
  });

  test("Zamtel and other countries rejected (not enabled)", () => {
    expect(isAllowedPawaPayProvider("ZAMTEL_ZMB")).toBe(false);
    expect(isAllowedPawaPayProvider("MTN_MOMO_GHA")).toBe(false);
    expect(isAllowedPawaPayProvider("MPESA_KEN")).toBe(false);
    expect(isAllowedPawaPayProvider("")).toBe(false);
  });
});

// ------------------------------------------------------------
// Amount + phone formatting
// ------------------------------------------------------------
describe("amount formatting per pawaPay pattern", () => {
  test("115 formats to \"115\" (major units, string)", () => {
    expect(formatAmountString(PAWAPAY_SANDBOX_SUB_PRICE_ZMW)).toBe("115");
  });

  test("decimals formatted without trailing zeros", () => {
    expect(formatAmountString(15)).toBe("15");
    expect(formatAmountString(15.5)).toBe("15.5");
  });

  test("invalid amounts rejected (fail closed)", () => {
    expect(formatAmountString(0)).toBeNull();
    expect(formatAmountString(-5)).toBeNull();
    expect(formatAmountString(NaN)).toBeNull();
    expect(formatAmountString(Infinity)).toBeNull();
  });
});

describe("MSISDN handling — full international format", () => {
  test("strips + and whitespace", () => {
    expect(normalizePawaPayMsisdn("+260 763 456 789")).toBe("260763456789");
  });

  test("Zambian MSISDNs validated (260 + 9 digits)", () => {
    expect(isZambiaMsisdn("260763456789")).toBe(true);
    expect(isZambiaMsisdn("260973456789")).toBe(true);
  });

  test("non-Zambian or short numbers rejected", () => {
    expect(isZambiaMsisdn("254703456789")).toBe(false); // Kenya
    expect(isZambiaMsisdn("0971234567")).toBe(false); // local format
    expect(isZambiaMsisdn("26076345678")).toBe(false); // too short
  });
});

// ------------------------------------------------------------
// Status mapping — ONLY COMPLETED ever leads to a grant
// ------------------------------------------------------------
describe("initiation status mapping", () => {
  test("ACCEPTED and DUPLICATE_IGNORED → pending", () => {
    expect(mapInitiationStatus("ACCEPTED")).toBe("pending");
    expect(mapInitiationStatus("DUPLICATE_IGNORED")).toBe("pending");
  });

  test("REJECTED → failed", () => {
    expect(mapInitiationStatus("REJECTED")).toBe("failed");
  });

  test("unknown → null (never applied)", () => {
    expect(mapInitiationStatus("COMPLETED")).toBeNull();
    expect(mapInitiationStatus("garbage")).toBeNull();
    expect(mapInitiationStatus(undefined)).toBeNull();
  });
});

describe("deposit status mapping — never grants on non-COMPLETED", () => {
  test("COMPLETED → completed (the only grant-triggering status)", () => {
    expect(mapDepositDataStatus("COMPLETED")).toBe("completed");
  });

  test("FAILED → failed", () => {
    expect(mapDepositDataStatus("FAILED")).toBe("failed");
  });

  test("PROCESSING / SUBMITTED / ACCEPTED / ENQUEUED → pending", () => {
    expect(mapDepositDataStatus("PROCESSING")).toBe("pending");
    expect(mapDepositDataStatus("SUBMITTED")).toBe("pending");
    expect(mapDepositDataStatus("ACCEPTED")).toBe("pending");
    expect(mapDepositDataStatus("ENQUEUED")).toBe("pending");
  });

  test("unknown → null (never applied)", () => {
    expect(mapDepositDataStatus("WHATEVER")).toBeNull();
    expect(mapDepositDataStatus(null)).toBeNull();
    expect(mapDepositDataStatus(undefined)).toBeNull();
  });
});

// ------------------------------------------------------------
// validateVerifiedDeposit — the Pro-grant gate
// ------------------------------------------------------------
describe("validateVerifiedDeposit — full verification matrix", () => {
  test("fully verified COMPLETED deposit → ok", () => {
    expect(validateVerifiedDeposit(makeDeposit(), makeTxn())).toEqual({ ok: true });
  });

  test("tolerates the documented phoneNUmber typo in responses", () => {
    const deposit = makeDeposit();
    const ac = deposit.payer!.accountDetails as Record<string, unknown>;
    ac.phoneNumber = undefined;
    (ac as Record<string, unknown>).phoneNUmber = "260763456789";
    expect(validateVerifiedDeposit(deposit, makeTxn()).ok).toBe(true);
  });

  test("ACCEPTED / SUBMITTED / PROCESSING never pass", () => {
    for (const status of ["ACCEPTED", "SUBMITTED", "PROCESSING"]) {
      expect(validateVerifiedDeposit(makeDeposit({ status }), makeTxn())).toEqual({
        ok: false,
        reason: "status_not_completed",
      });
    }
  });

  test("FAILED never passes", () => {
    expect(validateVerifiedDeposit(makeDeposit({ status: "FAILED" }), makeTxn()).ok).toBe(false);
  });

  test("unknown status never passes", () => {
    expect(validateVerifiedDeposit(makeDeposit({ status: "WEIRD" }), makeTxn())).toEqual({
      ok: false,
      reason: "status_not_completed",
    });
  });

  test("missing / malformed data never passes", () => {
    expect(validateVerifiedDeposit(null, makeTxn()).ok).toBe(false);
    expect(validateVerifiedDeposit(undefined, makeTxn()).ok).toBe(false);
  });

  test("depositId mismatch rejected", () => {
    expect(
      validateVerifiedDeposit(makeDeposit({ depositId: generateUuidV4() }), makeTxn())
    ).toEqual({ ok: false, reason: "deposit_id_mismatch" });
  });

  test("non-subscription purpose rejected", () => {
    expect(
      validateVerifiedDeposit(makeDeposit(), makeTxn({ purpose: "consultation" }))
    ).toEqual({ ok: false, reason: "purpose_not_subscription" });
  });

  test("currency mismatch rejected (non-ZMW)", () => {
    expect(validateVerifiedDeposit(makeDeposit({ currency: "USD" }), makeTxn())).toEqual({
      ok: false,
      reason: "currency_mismatch",
    });
  });

  test("country mismatch rejected (non-ZMB)", () => {
    expect(validateVerifiedDeposit(makeDeposit({ country: "GHA" }), makeTxn())).toEqual({
      ok: false,
      reason: "country_mismatch",
    });
  });

  test("underpayment rejected (110 < 115)", () => {
    expect(validateVerifiedDeposit(makeDeposit({ amount: "110.00" }), makeTxn())).toEqual({
      ok: false,
      reason: "amount_mismatch",
    });
  });

  test("unparseable amount rejected", () => {
    expect(validateVerifiedDeposit(makeDeposit({ amount: "abc" }), makeTxn())).toEqual({
      ok: false,
      reason: "amount_unparseable",
    });
    expect(validateVerifiedDeposit(makeDeposit({ amount: undefined }), makeTxn())).toEqual({
      ok: false,
      reason: "amount_unparseable",
    });
  });

  test("overpayment accepted (≥ expected)", () => {
    expect(validateVerifiedDeposit(makeDeposit({ amount: "200.00" }), makeTxn()).ok).toBe(true);
  });

  test("txn price below sandbox floor rejected", () => {
    expect(
      validateVerifiedDeposit(makeDeposit(), makeTxn({ amount: 1 }))
    ).toEqual({ ok: false, reason: "txn_price_below_sandbox_price" });
  });

  test("unlisted provider rejected (Zamtel, foreign networks)", () => {
    const deposit = makeDeposit();
    deposit.payer!.accountDetails!.provider = "ZAMTEL_ZMB";
    expect(validateVerifiedDeposit(deposit, makeTxn())).toEqual({
      ok: false,
      reason: "provider_not_allowed",
    });
  });

  test("provider mismatch rejected (reported ≠ initiated)", () => {
    const deposit = makeDeposit();
    deposit.payer!.accountDetails!.provider = "AIRTEL_OAPI_ZMB";
    deposit.payer!.accountDetails!.phoneNumber = "260973456789";
    expect(validateVerifiedDeposit(deposit, makeTxn())).toEqual({
      ok: false,
      reason: "provider_mismatch",
    });
  });

  test("phone mismatch rejected", () => {
    const deposit = makeDeposit();
    deposit.payer!.accountDetails!.phoneNumber = "260973456789";
    expect(validateVerifiedDeposit(deposit, makeTxn())).toEqual({
      ok: false,
      reason: "phone_mismatch",
    });
  });
});

// ------------------------------------------------------------
// base64 (runtime-safe, no atob/btoa dependency)
// ------------------------------------------------------------
describe("base64 helpers", () => {
  test("encode/decode roundtrip", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const encoded = base64Encode(bytes);
    expect(Array.from(base64Decode(encoded)!)).toEqual([0, 1, 2, 253, 254, 255]);
  });

  test("pads correctly", () => {
    expect(base64Encode(new Uint8Array([102, 111, 111]))).toBe("Zm9v"); // "foo"
    expect(base64Encode(new Uint8Array([102, 111]))).toBe("Zm8="); // "fo"
  });

  test("invalid base64 rejected", () => {
    expect(base64Decode("!!!not-base64!!!")).toBeNull();
    expect(base64Decode("Zm9vZm9")).toBeNull(); // bad length
  });
});

// ------------------------------------------------------------
// RFC 9421 signature verification (per pawaPay docs)
// ------------------------------------------------------------
describe("parseSignatureInput", () => {
  test("parses the documented example", () => {
    const header =
      'sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="CUSTOMER_TEST_KEY";created=1714657551;expires=1714657611';
    const parsed = parseSignatureInput(header);
    expect(parsed).not.toBeNull();
    expect(parsed!.labels).toEqual([
      "@method",
      "@authority",
      "@path",
      "signature-date",
      "content-digest",
      "content-type",
    ]);
    expect(parsed!.alg).toBe("ecdsa-p256-sha256");
    expect(parsed!.keyid).toBe("CUSTOMER_TEST_KEY");
    expect(parsed!.created).toBe(1714657551);
    expect(parsed!.expires).toBe(1714657611);
  });

  test("malformed inputs rejected", () => {
    expect(parseSignatureInput("garbage")).toBeNull();
    expect(parseSignatureInput('sig-pp=("@method"')).toBeNull();
    expect(parseSignatureInput("sig-pp=()")).toBeNull();
    expect(parseSignatureInput("")).toBeNull();
  });
});

describe("buildSignatureBase — golden test against the pawaPay doc example", () => {
  test("reproduces the documented callback signature base byte-for-byte", () => {
    const header =
      'sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="CUSTOMER_TEST_KEY";created=1714657551;expires=1714657611';
    const parsed = parseSignatureInput(header)!;
    const base = buildSignatureBase(parsed, {
      method: "POST",
      authority: "localhost:8080",
      path: "/callback",
      getHeader: (name) => {
        const headers: Record<string, string> = {
          "signature-date": "2024-05-02T16:45:51.131905Z",
          "content-digest":
            "sha-512=:0ki7QBS/0MA424uwOq3k5HnJnL5SRkPjit12m0YMpd4JgWiMvm9+yNT3FunkpDaTSsKhTkliQwJlRw9bgsos9w==:",
          "content-type": "application/json; charset=UTF-8",
        };
        return headers[name] ?? null;
      },
    });
    expect(base).toBe(
      [
        '"@method": POST',
        '"@authority": localhost:8080',
        '"@path": /callback',
        '"signature-date": 2024-05-02T16:45:51.131905Z',
        '"content-digest": sha-512=:0ki7QBS/0MA424uwOq3k5HnJnL5SRkPjit12m0YMpd4JgWiMvm9+yNT3FunkpDaTSsKhTkliQwJlRw9bgsos9w==:',
        '"content-type": application/json; charset=UTF-8',
        '@signature-params: ("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="CUSTOMER_TEST_KEY";created=1714657551;expires=1714657611',
      ].join("\n")
    );
  });

  test("missing header component → null (fail closed)", () => {
    const parsed = parseSignatureInput(
      'sig-pp=("@method" "content-digest");alg="ecdsa-p256-sha256";keyid="K:1";created=1;expires=2'
    )!;
    const base = buildSignatureBase(parsed, {
      method: "POST",
      authority: "x",
      path: "/y",
      getHeader: () => null,
    });
    expect(base).toBeNull();
  });

  test("unsupported derived component → null (fail closed)", () => {
    const parsed = parseSignatureInput(
      'sig-pp=("@target-uri");alg="ecdsa-p256-sha256";keyid="K:1";created=1;expires=2'
    )!;
    const base = buildSignatureBase(parsed, {
      method: "POST",
      authority: "x",
      path: "/y",
      getHeader: () => "v",
    });
    expect(base).toBeNull();
  });
});

describe("contentDigestMatches — RFC 9530 body integrity", () => {
  const body = '{"depositId":"8917c345-4791-4285-a416-62f24b6982db","status":"COMPLETED"}';

  async function digestHeader(algo: "SHA-256" | "SHA-512"): Promise<string> {
    const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(body));
    const name = algo === "SHA-256" ? "sha-256" : "sha-512";
    return `${name}=:${base64Encode(new Uint8Array(digest))}:`;
  }

  test("valid sha-256 digest accepted", async () => {
    expect(await contentDigestMatches(body, await digestHeader("SHA-256"))).toBe(true);
  });

  test("valid sha-512 digest accepted", async () => {
    expect(await contentDigestMatches(body, await digestHeader("SHA-512"))).toBe(true);
  });

  test("tampered body rejected", async () => {
    const header = await digestHeader("SHA-256");
    expect(await contentDigestMatches(body + " ", header)).toBe(false);
    expect(await contentDigestMatches(body.replace("COMPLETED", "FAILED"), header)).toBe(false);
  });

  test("malformed digest header rejected", async () => {
    expect(await contentDigestMatches(body, "md5=:abc:")).toBe(false);
    expect(await contentDigestMatches(body, "garbage")).toBe(false);
    expect(await contentDigestMatches(body, "")).toBe(false);
  });
});

describe("isSignatureFresh", () => {
  const now = 1714657551 * 1000;

  test("inside window → fresh", () => {
    expect(isSignatureFresh(1714657551, 1714657611, now)).toBe(true);
  });

  test("expired beyond skew → not fresh", () => {
    expect(isSignatureFresh(1714657551, 1714657611, now + 3600 * 1000)).toBe(false);
  });

  test("missing created/expires → not fresh (fail closed)", () => {
    expect(isSignatureFresh(null, 1714657611, now)).toBe(false);
    expect(isSignatureFresh(1714657551, null, now)).toBe(false);
  });
});

describe("verifyRfc9421Signature — real ECDSA P-256 keypair", () => {
  async function makeKeypair() {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
    const pem = `-----BEGIN PUBLIC KEY-----\n${base64Encode(new Uint8Array(spki))}\n-----END PUBLIC KEY-----\n`;
    return { pair, pem };
  }

  async function signBase(pair: CryptoKeyPair, base: string): Promise<string> {
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(base)
    );
    return `sig-pp=:${base64Encode(new Uint8Array(sig))}:`;
  }

  const base = [
    '"@method": POST',
    '"@authority": fiery-hare-105.convex.site',
    '"@path": /pawapay/webhook',
    '@signature-params: ("@method" "@authority" "@path");alg="ecdsa-p256-sha256";keyid="HTTP_EC_P256_KEY:1";created=1714657551;expires=1714657611',
  ].join("\n");

  test("valid signature over the base verifies", async () => {
    const { pair, pem } = await makeKeypair();
    const header = await signBase(pair, base);
    expect(
      await verifyRfc9421Signature({
        signatureBase: base,
        signatureHeader: header,
        algorithm: "ecdsa-p256-sha256",
        publicKeyPem: pem,
      })
    ).toBe(true);
  });

  test("tampered base fails", async () => {
    const { pair, pem } = await makeKeypair();
    const header = await signBase(pair, base);
    expect(
      await verifyRfc9421Signature({
        signatureBase: base + "\n",
        signatureHeader: header,
        algorithm: "ecdsa-p256-sha256",
        publicKeyPem: pem,
      })
    ).toBe(false);
  });

  test("wrong key fails", async () => {
    const { pair } = await makeKeypair();
    const other = await makeKeypair();
    const header = await signBase(pair, base);
    expect(
      await verifyRfc9421Signature({
        signatureBase: base,
        signatureHeader: header,
        algorithm: "ecdsa-p256-sha256",
        publicKeyPem: other.pem,
      })
    ).toBe(false);
  });

  test("unknown algorithm fails closed", async () => {
    const { pair, pem } = await makeKeypair();
    const header = await signBase(pair, base);
    expect(
      await verifyRfc9421Signature({
        signatureBase: base,
        signatureHeader: header,
        algorithm: "totally-made-up",
        publicKeyPem: pem,
      })
    ).toBe(false);
    expect(
      await verifyRfc9421Signature({
        signatureBase: base,
        signatureHeader: header,
        algorithm: null,
        publicKeyPem: pem,
      })
    ).toBe(false);
  });

  test("malformed signature header or key fails", async () => {
    const { pem } = await makeKeypair();
    expect(
      await verifyRfc9421Signature({
        signatureBase: base,
        signatureHeader: "garbage",
        algorithm: "ecdsa-p256-sha256",
        publicKeyPem: pem,
      })
    ).toBe(false);
    expect(
      await verifyRfc9421Signature({
        signatureBase: base,
        signatureHeader: "sig-pp=:AA==:",
        algorithm: "ecdsa-p256-sha256",
        publicKeyPem: "not a pem",
      })
    ).toBe(false);
  });
});

// ------------------------------------------------------------
// DER → P1363 — pawaPay's real ECDSA signature framing
// ------------------------------------------------------------
describe("DER-encoded ECDSA signatures (pawaPay's framing)", () => {
  // Test-side encoder: raw r||s → ASN.1 DER, mirroring how pawaPay frames
  // ECDSA signatures (0x00 sign-padding byte when the high bit is set).
  const encodeInt = (v: Uint8Array): Uint8Array => {
    let i = 0;
    while (i < v.length && v[i] === 0x00) i++;
    const core = i >= v.length ? new Uint8Array([0]) : v.subarray(i);
    const pad = core[0] & 0x80 ? 1 : 0;
    const out = new Uint8Array(2 + pad + core.length);
    out[0] = 0x02;
    out[1] = pad + core.length;
    if (pad) out[2] = 0x00;
    out.set(core, 2 + pad);
    return out;
  };
  const rawToDerP256 = (raw: Uint8Array): Uint8Array => {
    const r = encodeInt(raw.subarray(0, 32));
    const s = encodeInt(raw.subarray(32, 64));
    const seq = new Uint8Array(2 + r.length + s.length);
    seq[0] = 0x30;
    seq[1] = r.length + s.length; // short form: always < 128 for P-256
    seq.set(r, 2);
    seq.set(s, 2 + r.length);
    return seq;
  };

  async function makeKeypair() {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
    const pem = `-----BEGIN PUBLIC KEY-----\n${base64Encode(new Uint8Array(spki))}\n-----END PUBLIC KEY-----\n`;
    return { pair, pem };
  }

  const BASE = [
    '"@method": POST',
    '"@authority": grateful-marlin-992.eu-west-1.convex.site',
    '"@path": /pawapay/webhook',
    '@signature-params: ("@method" "@authority" "@path");alg="ecdsa-p256-sha256";keyid="HTTP_EC_P256_KEY:1"',
  ].join("\n");

  test("a real P-256 signature, DER-framed, verifies end-to-end (raw still verifies)", async () => {
    const { pair, pem } = await makeKeypair();
    const raw = new Uint8Array(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(BASE))
    );
    expect(raw.length).toBe(64);
    const der = rawToDerP256(raw);
    expect(der[0]).toBe(0x30);
    expect(
      await verifyRfc9421Signature({
        signatureBase: BASE,
        signatureHeader: `sig-pp=:${base64Encode(der)}:`,
        algorithm: "ecdsa-p256-sha256",
        publicKeyPem: pem,
      })
    ).toBe(true);
    // Existing raw-format behavior preserved:
    expect(
      await verifyRfc9421Signature({
        signatureBase: BASE,
        signatureHeader: `sig-pp=:${base64Encode(raw)}:`,
        algorithm: "ecdsa-p256-sha256",
        publicKeyPem: pem,
      })
    ).toBe(true);
  });

  test("round-trips signatures with and without 0x00 sign-padding byte-for-byte", async () => {
    const { pair } = await makeKeypair();
    let sawPad = false;
    let sawNoPad = false;
    for (let i = 0; i < 20 && !(sawPad && sawNoPad); i++) {
      const data = new TextEncoder().encode(`pawapay-der-roundtrip-${i}`);
      const raw = new Uint8Array(
        await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, data)
      );
      const der = rawToDerP256(raw);
      // 0x02 0x21 = 33-byte (sign-padded) integer; 0x02 0x20 = plain 32-byte.
      for (let j = 0; j + 1 < der.length; j++) {
        if (der[j] === 0x02 && der[j + 1] === 0x21) sawPad = true;
        if (der[j] === 0x02 && der[j + 1] === 0x20) sawNoPad = true;
      }
      const conv = derEcdsaToRaw(der, 32);
      expect(conv).not.toBeNull();
      expect(Array.from(conv!)).toEqual(Array.from(raw));
    }
    expect(sawPad).toBe(true);
    expect(sawNoPad).toBe(true);
  });

  test("converts implicit-leading-zero (31-byte) and sign-padded (33-byte) integers to exactly 32", () => {
    // r: 31-byte value → must be left-padded with one 0x00 to 32 bytes.
    const r = new Uint8Array(31).fill(0x42);
    r[0] = 0x01;
    const rEnc = new Uint8Array(2 + r.length);
    rEnc[0] = 0x02;
    rEnc[1] = r.length;
    rEnc.set(r, 2);
    // s: 33-byte content (0x00 + 32 bytes with high bit set) → strip the pad.
    const sCore = new Uint8Array(32).fill(0x11);
    sCore[0] = 0x80;
    const sEnc = new Uint8Array(2 + 1 + sCore.length);
    sEnc[0] = 0x02;
    sEnc[1] = 1 + sCore.length;
    sEnc[2] = 0x00;
    sEnc.set(sCore, 3);
    const der = new Uint8Array(2 + rEnc.length + sEnc.length);
    der[0] = 0x30;
    der[1] = rEnc.length + sEnc.length;
    der.set(rEnc, 2);
    der.set(sEnc, 2 + rEnc.length);

    const conv = derEcdsaToRaw(der, 32);
    expect(conv).not.toBeNull();
    expect(conv!.length).toBe(64);
    expect(conv![0]).toBe(0x00); // left-pad byte before the 31-byte value
    expect(Array.from(conv!.subarray(1, 32))).toEqual(Array.from(r));
    expect(conv![32]).toBe(0x80); // s's sign pad stripped → 32 bytes land exactly at index 32
    expect(Array.from(conv!.subarray(33, 64))).toEqual(Array.from(sCore.subarray(1)));
  });

  test("malformed DER is rejected: structure, lengths, signs, trailing bytes", () => {
    const valid = rawToDerP256(new Uint8Array(64).map((_, i) => (i * 7 + 3) & 0x7f));
    expect(derEcdsaToRaw(valid, 32)).not.toBeNull();

    const trail = new Uint8Array(valid.length + 1);
    trail.set(valid);
    const wrongTag = Uint8Array.from(valid);
    wrongTag[0] = 0x31;
    const longForm = Uint8Array.from(valid);
    longForm[1] = 0x81;
    const shortClaim = Uint8Array.from(valid);
    shortClaim[1] = valid[1] - 1;
    // oversized r: 34-byte INTEGER content
    const big = new Uint8Array(2 + 2 + 34 + 3);
    big[0] = 0x30;
    big[1] = 39;
    big[2] = 0x02;
    big[3] = 34;
    big.fill(0x01, 4, 38);
    big[38] = 0x02;
    big[39] = 0x01;
    big[40] = 0x01;

    const cases: Array<[string, Uint8Array]> = [
      ["truncated", valid.subarray(0, valid.length - 1)],
      ["trailing bytes", trail],
      ["wrong SEQUENCE tag", wrongTag],
      ["long-form length", longForm],
      ["sequence length mismatch", shortClaim],
      ["negative integer", new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x80, 0x02, 0x01, 0x01])],
      ["empty integer", new Uint8Array([0x30, 0x06, 0x02, 0x00, 0x02, 0x02, 0x00, 0x01])],
      ["non-minimal padding", new Uint8Array([0x30, 0x08, 0x02, 0x02, 0x00, 0x01, 0x02, 0x02, 0x00, 0x01])],
      ["garbage input", new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])],
      ["empty input", new Uint8Array(0)],
      ["oversized integer", big],
    ];
    for (const [name, bytes] of cases) {
      expect(derEcdsaToRaw(bytes, 32), name).toBeNull();
    }
  });

  test("malformed DER passed as a signature header fails verification safely", async () => {
    const { pem } = await makeKeypair();
    const malformed = base64Encode(
      new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x80, 0x02, 0x01, 0x01])
    );
    expect(
      await verifyRfc9421Signature({
        signatureBase: BASE,
        signatureHeader: `sig-pp=:${malformed}:`,
        algorithm: "ecdsa-p256-sha256",
        publicKeyPem: pem,
      })
    ).toBe(false);
  });
});

// ------------------------------------------------------------
// Stage diagnostics — distinguish parse/encoding failures from crypto
// ------------------------------------------------------------
describe("verifyRfc9421SignatureDetailed — stage diagnostics", () => {
  async function makeKeypair() {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
    const pem = `-----BEGIN PUBLIC KEY-----\n${base64Encode(new Uint8Array(spki))}\n-----END PUBLIC KEY-----\n`;
    return { pair, pem };
  }
  const signRaw = async (pair: CryptoKeyPair, msg: string): Promise<Uint8Array> =>
    new Uint8Array(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(msg))
    );
  const hdr = (bytes: Uint8Array): string => `sig-pp=:${base64Encode(bytes)}:`;
  const BASE = '"@method": POST\n@signature-params: ("@method");alg="ecdsa-p256-sha256";keyid="K:1"';

  // Test-side DER framing for the success path (mirrors pawaPay's encoding).
  const derOf = (raw: Uint8Array): Uint8Array => {
    const enc = (v: Uint8Array): Uint8Array => {
      let i = 0;
      while (i < v.length && v[i] === 0x00) i++;
      const core = i >= v.length ? new Uint8Array([0]) : v.subarray(i);
      const pad = core[0] & 0x80 ? 1 : 0;
      const out = new Uint8Array(2 + pad + core.length);
      out[0] = 0x02;
      out[1] = pad + core.length;
      if (pad) out[2] = 0x00;
      out.set(core, 2 + pad);
      return out;
    };
    const r = enc(raw.subarray(0, 32));
    const s = enc(raw.subarray(32, 64));
    const seq = new Uint8Array(2 + r.length + s.length);
    seq[0] = 0x30;
    seq[1] = r.length + s.length;
    seq.set(r, 2);
    seq.set(s, 2 + r.length);
    return seq;
  };

  const SAFE_KEYS = ["alg", "convlen", "crypto", "declen", "enc", "key", "reason"];

  test("diagnostics expose only safe metadata keys", async () => {
    const { pair, pem } = await makeKeypair();
    const { diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: hdr(await signRaw(pair, BASE)),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(Object.keys(diag).sort()).toEqual(SAFE_KEYS);
    // No byte material ever appears in stringified diagnostics.
    const s = JSON.stringify(diag);
    expect(s).not.toMatch(/[A-Za-z0-9+/]{40,}/); // no long base64 runs (signature/key material)
  });

  test("malformed Signature header → sig_header_format", async () => {
    const { pem } = await makeKeypair();
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: "this-is-not-a-signature",
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(ok).toBe(false);
    expect(diag.reason).toBe("sig_header_format");
    expect(diag.enc).toBe("none");
    expect(diag.declen).toBeNull();
  });

  test("undecodable base64 payload → sig_decode_failed", async () => {
    const { pem } = await makeKeypair();
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: "sig-pp=:AAAAA:", // 5 chars — passes the header regex, fails strict base64
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(ok).toBe(false);
    expect(diag.reason).toBe("sig_decode_failed");
    expect(diag.declen).toBeNull();
  });

  test("unknown algorithm → alg_unsupported (fail closed)", async () => {
    const { pair, pem } = await makeKeypair();
    const raw = await signRaw(pair, BASE);
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: hdr(raw),
      algorithm: "hs2019",
      publicKeyPem: pem,
    });
    expect(ok).toBe(false);
    expect(diag.reason).toBe("alg_unsupported");
    expect(diag.alg).toBe("hs2019");
    expect(diag.declen).toBe(64);
    expect(diag.key).toBe("ok");
  });

  test("absurd signature length → sig_length_invalid", async () => {
    const { pem } = await makeKeypair();
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: hdr(new Uint8Array(10).fill(7)),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(ok).toBe(false);
    expect(diag.reason).toBe("sig_length_invalid");
    expect(diag.declen).toBe(10);
  });

  test("DER-shaped but malformed bytes → der_conversion_failed", async () => {
    const { pem } = await makeKeypair();
    const broken = new Uint8Array(70);
    broken[0] = 0x30;
    broken[1] = 68; // plausible SEQUENCE length, invalid INTEGER structure
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: hdr(broken),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(ok).toBe(false);
    expect(diag.reason).toBe("der_conversion_failed");
    expect(diag.declen).toBe(70);
    expect(diag.enc).toBe("none");
  });

  test("valid raw signature → ok with enc=raw, crypto=pass", async () => {
    const { pair, pem } = await makeKeypair();
    const raw = await signRaw(pair, BASE);
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: hdr(raw),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(ok).toBe(true);
    expect(diag.reason).toBe("ok");
    expect(diag.enc).toBe("raw");
    expect(diag.declen).toBe(64);
    expect(diag.convlen).toBeNull();
    expect(diag.key).toBe("ok");
    expect(diag.crypto).toBe("pass");
  });

  test("valid DER signature → ok with enc=der, convlen=64", async () => {
    const { pair, pem } = await makeKeypair();
    const der = derOf(await signRaw(pair, BASE));
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: hdr(der),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(ok).toBe(true);
    expect(diag.enc).toBe("der");
    expect(diag.declen).toBe(der.length);
    expect(diag.convlen).toBe(64);
    expect(diag.crypto).toBe("pass");
  });

  test("tampered base → crypto_verify_false (parse/encoding succeeded)", async () => {
    const { pair, pem } = await makeKeypair();
    const sig = await signRaw(pair, BASE);
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: `${BASE}\n",x`, // base differs from what was signed
      signatureHeader: hdr(sig),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(ok).toBe(false);
    expect(diag.reason).toBe("crypto_verify_false");
    expect(diag.enc).toBe("raw");
    expect(diag.key).toBe("ok");
    expect(diag.crypto).toBe("false");
    // wrapper parity: same inputs, same verdict
    expect(
      await verifyRfc9421Signature({
        signatureBase: `${BASE}\n",x`,
        signatureHeader: hdr(sig),
        algorithm: "ecdsa-p256-sha256",
        publicKeyPem: pem,
      })
    ).toBe(false);
  });

  test("signature from a different key → crypto_verify_false with key=ok", async () => {
    const a = await makeKeypair();
    const b = await makeKeypair();
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: hdr(await signRaw(a.pair, BASE)),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: b.pem,
    });
    expect(ok).toBe(false);
    expect(diag.reason).toBe("crypto_verify_false");
    expect(diag.key).toBe("ok"); // PEM decoded fine; the crypto simply fails
  });

  test("unparseable public key → key_decode_failed", async () => {
    const { pair } = await makeKeypair();
    const { ok, diag } = await verifyRfc9421SignatureDetailed({
      signatureBase: BASE,
      signatureHeader: hdr(await signRaw(pair, BASE)),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: "not a pem",
    });
    expect(ok).toBe(false);
    expect(diag.reason).toBe("key_decode_failed");
    expect(diag.key).toBe("fail");
  });

  test("RFC 9421 base: independent hand-written expected string, order-sensitive", async () => {
    const { pair, pem } = await makeKeypair();
    const si =
      'sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="K:1";created=1793190000;expires=1793190060';
    const headers: Record<string, string> = {
      "signature-date": "2026-10-28T14:00:00.000000Z",
      "content-digest":
        "sha-512=:mXRb9GJnfR/lyXOVfa27Wg+QrRgX3DVhXpQwjxbWoG3BgX7ZHmXLpvQb4il2kxgLjWmj6oSdwDdn5rUAJVYnUw==:",
      "content-type": "application/json; charset=UTF-8",
    };
    // Independently authored per RFC 9421 §2.2 / pawaPay's worked example:
    const expected = [
      '"@method": POST',
      '"@authority": grateful-marlin-992.eu-west-1.convex.site',
      '"@path": /pawapay/webhook',
      '"signature-date": 2026-10-28T14:00:00.000000Z',
      '"content-digest": sha-512=:mXRb9GJnfR/lyXOVfa27Wg+QrRgX3DVhXpQwjxbWoG3BgX7ZHmXLpvQb4il2kxgLjWmj6oSdwDdn5rUAJVYnUw==:',
      '"content-type": application/json; charset=UTF-8',
      `@signature-params: ("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="K:1";created=1793190000;expires=1793190060`,
    ].join("\n");

    const parsed = parseSignatureInput(si);
    expect(parsed).not.toBeNull();
    const base = buildSignatureBase(parsed!, {
      method: "POST",
      authority: "grateful-marlin-992.eu-west-1.convex.site",
      path: "/pawapay/webhook",
      getHeader: (n) => headers[n] ?? null,
    });
    expect(base).toBe(expected); // reconstruction matches the independent string byte-for-byte

    // A real signature over the reconstructed base verifies end-to-end …
    const sig = await signRaw(pair, expected);
    const good = await verifyRfc9421SignatureDetailed({
      signatureBase: base!,
      signatureHeader: hdr(sig),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(good.ok).toBe(true);

    // … and covered-component ORDER matters: reordering yields a different
    // base, so the same signature must fail as a crypto mismatch.
    const reordered =
      'sig-pp=("content-type" "@method" "@authority" "@path" "signature-date" "content-digest");alg="ecdsa-p256-sha256";keyid="K:1";created=1793190000;expires=1793190060';
    const parsed2 = parseSignatureInput(reordered)!;
    const base2 = buildSignatureBase(parsed2, {
      method: "POST",
      authority: "grateful-marlin-992.eu-west-1.convex.site",
      path: "/pawapay/webhook",
      getHeader: (n) => headers[n] ?? null,
    });
    expect(base2).not.toBe(expected);
    const wrongOrder = await verifyRfc9421SignatureDetailed({
      signatureBase: base2!,
      signatureHeader: hdr(sig),
      algorithm: "ecdsa-p256-sha256",
      publicKeyPem: pem,
    });
    expect(wrongOrder.ok).toBe(false);
    expect(wrongOrder.diag.reason).toBe("crypto_verify_false");
  });
});

// ------------------------------------------------------------
// Gate diagnostics — every 401 names its gate and exposes nothing else
// ------------------------------------------------------------
describe("gate diagnostics — each 401 reports its gate, no secrets", () => {
  const TOKEN = GATE_DIAG_TEST_TOKEN;
  const WEBHOOK_URL = "https://grateful-marlin-992.eu-west-1.convex.site/pawapay/webhook";
  const BODY = JSON.stringify({
    depositId: VALID_DEPOSIT_ID,
    status: "COMPLETED",
    amount: "115",
    currency: "ZMW",
  });
  const B64 = (bytes: Uint8Array): string => base64Encode(bytes);

  type Handler = (ctx: unknown, request: Request) => Promise<Response>;
  let webhook: Handler | null = null;
  let logged: string[] = [];
  let origLog: typeof console.log;
  const priorToken = process.env.PAWAPAY_API_TOKEN;

  const ctx = {
    runMutation: async () => {
      throw new Error("a gate rejection must never reach settlement");
    },
  };

  const digestHeader = async (body: string): Promise<string> => {
    const d = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(body));
    return `sha-512=:${B64(new Uint8Array(d))}:`;
  };

  const freshParams = (): string => {
    const now = Math.floor(Date.now() / 1000);
    return `created=${now - 5};expires=${now + 60}`;
  };

  const makeRequest = (headers: Record<string, string>, body = BODY): Request =>
    new Request(WEBHOOK_URL, { method: "POST", headers, body });

  const expectGate = async (req: Request, gate: string): Promise<void> => {
    logged = [];
    const res = await webhook!(ctx, req);
    expect(res.status).toBe(401);
    const text = await res.text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    // The rejection exposes exactly two fields — error and gate.
    expect(Object.keys(parsed).sort()).toEqual(["error", "gate"]);
    expect(parsed.gate).toBe(gate);
    // The rejection log is the bare gate tag — plus, for the signature
    // gate only, the TEMPORARY stage-diagnostic line carrying safe
    // metadata fields (never raw signature/key/body material).
    const gateLine = `[PawaPayWebhook] rejected gate=${gate}`;
    if (gate === "signature_invalid") {
      expect(logged.length).toBe(2);
      expect(logged).toContain(gateLine);
      const sigdiag = logged.find((l) => l.startsWith("[PawaPayWebhook] sigdiag "));
      expect(sigdiag).toBeDefined();
      const json = sigdiag!.slice(sigdiag!.indexOf("{"));
      const diag = JSON.parse(json) as Record<string, unknown>;
      // Exactly the safe metadata field set — nothing more.
      expect(Object.keys(diag).sort()).toEqual(["alg", "convlen", "crypto", "declen", "enc", "key", "reason"]);
      expect(json).not.toMatch(/[A-Za-z0-9+/]{40,}/); // no long base64 runs (signature/key bytes)
    } else {
      expect(logged).toEqual([gateLine]);
    }
    // No token, auth material, key material, or callback payload leaks.
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("Bearer");
    expect(text).not.toContain("BEGIN PUBLIC KEY");
    expect(text).not.toContain("COMPLETED");
    expect(logged.join("\n")).not.toContain(TOKEN);
  };

  beforeAll(async () => {
    process.env.PAWAPAY_API_TOKEN = TOKEN;
    webhook = (await import("../convex/pawapayWebhook")).pawaPayWebhook as unknown as Handler;
    origLog = console.log;
    console.log = (...args: unknown[]): void => {
      logged.push(args.map(String).join(" "));
    };
  });

  afterAll(() => {
    console.log = origLog;
    if (priorToken === undefined) delete process.env.PAWAPAY_API_TOKEN;
    else process.env.PAWAPAY_API_TOKEN = priorToken;
  });

  test("missing headers → gate missing_headers", async () => {
    await expectGate(
      makeRequest({ "Content-Type": "application/json" }),
      "missing_headers"
    );
  });

  test("altered/incorrect digest → gate digest_mismatch", async () => {
    await expectGate(
      makeRequest({
        "Content-Type": "application/json",
        Signature: "sig-pp=:AA==:",
        "Signature-Input": `sig-pp=("@method");alg="ecdsa-p256-sha256";keyid="K:1";${freshParams()}`,
        "Content-Digest": "sha-512=:AAAA:",
      }),
      "digest_mismatch"
    );
  });

  test("unparseable Signature-Input → gate malformed_signature_input", async () => {
    await expectGate(
      makeRequest({
        "Content-Type": "application/json",
        Signature: "sig-pp=:AA==:",
        "Signature-Input": "this is not a signature-input",
        "Content-Digest": await digestHeader(BODY),
      }),
      "malformed_signature_input"
    );
  });

  test("stale timestamps → gate freshness", async () => {
    await expectGate(
      makeRequest({
        "Content-Type": "application/json",
        Signature: "sig-pp=:AA==:",
        "Signature-Input": `sig-pp=("@method");alg="ecdsa-p256-sha256";keyid="K:1";created=1;expires=2`,
        "Content-Digest": await digestHeader(BODY),
      }),
      "freshness"
    );
  });

  test("unsupported derived component → gate signature_base", async () => {
    await expectGate(
      makeRequest({
        "Content-Type": "application/json",
        Signature: "sig-pp=:AA==:",
        "Signature-Input": `sig-pp=("@method" "@query");alg="ecdsa-p256-sha256";keyid="K:1";${freshParams()}`,
        "Content-Digest": await digestHeader(BODY),
      }),
      "signature_base"
    );
  });

  test("absent keyid → gate missing_keyid", async () => {
    await expectGate(
      makeRequest({
        "Content-Type": "application/json",
        Signature: "sig-pp=:AA==:",
        "Signature-Input": `sig-pp=("@method" "@authority" "@path");alg="ecdsa-p256-sha256";${freshParams()}`,
        "Content-Digest": await digestHeader(BODY),
      }),
      "missing_keyid"
    );
  });

  test("keyid absent from Public Keys response → gate unknown_keyid", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([{ id: "SOME_OTHER_KEY", key: "-----BEGIN PUBLIC KEY-----\nXX\n-----END PUBLIC KEY-----\n" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof globalThis.fetch;
    try {
      await expectGate(
        makeRequest({
          "Content-Type": "application/json",
          Signature: "sig-pp=:AA==:",
          "Signature-Input": `sig-pp=("@method" "@authority" "@path" "content-type");alg="ecdsa-p256-sha256";keyid="HTTP_EC_P256_KEY:1";${freshParams()}`,
          "Content-Digest": await digestHeader(BODY),
        }),
        "unknown_keyid"
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("verification failure → gate signature_invalid", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
    const pem = `-----BEGIN PUBLIC KEY-----\n${B64(new Uint8Array(spki))}\n-----END PUBLIC KEY-----\n`;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([{ id: "HTTP_EC_P256_KEY:1", key: pem }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof globalThis.fetch;
    try {
      await expectGate(
        makeRequest({
          "Content-Type": "application/json",
          Signature: "sig-pp=:AA==:", // well-formed header, cryptographically invalid
          "Signature-Input": `sig-pp=("@method" "@authority" "@path" "content-type");alg="ecdsa-p256-sha256";keyid="HTTP_EC_P256_KEY:1";${freshParams()}`,
          "Content-Digest": await digestHeader(BODY),
        }),
        "signature_invalid"
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("source guard: no bare 401 returns remain — all go through gate401", () => {
    const src = readConvex("pawapayWebhook.ts");
    // Every rejection call site routes through gate401 …
    expect(src.match(/return gate401\(/g)?.length).toBe(8);
    // … and the only jsonResponse(401 in the file is the one inside gate401.
    expect(src.match(/jsonResponse\(401/g)?.length).toBe(1);
  });
});

// ------------------------------------------------------------
// Source-level wiring guards (order and secrets)
// ------------------------------------------------------------
describe("wiring guards — webhook security order", () => {
  const webhook = readConvex("pawapayWebhook.ts");
  const pawapaySrc = readConvex("pawapay.ts");

  test("http.ts registers the /pawapay/webhook POST route", () => {
    const httpSrc = readConvex("http.ts");
    expect(httpSrc).toContain('path: "/pawapay/webhook"');
    expect(httpSrc).toContain('method: "POST"');
  });

  test("webhook verifies the signature BEFORE fetching/using the body's deposit", () => {
    const verifyIdx = webhook.indexOf("verifyRfc9421SignatureDetailed(");
    const fetchIdx = webhook.indexOf("fetchDepositStatus(");
    // Match the actual call site, not doc-comment mentions.
    const applyIdx = webhook.indexOf("ctx.runMutation(internal.pawapay.applyDepositStatus");
    expect(verifyIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(verifyIdx); // independent recheck after verify
    expect(applyIdx).toBeGreaterThan(fetchIdx); // apply only after recheck
  });

  test("webhook fails closed when the token is missing (503)", () => {
    expect(webhook).toContain("503");
    expect(webhook).toContain("PAWAPAY_API_TOKEN");
  });

  test("webhook requires signature headers (401 path present)", () => {
    expect(webhook).toContain("Missing signature headers");
  });

  test("no token/secret values are ever logged", () => {
    expect(webhook).not.toMatch(/console\.(log|error|warn)\([^)]*PAWAPAY_API_TOKEN[^)]*\)/);
    expect(pawapaySrc).not.toMatch(/console\.(log|error|warn)\([^)]*PAWAPAY_API_TOKEN[^)]*\)/);
    // Never log the Authorization header or raw callback body.
    expect(webhook).not.toContain("console.log(rawBody");
    expect(webhook).not.toMatch(/console\.\w+\([^)]*Bearer[^)]*\)/);
  });

  test("initiate persists the pending transaction BEFORE calling pawaPay", () => {
    const initiateIdx = pawapaySrc.indexOf("initiatePawapayDeposit = action");
    const persistIdx = pawapaySrc.indexOf("internal.pawapay.createPendingDeposit", initiateIdx);
    // The POST call: fetch(`${baseUrl()}/v2/deposits`, — unique to initiate
    // (fetchDepositStatus uses /v2/deposits/{id}, not this exact form).
    const callIdx = pawapaySrc.indexOf("${baseUrl()}/v2/deposits`", initiateIdx);
    expect(initiateIdx).toBeGreaterThan(-1);
    expect(persistIdx).toBeGreaterThan(initiateIdx);
    expect(callIdx).toBeGreaterThan(persistIdx);
  });

  test("initiate accepts ONLY phoneNumber + provider (amount is server-side)", () => {
    expect(pawapaySrc).toMatch(
      /initiatePawapayDeposit = action\(\{\s*args: \{\s*phoneNumber: v\.string\(\),\s*provider: v\.string\(\),/
    );
  });

  test("Pro grant routes through the shared updateTransactionStatus mutation", () => {
    expect(pawapaySrc).toContain("internal.mobileMoney.updateTransactionStatus");
  });

  test("schema carries the optional pawaPayProvider field", () => {
    const schemaSrc = readConvex("schema.ts");
    expect(schemaSrc).toContain("pawaPayProvider: v.optional(v.string())");
  });

  test("reconciliation cron registered", () => {
    const cronSrc = readConvex("crons.ts");
    expect(cronSrc).toContain('"pawapay_reconciliation"');
    expect(cronSrc).toContain("internal.pawapay.reconcilePendingDeposits");
  });

  test("Settings UI wires initiate + status-check + sandbox label", () => {
    const settingsSrc = readRoot("src/pages/Settings.tsx");
    expect(settingsSrc).toContain("initiatePawapayDeposit");
    expect(settingsSrc).toContain("checkPawapayDepositStatus");
    expect(settingsSrc).toContain("ZMW 115");
    // The sandbox price is clearly labelled, never presented as the live price.
    expect(settingsSrc).toContain("no real money moves");
  });
});
