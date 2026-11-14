import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    try {
      // Preferred transport: Freebuff's OTP service. A hardcoded key was
      // previously committed here — rotate it and set FREEBUFF_EMAIL_API_KEY.
      const apiKey = process.env.FREEBUFF_EMAIL_API_KEY;
      if (apiKey) {
        await axios.post(
          "https://auth.freebuff.app/send_otp",
          {
            to: email,
            otp: token,
            appName: process.env.VLY_APP_NAME || "a freebuff.com application",
          },
          {
            headers: {
              "x-api-key": apiKey,
            },
          },
        );
        return;
      }

      // Fallback: Brevo (same API and env vars as src/convex/emails.ts),
      // used when FREEBUFF_EMAIL_API_KEY is not set. Code generation,
      // expiry, hashing, single-use and rate limiting all live upstream of
      // this function and are unaffected by the transport choice.
      const brevoKey = process.env.BREVO_API_KEY;
      if (!brevoKey) {
        throw new Error(
          "Email service not configured: set FREEBUFF_EMAIL_API_KEY or BREVO_API_KEY",
        );
      }
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoKey,
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: process.env.FROM_NAME || "FarmBond",
            email: process.env.FROM_EMAIL || "notifications@farmbond.com",
          },
          to: [{ email }],
          subject: "Your FarmBond verification code",
          htmlContent: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:20px;color:#111"><h2 style="color:#16a34a;margin-bottom:8px">🌱 FarmBond</h2><p>Hi, here is your verification code:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">${token}</p><p>This code expires in 15 minutes and can only be used once. If you didn't request it, you can safely ignore this email.</p><p style="color:#64748b;font-size:12px">The FarmBond Team</p></div>`,
        }),
      });
      if (!response.ok) {
        // Privacy: never log the provider error body — it can echo recipient
        // addresses. Log a classification only (same pattern as emails.ts).
        console.error(
          `Email OTP send failed — provider: brevo, classification: http_${response.status}`,
        );
        throw new Error(
          "Email verification service is currently unavailable. Please try again later.",
        );
      }
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Email verification service is currently unavailable. Please try again later.");
    }
  },
});
