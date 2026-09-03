/**
 * TEMPORARY DIAGNOSTIC — DELETE AFTER RUNNING
 *
 * Tests MTN Payments V1 OAuth authentication.
 * Reports ONLY: credentials existence, HTTP status, success/failure.
 * NEVER exposes: API keys, secrets, access tokens, or auth headers.
 */
import { action } from "./_generated/server";

const MTN_MOMO_API_KEY = process.env.MTN_MOMO_API_KEY;
const MTN_MOMO_API_SECRET = process.env.MTN_MOMO_API_SECRET;
const MTN_MOMO_API_URL = process.env.MTN_MOMO_API_URL || "https://api.mtn.com/v1";

export const diagnostic = action({
  args: {},
  handler: async () => {
    const result: Record<string, unknown> = {};

    // Step 1: Check credentials exist (never print values)
    result.credentialsExist = !!(MTN_MOMO_API_KEY && MTN_MOMO_API_SECRET);
    result.keyLength = MTN_MOMO_API_KEY ? MTN_MOMO_API_KEY.length : 0;
    result.secretLength = MTN_MOMO_API_SECRET ? MTN_MOMO_API_SECRET.length : 0;

    if (!MTN_MOMO_API_KEY || !MTN_MOMO_API_SECRET) {
      result.status = "FAIL";
      result.diagnosis = "MTN credentials not configured";
      return result;
    }

    // Step 2: Attempt OAuth (current form-body mechanism)
    try {
      const tokenUrl = `${MTN_MOMO_API_URL}/oauth/access_token`;
      result.tokenEndpoint = tokenUrl;

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: MTN_MOMO_API_KEY,
          client_secret: MTN_MOMO_API_SECRET,
        }).toString(),
      });

      result.httpStatus = response.status;
      result.httpStatusText = response.statusText;

      if (response.ok) {
        const data = await response.json();
        result.status = "SUCCESS";
        result.diagnosis = "OAUTH SUCCESS — token received";
        result.tokenType = data.token_type || "unknown";
        result.expiresIn = data.expires_in || "unknown";
        result.accessTokenPresent = typeof data.access_token === "string" && data.access_token.length > 0;
        // NEVER print access_token
      } else {
        const body = await response.text().catch(() => "");
        result.status = "FAIL";

        if (response.status === 401) {
          result.diagnosis = "INVALID_CREDENTIALS — Consumer Key/Secret rejected. Verify credentials are for Payments V1 (not Collection API) in MTN Developer Portal.";
        } else if (response.status === 403) {
          result.diagnosis = "FORBIDDEN — Credentials may be valid but application is not authorized for this API scope. Check MTN Developer Portal product subscriptions.";
        } else if (response.status === 400) {
          result.diagnosis = "BAD_REQUEST — May need Basic Auth instead of form body. Error body: " + body.substring(0, 200);
        } else {
          result.diagnosis = `UNEXPECTED_HTTP_${response.status} — ` + body.substring(0, 200);
        }
      }
    } catch (e) {
      result.status = "ERROR";
      result.diagnosis = "NETWORK_ERROR — " + (e instanceof Error ? e.message : String(e));
    }

    return result;
  },
});
