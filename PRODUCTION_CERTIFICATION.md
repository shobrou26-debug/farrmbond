# FarmBond — External Service Production Certification Checklist

Release-candidate hardening, Phase 4. This is the **test plan** for every external
service the repository actually calls. An integration is only "certified" after
the exact procedure below has been executed against a real sandbox/live account
and the result verified in Convex — **code existing is not proof of a working
integration**.

Rules of engagement:

- Never print secret values (API keys, secrets, tokens) into logs or this
  document. Values are configured exclusively through the Convex environment
  (Freebuff Keys/API keys tab); nothing is committed to the repository.
- Every service below is **server-side only**: keys are read from
  `process.env` inside Convex actions/HTTP handlers and are never shipped to
  the browser bundle.
- Webhook endpoints are exposed by `src/convex/http.ts`.

---

## Status Summary

| # | Service | Env vars required | Sandbox available? | Webhook required? | Status |
|---|---------|-------------------|--------------------|-------------------|--------|
| 1 | Freebuff email OTP | `FREEBUFF_EMAIL_API_KEY` | Yes (same endpoint) | No | ⏳ NOT certified — needs live OTP test |
| 2 | Groq (AI chat) | `GROQ_API_KEY` | Yes (free tier) | No | ⏳ NOT certified — needs live key |
| 3 | Google Gemini (vision + chat fallback) | `GOOGLE_GEMINI_API_KEY` | Yes (free tier) | No | ⏳ NOT certified — needs live key |
| 4 | Copernicus Data Space (Sentinel-2) | `COPERNICUS_CLIENT_ID`, `COPERNICUS_CLIENT_SECRET` | Yes (free account) | No | ⏳ NOT certified — needs live credentials |
| 5 | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `APP_URL` | Yes (test mode) | Yes (`/stripe/webhook`) | ⏳ NOT certified — needs sandbox run |
| 6 | MTN MoMo | `MTN_MOMO_API_KEY`, `MTN_MOMO_API_USER`, `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_ENVIRONMENT`, `MOBILE_MONEY_WEBHOOK_SECRET` | Yes (sandbox) | Yes (`/momo/webhook`) | ⏳ NOT certified — needs sandbox run |
| 7 | Airtel Money | `AIRTEL_MONEY_CLIENT_ID`, `AIRTEL_MONEY_CLIENT_SECRET`, `MOBILE_MONEY_WEBHOOK_SECRET` | Yes (sandbox) | Yes (`/airtel/webhook`) | ⏳ NOT certified — needs sandbox run |
| 8 | Brevo (transactional email) | `BREVO_API_KEY`, `FROM_EMAIL`, `FROM_NAME`, `APP_URL` | Yes (free tier) | No | ⏳ NOT certified — degrades gracefully when absent |

Platform-managed (no action needed): `VITE_CONVEX_URL`, `CONVEX_SITE_URL`,
`VLY_CONVEX_AUTH_ISSUER`, auth JWKS/private key, `VLY_INTEGRATION_KEY`,
`VLY_APP_NAME`. Operator-managed: `BOOTSTRAP_ADMIN_EMAIL` (remove after
first-admin bootstrap).

---

## 1. Freebuff Email OTP (login)

- **Where:** `src/convex/auth/emailOtp.ts` (read-only auth file) → POSTs the
  one-time code to `https://auth.freebuff.app/send_otp` with header `x-api-key`.
- **Env vars:** `FREEBUFF_EMAIL_API_KEY` (required for any email sign-in),
  `VLY_APP_NAME` (sender label).
- **Failure behavior:** login cannot be completed without it. Missing key →
  `sendVerificationRequest` throws and the OTP is never delivered.
- **Test procedure:**
  1. Ensure `FREEBUFF_EMAIL_API_KEY` is set in the Keys tab.
  2. On `/auth`, request a code for a real inbox you control.
  3. Enter the 6-digit code within 15 minutes.
- **Expected result:** Email arrives within seconds; session created; user lands
  on the requested `returnTo` route.
- **Verify in Convex:** a `users` row exists for that email; Convex Auth session
  present; `auth` table shows the account.
- **Test required before launch:** ✅ yes — this is the primary registration path.

## 2. Groq (AI Farming Assistant)

- **Where:** `src/convex/aiAssistant.ts` → `chatWithAI` (action), model
  `llama-3.3-70b-versatile`, `https://api.groq.com/openai/v1/chat/completions`.
- **Env vars:** `GROQ_API_KEY` (required for chat).
- **Failure behavior:** missing key → action throws "AI service is not
  configured" (client shows guidance). Groq HTTP error → falls back to Gemini
  when `GOOGLE_GEMINI_API_KEY` is set, otherwise the error surfaces.
- **Quota (server-enforced):** free users 5 chats/day, Pro 500/day, counted
  from `auditLogs` rows with action `ai_chat` (index `by_user_action`).
- **Test procedure:**
  1. Sign in as a fresh free user; ask the assistant a farming question.
  2. Fire 5 more requests in the same UTC day → request 6 must be rejected with
     the daily-limit message.
  3. Repeat with an active Pro/trial account → passes 5, 50, 500.
  4. Temporarily unset `GROQ_API_KEY` → error message appears, no crash.
