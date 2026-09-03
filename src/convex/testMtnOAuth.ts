/**
 * TEMPORARY DIAGNOSTIC — DELETE AFTER RUNNING
 *
 * Tests TWO OAuth mechanisms against MTN Payments V1:
 *   Method A: client_id/client_secret in form-encoded body (current — returned HTTP 400)
 *   Method B: HTTP Basic Auth (client_id:client_secret base64-encoded)
 *
 * Reports ONLY: HTTP status, success/failure, mechanism that works.
 * NEVER exposes: API keys, secrets, access tokens, or Authorization headers.
 */
import { action } from "./_generated/server";

const MTN_MOMO_API_KEY = process.env.MTN_MOMO_API_KEY;
const MTN_MOMO_API_SECRET = process.env.MTN_MOMO_API_SECRET;
const MTN_MOMO_API_URL = process.env.MTN_MOMO_API_URL || "https://api.mtn.com/v1";

async function tryOAuth(
  label: string,
  tokenUrl: string,
  key: string,
  secret: string,
  useBasicAuth: boolean,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { method: label };

  try {
    const headers: Record<string, string> = {};
    let body: string;

    if (useBasicAuth) {
      // HTTP Basic Auth: base64(client_id:client_secret)
      const credentials = Buffer.from(`${key}:${secret}`).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = "grant_type=client_credentials";
    } else {
      // Form body: client_id and client_secret in the body
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: key,
        client_secret: secret,
      }).toString();
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers,
      body,
    });

    result.httpStatus = response.status;
    result.httpStatusText = response.statusText;

    if (response.ok) {
      const data = await response.json();
      result.status = "SUCCESS";
      result.diagnosis = `OAUTH SUCCESS via ${label} — token received`;
      result.tokenType = data.token_type || "unknown";
      result.expiresIn = data.expires_in || "unknown";
      result.accessTokenPresent = typeof data.access_token === "string" && data.access_token.length > 0;
      // NEVER print access_token
    } else {
      const bodyText = await response.text().catch(() => "");
      result.status = "FAIL";
      result.responsePreview = bodyText.substring(0, 300);

      if (response.status === 401) {
        result.diagnosis = "INVALID_CREDENTIALS — Key/Secret rejected by MTN";
      } else if (response.status === 403) {
        result.diagnosis = "FORBIDDEN — Credentials valid but Payments V1 scope not enabled";
      } else if (response.status === 400) {
        result.diagnosis = "BAD_REQUEST — This mechanism is also rejected";
      } else {
        result.diagnosis = `HTTP_${response.status}`;
      }
    }
  } catch (e) {
    result.status = "ERROR";
    result.diagnosis = "NETWORK_ERROR — " + (e instanceof Error ? e.message : String(e));
  }

  return result;
}

export const diagnostic = action({
  args: {},
  handler: async () => {
    const results: Record<string, unknown> = {};

    // Step 1: Check credentials exist (never print values)
    results.credentialsExist = !!(MTN_MOMO_API_KEY && MTN_MOMO_API_SECRET);
    results.keyLength = MTN_MOMO_API_KEY ? MTN_MOMO_API_KEY.length : 0;
    results.secretLength = MTN_MOMO_API_SECRET ? MTN_MOMO_API_SECRET.length : 0;

    if (!MTN_MOMO_API_KEY || !MTN_MOMO_API_SECRET) {
      results.overall = "FAIL — credentials not configured";
      return results;
    }

    const tokenUrl = `${MTN_MOMO_API_URL}/oauth/access_token`;
    results.tokenEndpoint = tokenUrl;

    // Step 2: Test Method A — Form body (current mechanism, returned 400)
    results.methodA_formBody = await tryOAuth(
      "form-body (client_id + client_secret in body)",
      tokenUrl,
      MTN_MOMO_API_KEY,
      MTN_MOMO_API_SECRET,
      false,
    );

    // Step 3: Test Method B — HTTP Basic Auth (standard OAuth2 alternative)
    results.methodB_basicAuth = await tryOAuth(
      "Basic Auth (base64(client_id:client_secret) in Authorization header)",
      tokenUrl,
      MTN_MOMO_API_KEY,
      MTN_MOMO_API_SECRET,
      true,
    );

    // Step 4: Summary
    const aSuccess = results.methodA_formBody as Record<string, unknown>;
    const bSuccess = results.methodB_basicAuth as Record<string, unknown>;

    if (aSuccess.status === "SUCCESS") {
      results.overall = "Method A (form-body) WORKS — keep current implementation";
    } else if (bSuccess.status === "SUCCESS") {
      results.overall = "Method B (Basic Auth) WORKS — switch getMtnAccessToken to use HTTP Basic Auth";
    } else {
      results.overall = `Both methods failed. A: ${aSuccess.diagnosis} | B: ${bSuccess.diagnosis}`;
    }

    return results;
  },
});
