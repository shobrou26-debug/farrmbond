/**
 * TEMPORARY DIAGNOSTIC — DELETE AFTER RUNNING
 *
 * Tests the official MTN-documented OAuth request format:
 *   POST /oauth/access_token?grant_type=client_credentials
 *   Body: client_id={key}&client_secret={secret}
 *   Content-Type: application/x-www-form-urlencoded
 *
 * Reports ONLY: HTTP status, success/failure, sanitized error.
 * NEVER exposes: API keys, secrets, access tokens, or Authorization headers.
 */
import { action } from "./_generated/server";

const MTN_MOMO_API_KEY = process.env.MTN_MOMO_API_KEY;
const MTN_MOMO_API_SECRET = process.env.MTN_MOMO_API_SECRET;
const MTN_MOMO_API_URL = process.env.MTN_MOMO_API_URL || "https://api.mtn.com/v1";

export const diagnostic = action({
  args: {},
  handler: async () => {
    const results: Record<string, unknown> = {};

    // Step 1: Check credentials exist (never print values)
    results.credentialsExist = !!(MTN_MOMO_API_KEY && MTN_MOMO_API_SECRET);
    results.keyLength = MTN_MOMO_API_KEY ? MTN_MOMO_API_KEY.length : 0;
    results.secretLength = MTN_MOMO_API_SECRET ? MTN_MOMO_API_SECRET.length : 0;
    // First and last 2 chars only — for confirming which key is loaded (never expose full value)
    results.keyFingerprint = MTN_MOMO_API_KEY
      ? `${MTN_MOMO_API_KEY.slice(0, 2)}...${MTN_MOMO_API_KEY.slice(-2)}`
      : "not set";
    results.secretFingerprint = MTN_MOMO_API_SECRET
      ? `${MTN_MOMO_API_SECRET.slice(0, 2)}...${MTN_MOMO_API_SECRET.slice(-2)}`
      : "not set";

    if (!MTN_MOMO_API_KEY || !MTN_MOMO_API_SECRET) {
      results.overall = "FAIL — credentials not configured";
      return results;
    }

    // Official MTN format: grant_type in query param, credentials in body
    const tokenUrl = `${MTN_MOMO_API_URL}/oauth/access_token?grant_type=client_credentials`;
    results.tokenEndpoint = tokenUrl;

    try {
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

      results.httpStatus = response.status;
      results.httpStatusText = response.statusText;

      if (response.ok) {
        const data = await response.json();
        results.status = "SUCCESS";
        results.diagnosis = "OAUTH SUCCESS — token received";
        results.tokenType = data.token_type || "unknown";
        results.expiresIn = data.expires_in || "unknown";
        results.accessTokenPresent =
          typeof data.access_token === "string" && data.access_token.length > 0;
        // NEVER print access_token
      } else {
        const bodyText = await response.text().catch(() => "");
        results.status = "FAIL";
        results.responsePreview = bodyText.substring(0, 300);

        if (response.status === 401) {
          results.diagnosis = "INVALID_CREDENTIALS — Key/Secret rejected by MTN";
        } else if (response.status === 403) {
          results.diagnosis = "FORBIDDEN — Credentials valid but Payments V1 scope not enabled";
        } else if (response.status === 400) {
          results.diagnosis = "BAD_REQUEST — Request format incorrect or credentials malformed";
        } else {
          results.diagnosis = `HTTP_${response.status}`;
        }
      }
    } catch (e) {
      results.status = "ERROR";
      results.diagnosis = "NETWORK_ERROR — " + (e instanceof Error ? e.message : String(e));
    }

    // Summary
    if (results.status === "SUCCESS") {
      results.overall = "OAUTH SUCCESS — update getMtnAccessToken() to match this format";
    } else {
      results.overall = `OAUTH FAILED — ${results.diagnosis}`;
    }

    return results;
  },
});