- **Expected result:** grounded, structured farming advice; quota messages
  clear; no client crash.
- **Verify in Convex:** `auditLogs` gains one `ai_chat` row per successful call;
  user `subscriptionTier` decides the limit.
- **Test required before launch:** ✅ yes.

## 3. Google Gemini (disease detection + chat fallback)

- **Where:** `src/convex/aiAssistant.ts` → `detectDisease` (action),
  `gemini-2.0-flash`, and `chatWithGeminiFallback`.
- **Env vars:** `GOOGLE_GEMINI_API_KEY` (required for image analysis).
- **Failure behavior:** missing key → action throws with setup guidance; the
  Disease Detection page shows the error banner and never fabricates a
  diagnosis.
- **Quota (server-enforced):** free 3 analyses/day, Pro 100/day, action
  `ai_disease`.
- **Test procedure:**
  1. Upload a real photo of a plant with visible symptoms → structured JSON
     diagnosis rendered (name, confidence, severity, treatments).
  2. Upload a clear healthy plant → "No issue detected" with general tips.
  3. Exceed the free daily cap → rejected with the upgrade message.
  4. Unset the key → clean error banner, no fake result saved.
- **Expected result:** diagnosis matches reality for the test image; severity
  is one of `low|medium|high|critical`; confidence 0–100 or null.
- **Verify in Convex:** `detectionResults` row per successful run (image via
  Convex file storage, not base64); `auditLogs` `ai_disease` rows count quota.
- **Test required before launch:** ✅ yes.

## 4. Copernicus Data Space Ecosystem (Sentinel-2 / NDVI)

- **Where:** `src/convex/satellite.ts` — CDSE OAuth token
  (`identity.dataspace.copernicus.eu`), catalog search (`catalogue.dataspace…`),
  Process API (`sh.dataspace.copernicus.eu/api/v1/process`), WMS map tiles.
- **Env vars:** `COPERNICUS_CLIENT_ID`, `COPERNICUS_CLIENT_SECRET`.
- **Access control (server-enforced):** every satellite query + the analysis
  action require an **active Pro subscription** (admins exempt). Free/expired
  users get a clean upgrade message; nothing is persisted on failure.
- **Failure behavior:** missing creds / auth failure / no cloud-free scene /
  unusable TIFF → `{ ok: false, reason }` and **nothing is written to the
  database** (no fabricated NDVI). The frontend renders the reason.
- **Test procedure:**
  1. Pro account → run "Analyze" on a farm with real GPS coordinates.
  2. Watch the action: token → scene search → NDVI process → store.
  3. Run again on a location with heavy cloud cover / no scenes (e.g. a
     non-agricultural or remote coordinate) → `ok:false` with reason.
  4. Free account → blocked before any external call.
- **Expected result:** `satelliteData` row with real `ndvi`, `vegetationCoverage`,
  `imageUrl` (WMS); NDVI trend chart shows only real measurements.
- **Verify in Convex:** `satelliteData` per farm; farm `ndviScore` updated;
  no rows created on failed runs.
- **Test required before launch:** ✅ yes (Pro path), ⏳ optional (no-data path).

## 5. Stripe (Pro subscriptions)

- **Where:** `src/convex/stripe.ts` (actions/internal mutations),
  `src/convex/stripeWebhook.ts` (HTTP handler at `/stripe/webhook`).
