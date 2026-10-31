# FarmBond — MTN Zambia Escalation Package
_Prepared 2026-09-29 from verified code inspection and one sanitized diagnostic. Contains no credentials._

---

## How to use this document

1. Open the **MTN MoMo API portal** (momo developer portal) → your FarmBond application.
2. Confirm the app shows status **Approved** and the product **Payments** (V1) is selected for **Zambia**.
3. Copy the message in **Part A** into MTN support / your MTN account manager email.
4. If MTN asks for application details, give them **Part B** only. Never send key/secret values by email or chat.

---

## Part A — Ready-to-send message

> **Subject:** MTN MoMo Payments V1 — OAuth 401 (error 4000 "Unauthorised") on live api.mtn.com — credential provisioning confirmation needed (FarmBond, Zambia)
>
> Dear MTN MoMo API Support,
>
> We are integrating **MTN Mobile Money Payments V1** for our product **FarmBond**, an agricultural platform intended for the **Zambia** market, and need your help resolving an authentication failure before launch.
>
> **What we are doing**
> - Product: **MTN Payments V1** (OpenAPI 3.0.1 spec), market **Zambia**.
> - OAuth 2.0 client-credentials request implemented exactly per the Payments V1 specification:
>   `POST {base}/oauth/access_token?grant_type=client_credentials`
>   `Content-Type: application/x-www-form-urlencoded`
>   Body: `client_id={key}&client_secret={secret}` (URL-encoded), with `grant_type` in the **query string**.
> - Base URL in use: **`https://api.mtn.com/v1`** (live host).
>
> **What happens**
> - The request **reaches api.mtn.com** and consistently returns:
>   **HTTP 401, error code 4000, message "Unauthorised."**
> - Our stored Production key and secret are present in our configuration and are transmitted correctly, but are **rejected by MTN**.
> - **No payment request has ever been created** — we are blocked at the token step. No customer is affected; this is a pre-launch integration check.
>
> **What we need you to confirm (three questions)**
> 1. Do the **Production key and Production secret** currently stored in our configuration belong to the **approved FarmBond application**, and are they **provisioned for the live `api.mtn.com` host** for **Payments V1**?
> 2. If the credentials we hold are **sandbox credentials**, please either issue the correct **production credentials** for the approved app, or confirm the correct **sandbox base URL** we should use until go-live.
> 3. Please confirm that **Payments V1 is provisioned** for the FarmBond application in Zambia (product subscription active on the app).
>
> For security reasons we have not included any credential material in this message and will never do so. We can rotate credentials on request once provisioning is confirmed.
>
> Thank you — a written confirmation of points 1–3 will unblock our launch.
>
> Kind regards,
> {Your name}
> FarmBond — {your email / phone}

---

## Part B — Information to have ready if MTN asks for application details

Provide only these **non-secret identifiers**:

| Item | Value to give MTN |
|---|---|
| Product / company | FarmBond (AI-powered smart farming platform, Zambia) |
| MTN product in use | **Payments V1** (OpenAPI 3.0.1) |
| Market / country | **Zambia (ZM)** — sent as `countryCode: ZM` header |
| Live base URL in use | `https://api.mtn.com/v1` |
| Failing endpoint | `POST /oauth/access_token?grant_type=client_credentials` |
| Exact response | `HTTP 401`, body error code `4000`, message `"Unauthorised."` |
| Callback URL used on /payments | `https://fiery-hare-105.convex.site/momo/webhook` (will be updated to your final domain at go-live) |
| Request proven spec-compliant | Yes — reviewed against the Payments V1 OpenAPI YAML; identical request also fails, so no client-side variance |
| First observed | Before 2026-09-29; reproducible 100% of attempts |
| Sessions/case refs | *(add your MTN portal case numbers here if any exist)* |

**Never provide:** key/secret values, screenshots containing them, or full HTTP dumps with Authorization headers. If MTN needs to correlate server-side, the **client_id (key) itself** is an identifier, not a secret — share it **only through the MTN portal's secure channel**, never email/chat, and only if they explicitly ask.

---

## Part C — After MTN replies (either outcome)

| MTN says | You do | Then |
|---|---|---|
| "Credentials are correct, provisioning fixed" | Re-run the one-shot internal diagnostic (I'll prepare it when you say go; pattern: internal-only action → sanitized status → run once → delete) | Expect HTTP 200 + token → proceed to sandbox E2E in §19 Phase 4 |
| "Those are sandbox credentials" + production pair issued | Replace `MTN_MOMO_API_KEY` / `MTN_MOMO_API_SECRET` values in the **Keys tab** (never in chat) | Same re-test path |
| "Use the sandbox host for now" | Set `MTN_MOMO_API_URL` to the sandbox base URL in the Keys tab | Same re-test path; flip to live + live creds at go-live |
| "Your app/product isn't provisioned" | Follow MTN's provisioning/approval steps for Payments V1 Zambia | Re-test after they confirm |

**Code stays untouched in every outcome.** The only knobs are the two credential values and, if needed, `MTN_MOMO_API_URL` — all in the Keys tab.
