# FarmBond — Production Deployment Runbook (Freebuff)
_Target: production Convex deployment `fiery-hare-105` · Frontend: `https://farmbond.freebuff.app`_
_Prepared 2026-09-29 against the verified dev state: 599/599 tests · tsc clean · build passing · 13 cron jobs._
_The CLI `--prod` path is unreliable (known 401) — everything here uses the **Freebuff/Convex dashboard and browser only**._

---

## Legend
- ✅ = expected result. If you see anything else, STOP at that step and note the step number.
- Secrets are **never** displayed or pasted anywhere — every env check is **by NAME only**.

---

## STEP 1 — Push the current verified code to production

1. Open the Freebuff dashboard → this project → **Convex / deployment** view.
2. Switch the deployment selector to **production (`fiery-hare-105`)**.
3. Trigger **Deploy / Push** (the dashboard's deploy action — it pushes the current workspace functions, schema, and crons).
4. Wait for completion. Expected: schema validation passes and the job list updates (13 jobs).

> ⚠️ If the dashboard reports schema errors, stop and report the exact message — do not edit schema on prod directly.

**Why this matters:** prod currently runs an older push. It is live and serving auth correctly, but it lacks: the `users.imageStorageId` field + `by_image_storage` index, the `users` photo mutations, `weeklyDigest` functions, and the 13th cron (`weekly_digest`).

---

## STEP 2 — Environment variables: NAME-only parity check

Dashboard → deployment **production** → **Settings → Environment Variables**.

For each variable below: confirm the **name exists and has a non-empty value** (the dashboard shows names; do not open/reveal values).

| # | Variable | Required for | Present? |
|---|---|---|---|
| 1 | `MOBILE_MONEY_WEBHOOK_SECRET` | MoMo payment completion | ☐ |
| 2 | `BREVO_API_KEY` | All transactional email + weekly digest | ☐ |
| 3 | `COPERNICUS_CLIENT_ID` | Satellite/NDVI | ☐ |
| 4 | `COPERNICUS_CLIENT_SECRET` | Satellite/NDVI | ☐ |
| 5 | `GROQ_API_KEY` | AI assistant (primary) | ☐ |
| 6 | `GOOGLE_GEMINI_API_KEY` | AI fallback + disease detection | ☐ |
| 7 | `APP_URL` | Links inside emails; default `https://farmbond.freebuff.app` | ☐ |
| 8 | `CONVEX_SITE_URL` | Webhook callback base; must be `https://fiery-hare-105.convex.site` | ☐ |
| 9 | `MTN_MOMO_API_URL` | Leave **unset** (code default = live `https://api.mtn.com/v1`) unless MTN says sandbox | ☐ |
| 10 | `MTN_DEFAULT_COUNTRY` | Leave **unset** (code default = `ZM`) | ☐ |

**Add/fix anything missing** (values typed straight into the dashboard, never shared elsewhere).

- `MOBILE_MONEY_WEBHOOK_SECRET`: generate any long random string (e.g. 32+ chars from a password manager) — its value is yours; MTN does not need it (the webhook header is FarmBond's own convention).
- Do **not** touch `VLY_*` variables — platform-managed.

---

## STEP 3 — Post-push probes (30 seconds, browser or terminal)

Run these three and compare:

| Probe | How | Expected now | Expected after Step 2 sets the secret |
|---|---|---|---|
| 3a Auth liveness | Open `https://fiery-hare-105.convex.site/.well-known/openid-configuration` | HTTP 200 with `issuer: https://fiery-hare-105.convex.site` + jwks link ✅ (already true today) | same |
| 3b Webhook fail-closed | `curl -s -X POST -H "Content-Type: application/json" -d "{}" https://fiery-hare-105.convex.site/momo/webhook` | `{"error":"Webhook secret not configured"}` + HTTP **503** ✅ (proven live already) | HTTP **401** `{"error":"Invalid signature"}` |
| 3c Frontend | Open `https://farmbond.freebuff.app/` | HTTP 200, landing renders ✅ | same |

If 3b returns anything other than 503 (now) / 401 (after secret), **stop** — that would be a security regression.

---

## STEP 4 — Verify the 13 cron jobs

Dashboard → production deployment → **Cron / Scheduled functions**.

Expected intervals:

| Job | Interval |
|---|---|
| expire_trials | 24h |
| trial_expiry_warnings | 24h |
| subscription_expiry_warnings | 24h |
| expire_subscriptions | 24h |
| payment_method_reminders | 24h |
| prefetch_farm_weather | 30m |
| vaccination_reminders | 24h |
| low_coverage_alerts | 24h |
| smart_notifications | 2h |
| weather_alerts | 30m |
| intelligence_pipeline | 4h |
| weekly_reports | 168h |
| **weekly_digest** ← new | 168h |

Confirm **all 13** are listed and "next run" timestamps are sane. Check the `cronRuns` table shows single lease rows (no pile-up) after the first fires.

---

## STEP 5 — Verify the weekly digest configuration

1. Confirm `BREVO_API_KEY` present (Step 2, row 2). Without it: cron runs, gates, dedups, and skips sending gracefully — **that is correct behavior, no errors**.
2. In the app: **Settings → Notifications → Weekly Digest** toggle **on**, save, hard-refresh the page — toggle must stay on (persisted pref, Convex-backed).
3. Optionally wait for the first 168h fire, or verify delivery later; success evidence = `auditLogs` row with `action: weekly_digest_sent` per user + email received. Empty digests are skipped by design (no empty emails, ever).

---

## STEP 6 — Verify the profile-photo feature

In the live app (signed in):

1. **Settings → Profile → Upload Photo** → pick a JPEG/PNG/WebP ≤ 5 MB.
   ✅ Avatar updates; success toast.
2. Re-upload a different image.
   ✅ Updates again (old blob deleted server-side; no orphans).
3. Try an oversized (>5 MB) image or a PDF renamed to .jpg.
   ✅ Clear rejection toast: "Unsupported image type…" / "Image is too large…".
4. **Remove** → ✅ avatar falls back to initial-letter; button disappears.
5. Refresh — ✅ state persists (stored in Convex, not local).

---

## STEP 7 — Major user journey (happy path)

In `https://farmbond.freebuff.app`, signed out:

1. **Sign in** → email OTP → code arrives (needs `BREVO_API_KEY` for delivery; if email OTP doesn't arrive and Brevo is unset, use the guest/anonymous entry if offered, and flag Step 2 row 2 as the fix) → lands on `/dashboard`.
2. **Create farm** (Farm Registration) → ✅ appears on Farms and Dashboard.
3. **Dashboard** → ✅ farm/crop/livestock widgets, no error boundary.
4. **Weather** → ✅ current + forecast for the farm location (Open-Meteo — no key needed; proves prod backend fetches work).
5. **AI assistant** → one chat message → ✅ reply within the 5/day free quota (proves `GROQ_API_KEY`; if it errors with a config message, that's the key-missing UX, fix via Keys tab).
6. **Settings** → change theme/currency → save → refresh → ✅ persisted. Profile photo from Step 6 still shows.
7. **Notification prefs** → toggle anything → refresh → ✅ persisted.
8. Sign out → protected route redirects to `/auth` → ✅.

---

## STEP 8 — Explicitly NOT verified by this runbook

Record these as pending — do not check them off:

- [ ] MTN Payments E2E (blocked externally — see `docs/MTN-escalation.md`)
- [ ] NDVI first real run (needs Copernicus keys present + one real query)
- [ ] Live Brevo delivery of a real digest cycle (needs 168h to elapse or manual trigger)
- [ ] Load/scale behavior (batched crons are designed for 200k+ but untested at load)

When every box above is ✅ and Steps 1–7 pass, FarmBond is **production-verified for launch** minus the MTN external blocker.