- **Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`,
  `APP_URL` (used for success/cancel/portal URLs).
- **Pricing/safety (server-enforced):** checkout fails loudly when
  `STRIPE_SECRET_KEY` or `STRIPE_PRICE_ID` is missing — there is **no**
  placeholder price fallback. Only the webhook (signature-verified, 5-minute
  timestamp window) may activate/renew/cancel; all six subscription mutations
  are `internalMutation`. Checkout activates Pro **only** when
  `payment_status === "paid"`. Client actions act only on the caller's own
  customer/subscription IDs.
- **Sandbox:** Stripe test mode — `sk_test_*` key, `whsec_*` webhook secret,
  a real `price_*` created in test mode, and the webhook endpoint pointed at
  `<CONVEX_SITE_URL>/stripe/webhook`.
- **Test procedure:**
  1. Checkout with the Stripe test card `4242 4242 4242 4242` → session URL
     opens, payment succeeds.
  2. Trigger `checkout.session.completed` + `invoice.payment_succeeded` (Stripe
     CLI: `stripe trigger ...`), or pay in the hosted page.
  3. Failed payment: `4000 0000 0000 0002` → `invoice.payment_failed` →
     `paymentFailureCount` increments, email scheduled.
  4. Cancellation: cancel in the customer portal → `customer.subscription.deleted`
     → user downgraded to free.
  5. Idempotency: replay the same event twice → user state is unchanged the
     second time (period end already set; downgrade already applied).
  6. Security: POST a forged body without a valid signature → 400, no state
     change. Tamper with `metadata.userId` in a signed body → rejected.
  7. Expiry: set `subscriptionEndDate` in the past via a test event →
     entitlement check (`isSubscriptionActive`) blocks Pro features.
- **Expected result:** Pro activates only after real payment; billing state
  matches Stripe; duplicate/replayed events are harmless; forged events are
  dropped.
- **Verify in Convex:** `users.stripeCustomerId/stripeSubscriptionId/
  stripeCurrentPeriodEnd/hasEverPaid`; `auditLogs` `subscription_activated`,
  `payment_failed`, `subscription_cancelled`.
- **Test required before launch:** ✅ yes.

## 6. MTN Mobile Money (MoMo)

- **Where:** `src/convex/mobileMoney.ts` (initiate), `mobileMoneyWebhook.ts`
  (HTTP at `/momo/webhook`).
- **Env vars:** `MTN_MOMO_API_KEY`, `MTN_MOMO_API_USER`,
  `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_ENVIRONMENT` (`sandbox`/`production`),
  `MOBILE_MONEY_WEBHOOK_SECRET`.
- **Webhook:** must be configured in the MTN MoMo sandbox portal to point at
  `<CONVEX_SITE_URL>/momo/webhook`; callbacks are signature/secret-checked and
  fail closed.
- **Test procedure:**
  1. Initiate a payment for a test phone number (sandbox numbers per MTN docs).
  2. Approve the payment in the sandbox portal → callback arrives.
  3. Verify state: payment row → `paid`, subscription activated (same rules as
     Stripe: only a settled payment grants Pro).
  4. Decline the payment → callback marks the row failed; no Pro grant.
  5. Replay/duplicate callback → idempotent (no double-charge, no double grant).
  6. Send a callback with a wrong/absent secret → rejected.
- **Expected result:** payment lifecycle (`pending → paid/failed`) mirrored in
  Convex; Pro granted only on settled payment; duplicates harmless.
- **Verify in Convex:** `mobileMoneyPayments` rows with external reference,
  status, and settled amount; `users.hasEverPaid/subscriptionTier`.
- **Test required before launch:** ✅ yes (MTN sandbox).

## 7. Airtel Money

- **Where:** `src/convex/mobileMoney.ts` (initiate), `mobileMoneyWebhook.ts`
  (HTTP at `/airtel/webhook`).
- **Env vars:** `AIRTEL_MONEY_CLIENT_ID`, `AIRTEL_MONEY_CLIENT_SECRET`,
  `MOBILE_MONEY_WEBHOOK_SECRET`.
- **Webhook:** configured in the Airtel Money sandbox portal →
  `<CONVEX_SITE_URL>/airtel/webhook`; callbacks verified and fail closed.
- **Test procedure:** identical to MTN (initiate → approve in sandbox →
  verify `paid` → decline → verify `failed` → replay → verify idempotent →
  bad secret → rejected).
- **Expected result / verify in Convex:** same as MTN above.
- **Test required before launch:** ✅ yes (Airtel sandbox).

## 8. Brevo (transactional email)

- **Where:** `src/convex/emails.ts` — trial warnings, subscription
  activated/expired/cancelled, payment-failed, payment-method reminders,
  vaccination reminders, low-coverage alerts. All senders are
  `internalAction` (never client-callable).
- **Env vars:** `BREVO_API_KEY`, `FROM_EMAIL`, `FROM_NAME`, `APP_URL`.
- **Failure behavior:** **degrades gracefully** — every sender returns
  `{ sent: false, reason: "…key not configured" }` when the key is absent;
  cron jobs and payment flows continue unaffected. Emails are a nicety, not a
  blocker.
- **Test procedure:**
  1. Set a real Brevo key (free tier, 300/day).
  2. Start a 7-day trial → set `trialEndDate` to +2 days → run
     `internal.emails.sendTrialExpiryWarning` (or wait for the daily cron).
  3. Trigger a webhook `invoice.payment_failed` → payment-failed email arrives.
  4. Remove the key → run the same job → `sent:false`, no throw.
- **Expected result:** emails deliver with correct FarmBond branding; absence
  of the key never breaks app or cron flows.
- **Verify in Convex:** `auditLogs` `trial_warning_sent` rows (dedup within 24h);
  Brevo dashboard shows delivered events.
- **Test required before launch:** ⏳ nice-to-have (feature is non-blocking).

---

## Notes for the operator

1. **Where to put keys:** Convex environment variables only (Freebuff
   Keys/API keys tab). Never `.env` files, never the client bundle.
2. **Webhook URL base:** `<CONVEX_SITE_URL>` is the production Convex site URL;
   register each webhook endpoint (Stripe, MTN, Airtel) against it.
3. **`APP_URL`** must be the real production origin — checkout success/cancel
   and all email links are built from it.
4. **First admin:** set `BOOTSTRAP_ADMIN_EMAIL`, claim it in the Dashboard
   (only possible while zero admins exist), then remove the variable.
5. **Do not mark any integration certified** until the corresponding procedure
   above has been executed and the Convex rows confirmed.
