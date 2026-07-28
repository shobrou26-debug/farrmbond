import { action } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// Email Notifications - Trial Expiry Warnings
// Uses Resend API for transactional emails
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "FarmBond <notifications@farmbond.com>";
const APP_URL = process.env.APP_URL || "https://farmbond.com";

/**
 * Send a trial expiry warning email to a user
 * Called internally by the sendTrialWarningEmails mutation
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
          <li> expert consultations</li>
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
      console.log("Email sent successfully:", result.id);
      return { sent: true, emailId: result.id };
    } catch (error) {
      console.error("Failed to send email:", error);
      return { sent: false, reason: String(error) };
    }
  },
});
