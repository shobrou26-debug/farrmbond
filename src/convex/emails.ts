import { action } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// Email Notifications - Trial, Subscription, and Payment Reminders
// Uses Resend API for transactional emails
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "FarmBond <notifications@farmbond.com>";
const APP_URL = process.env.APP_URL || "https://farmbond.com";

/**
 * Send a trial expiry warning email to a user
 * Called internally by the sendTrialExpiryWarnings mutation
 */
export const sendTrialExpiryWarning = action({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    daysRemaining: v.number(),
    trialEndDate: v.number(),
  },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return { sent: false, reason: "API key not configured" };
    }

    const trialEndDate = new Date(args.trialEndDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const upgradeUrl = `${APP_URL}/settings?tab=subscription`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your FarmBond Trial is Ending Soon</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f7faf7; }
    .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .days-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin: 16px 0; }
    .cta-button { display: inline-block; background: #16a34a; color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .cta-button:hover { background: #15803d; }
    .features { background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .features h3 { margin-top: 0; color: #16a34a; }
    .features ul { margin: 0; padding-left: 20px; }
    .features li { margin-bottom: 8px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; }
    .footer a { color: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌱 FarmBond</h1>
    </div>
    <div class="content">
      <h2>Your Pro Trial is Ending Soon</h2>
      <p>Hi ${args.name || "there"},</p>
      <div class="days-badge">⏰ ${args.daysRemaining} day${args.daysRemaining === 1 ? '' : 's'} remaining</div>
      <p>Your FarmBond Pro trial ends on <strong>${trialEndDate}</strong>. After this date, you'll be downgraded to the Free plan.</p>
      
      <div class="features">
        <h3>You'll lose access to:</h3>
        <ul>
          <li>🤖 Unlimited AI farming assistant</li>
          <li>🛰️ Satellite imagery & NDVI analysis</li>
          <li>📊 Advanced analytics & reports</li>
          <li>🧑‍🌾 Expert consultations</li>
          <li>📄 PDF & Excel exports</li>
          <li>🎯 Priority support</li>
        </ul>
      </div>

      <p>Upgrade to Pro today for just <strong>$5/month</strong> to keep all your premium features!</p>
      
      <a href="${upgradeUrl}" class="cta-button">Upgrade to Pro — $5/month</a>
      
      <p>If you have any questions, reply to this email or visit our <a href="${APP_URL}/support">support center</a>.</p>
      
      <p>Happy farming! 🚜<br>The FarmBond Team</p>
    </div>
    <div class="footer">
      <p>FarmBond — AI-Powered Smart Farming</p>
      <p>
        <a href="${APP_URL}/privacy">Privacy Policy</a> | 
        <a href="${APP_URL}/settings?tab=notifications">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [args.email],
          subject: `⏰ Your FarmBond Pro Trial Ends in ${args.daysRemaining} Day${args.daysRemaining === 1 ? '' : 's'}`,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Resend API error:", error);
        return { sent: false, reason: error };
      }

      const result = await response.json();
      console.log("Trial warning email sent successfully:", result.id);
      return { sent: true, emailId: result.id };
    } catch (error) {
      console.error("Failed to send trial warning email:", error);
      return { sent: false, reason: String(error) };
    }
  },
});

/**
 * Send a paid subscription expiry warning email to a user
 * Called internally by the sendSubscriptionExpiryWarnings mutation
 */
export const sendSubscriptionExpiryWarning = action({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    daysRemaining: v.number(),
    subscriptionEndDate: v.number(),
  },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return { sent: false, reason: "API key not configured" };
    }

    const endDate = new Date(args.subscriptionEndDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const renewUrl = `${APP_URL}/settings?tab=subscription`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your FarmBond Subscription is Renewing Soon</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f7faf7; }
    .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .renewal-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin: 16px 0; }
    .info-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .info-box h3 { margin-top: 0; color: #0369a1; font-size: 16px; }
    .info-box ul { margin: 8px 0 0 0; padding-left: 20px; }
    .info-box li { margin-bottom: 6px; font-size: 14px; }
    .cta-button { display: inline-block; background: #16a34a; color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .cta-button:hover { background: #15803d; }
    .secondary-link { display: inline-block; color: #16a34a; text-decoration: underline; margin-top: 12px; font-size: 14px; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; }
    .footer a { color: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌱 FarmBond</h1>
    </div>
    <div class="content">
      <h2>Your Subscription Renews Soon</h2>
      <p>Hi ${args.name || "there"},</p>
      <div class="renewal-badge">🔄 Renews in ${args.daysRemaining} day${args.daysRemaining === 1 ? '' : 's'}</div>
      <p>Your FarmBond Pro subscription is set to auto-renew on <strong>${endDate}</strong> for <strong>$5/month</strong>.</p>
      
      <div class="info-box">
        <h3>💳 What happens next?</h3>
        <ul>
          <li>Your payment method will be charged $5 automatically</li>
          <li>Your Pro access will continue uninterrupted</li>
          <li>You'll receive a confirmation email after renewal</li>
        </ul>
      </div>

      <div class="info-box">
        <h3>🌟 Your Pro features include:</h3>
        <ul>
          <li>🤖 Unlimited AI farming assistant</li>
          <li>🛰️ Satellite imagery & NDVI analysis</li>
          <li>📊 Advanced analytics & reports</li>
          <li>🧑‍🌾 Expert consultations</li>
          <li>📄 PDF & Excel exports</li>
          <li>🎯 Priority support</li>
        </ul>
      </div>

      <p>Want to update your payment method or review your subscription?</p>
      
      <a href="${renewUrl}" class="cta-button">Manage Subscription</a>
      
      <p style="text-align: center;">
        <a href="${renewUrl}" class="secondary-link">Cancel subscription</a>
      </p>
      
      <p>If you have any questions, reply to this email or visit our <a href="${APP_URL}/support">support center</a>.</p>
      
      <p>Happy farming! 🚜<br>The FarmBond Team</p>
    </div>
    <div class="footer">
      <p>FarmBond — AI-Powered Smart Farming</p>
      <p>
        <a href="${APP_URL}/privacy">Privacy Policy</a> | 
        <a href="${APP_URL}/settings?tab=notifications">Email Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [args.email],
          subject: `🔄 Your FarmBond Pro Subscription Renews in ${args.daysRemaining} Day${args.daysRemaining === 1 ? '' : 's'}`,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Resend API error:", error);
        return { sent: false, reason: error };
      }

      const result = await response.json();
      console.log("Subscription renewal email sent successfully:", result.id);
      return { sent: true, emailId: result.id };
    } catch (error) {
      console.error("Failed to send subscription renewal email:", error);
      return { sent: false, reason: String(error) };
    }
  },
});

/**
 * Send a subscription expired/downgrade notification email
 * Sent when a paid user's subscription lapses
 */
export const sendSubscriptionExpiredEmail = action({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return { sent: false, reason: "API key not configured" };
    }

    const upgradeUrl = `${APP_URL}/settings?tab=subscription`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your FarmBond Subscription Has Expired</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f7faf7; }
    .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .warning-box { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .warning-box h3 { margin-top: 0; color: #92400e; font-size: 16px; }
    .warning-box ul { margin: 8px 0 0 0; padding-left: 20px; }
    .warning-box li { margin-bottom: 6px; font-size: 14px; }
    .cta-button { display: inline-block; background: #16a34a; color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .cta-button:hover { background: #15803d; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; }
    .footer a { color: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌱 FarmBond</h1>
    </div>
    <div class="content">
      <h2>Your Subscription Has Expired</h2>
      <p>Hi ${args.name || "there"},</p>
      <p>Your FarmBond Pro subscription has expired. You've been downgraded to the Free plan.</p>
      
      <div class="warning-box">
        <h3>⚠️ Features you've lost access to:</h3>
        <ul>
          <li>🤖 Unlimited AI farming assistant</li>
          <li>🛰️ Satellite imagery & NDVI analysis</li>
          <li>📊 Advanced analytics & reports</li>
          <li>🧑‍🌾 Expert consultations</li>
          <li>📄 PDF & Excel exports</li>
          <li>🎯 Priority support</li>
        </ul>
      </div>

      <p>Don't lose your premium features — resubscribe today for just <strong>$5/month</strong>!</p>
      
      <a href="${upgradeUrl}" class="cta-button">Resubscribe to Pro — $5/month</a>
      
      <p>If you have any questions, reply to this email or visit our <a href="${APP_URL}/support">support center</a>.</p>
      
      <p>We'd love to have you back! 🚜<br>The FarmBond Team</p>
    </div>
    <div class="footer">
      <p>FarmBond — AI-Powered Smart Farming</p>
      <p>
        <a href="${APP_URL}/privacy">Privacy Policy</a> | 
        <a href="${APP_URL}/settings?tab=notifications">Email Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [args.email],
          subject: `⚠️ Your FarmBond Pro Subscription Has Expired`,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Resend API error:", error);
        return { sent: false, reason: error };
      }

      const result = await response.json();
      console.log("Subscription expired email sent successfully:", result.id);
      return { sent: true, emailId: result.id };
    } catch (error) {
      console.error("Failed to send subscription expired email:", error);
      return { sent: false, reason: String(error) };
    }
  },
});

/**
 * Send a payment method reminder email to users before subscription renewal
 * Warns them to update their payment details to avoid failed payments
 */
export const sendPaymentMethodReminder = action({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    daysUntilRenewal: v.number(),
    subscriptionEndDate: v.number(),
  },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return { sent: false, reason: "API key not configured" };
    }

    const renewalDate = new Date(args.subscriptionEndDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const billingUrl = `${APP_URL}/settings?tab=subscription`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Action Required: Update Your Payment Method</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f7faf7; }
    .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .alert-badge { display: inline-block; background: #fef2f2; color: #991b1b; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin: 16px 0; }
    .info-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .info-box h3 { margin-top: 0; color: #92400e; font-size: 16px; }
    .info-box ul { margin: 8px 0 0 0; padding-left: 20px; }
    .info-box li { margin-bottom: 6px; font-size: 14px; }
    .success-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .success-box h3 { margin-top: 0; color: #166534; font-size: 16px; }
    .success-box ul { margin: 8px 0 0 0; padding-left: 20px; }
    .success-box li { margin-bottom: 6px; font-size: 14px; }
    .cta-button { display: inline-block; background: #16a34a; color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .cta-button:hover { background: #15803d; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 14px; }
    .footer a { color: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌱 FarmBond</h1>
    </div>
    <div class="content">
      <h2>⚡ Action Required: Update Your Payment Method</h2>
      <p>Hi ${args.name || "there"},</p>
      <div class="alert-badge">💳 Payment verification needed</div>
      <p>Your FarmBond Pro subscription is set to renew on <strong>${renewalDate}</strong> for <strong>$5/month</strong>.</p>
      
      <div class="info-box">
        <h3>⚠️ Why are we contacting you?</h3>
        <p>To ensure uninterrupted access to your premium features, we need you to verify your payment method is up to date.</p>
        <ul>
          <li>Your current payment method may be expired or invalid</li>
          <li>A failed payment could interrupt your Pro access</li>
          <li>Updating now takes just 2 minutes</li>
        </ul>
      </div>

      <div class="success-box">
        <h3>🌟 Your Pro features at risk:</h3>
        <ul>
          <li>🤖 Unlimited AI farming assistant</li>
          <li>🛰️ Satellite imagery & NDVI analysis</li>
          <li>📊 Advanced analytics & reports</li>
          <li>🧑‍🌾 Expert consultations</li>
          <li>📄 PDF & Excel exports</li>
          <li>🎯 Priority support</li>
        </ul>
      </div>

      <p><strong>Don't let your subscription lapse!</strong> Update your payment method now to keep all your Pro features.</p>
      
      <a href="${billingUrl}" class="cta-button">Update Payment Method</a>
      
      <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
        We accept Visa, Mastercard, PayPal, MTN Mobile Money, Airtel Money, and Skrill.
      </p>
      
      <p>If you have any questions, reply to this email or visit our <a href="${APP_URL}/support">support center</a>.</p>
      
      <p>Happy farming! 🚜<br>The FarmBond Team</p>
    </div>
    <div class="footer">
      <p>FarmBond — AI-Powered Smart Farming</p>
      <p>
        <a href="${APP_URL}/privacy">Privacy Policy</a> | 
        <a href="${APP_URL}/settings?tab=notifications">Email Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [args.email],
          subject: `⚡ Action Required: Update Payment Method Before ${args.daysUntilRenewal}-Day Renewal`,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Resend API error:", error);
        return { sent: false, reason: error };
      }

      const result = await response.json();
      console.log("Payment method reminder email sent successfully:", result.id);
      return { sent: true, emailId: result.id };
    } catch (error) {
      console.error("Failed to send payment method reminder email:", error);
      return { sent: false, reason: String(error) };
    }
  },
});
