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
      return { sent: false, reason: "API key not configured" };
    }
    const trialEndDate = new Date(args.trialEndDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const upgradeUrl = `${APP_URL}/settings?tab=subscription`;
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7faf7}.container{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{background:linear-gradient(135deg,#16a34a,#15803d);padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.content{padding:32px}.days-badge{display:inline-block;background:#fef3c7;color:#92400e;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;margin:16px 0}.cta-button{display:inline-block;background:#16a34a;color:#fff!important;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0}.features{background:#f0fdf4;border-radius:8px;padding:20px;margin:24px 0}.features h3{margin-top:0;color:#16a34a}.features ul{margin:0;padding-left:20px}.features li{margin-bottom:8px}.footer{background:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:14px}.footer a{color:#16a34a}</style></head><body><div class="container"><div class="header"><h1>🌱 FarmBond</h1></div><div class="content"><h2>Your Pro Trial is Ending Soon</h2><p>Hi ${args.name || "there"},</p><div class="days-badge">⏰ ${args.daysRemaining} day${args.daysRemaining === 1 ? '' : 's'} remaining</div><p>Your FarmBond Pro trial ends on <strong>${trialEndDate}</strong>. After this date, you'll be downgraded to the Free plan.</p><div class="features"><h3>You'll lose access to:</h3><ul><li>🤖 Unlimited AI farming assistant</li><li>🛰️ Satellite imagery & NDVI analysis</li><li>📊 Advanced analytics & reports</li><li>🧑‍🌾 Expert consultations</li><li>📄 PDF & Excel exports</li><li>🎯 Priority support</li></ul></div><p>Upgrade to Pro today for just <strong>$5/month</strong> to keep all your premium features!</p><a href="${upgradeUrl}" class="cta-button">Upgrade to Pro — $5/month</a><p>If you have any questions, reply to this email or visit our <a href="${APP_URL}/support">support center</a>.</p><p>Happy farming! 🚜<br>The FarmBond Team</p></div><div class="footer"><p>FarmBond — AI-Powered Smart Farming</p><p><a href="${APP_URL}/privacy">Privacy Policy</a> | <a href="${APP_URL}/settings?tab=notifications">Unsubscribe</a></p></div></div></body></html>`;
    return sendEmail(args.email, `⏰ Your FarmBond Pro Trial Ends in ${args.daysRemaining} Day${args.daysRemaining === 1 ? '' : 's'}`, htmlContent);
  },
});

/**
 * Send a subscription expiry warning email
 */
export const sendSubscriptionExpiryWarning = action({
  args: { userId: v.id("users"), email: v.string(), name: v.string(), daysRemaining: v.number(), subscriptionEndDate: v.number() },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) return { sent: false, reason: "API key not configured" };
    const endDate = new Date(args.subscriptionEndDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const renewUrl = `${APP_URL}/settings?tab=subscription`;
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7faf7}.container{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{background:linear-gradient(135deg,#16a34a,#15803d);padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.content{padding:32px}.renewal-badge{display:inline-block;background:#dbeafe;color:#1e40af;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;margin:16px 0}.info-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;margin:24px 0}.info-box h3{margin-top:0;color:#0369a1;font-size:16px}.info-box ul{margin:8px 0 0 0;padding-left:20px}.info-box li{margin-bottom:6px;font-size:14px}.cta-button{display:inline-block;background:#16a34a;color:#fff!important;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0}.footer{background:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:14px}.footer a{color:#16a34a}</style></head><body><div class="container"><div class="header"><h1>🌱 FarmBond</h1></div><div class="content"><h2>Your Subscription Renews Soon</h2><p>Hi ${args.name || "there"},</p><div class="renewal-badge">🔄 Renews in ${args.daysRemaining} day${args.daysRemaining === 1 ? '' : 's'}</div><p>Your FarmBond Pro subscription is set to auto-renew on <strong>${endDate}</strong> for <strong>$5/month</strong>.</p><div class="info-box"><h3>💳 What happens next?</h3><ul><li>Your payment method will be charged $5 automatically</li><li>Your Pro access will continue uninterrupted</li><li>You'll receive a confirmation email after renewal</li></ul></div><p>Want to update your payment method?</p><a href="${renewUrl}" class="cta-button">Manage Subscription</a><p>If you have any questions, reply to this email.</p><p>Happy farming! 🚜<br>The FarmBond Team</p></div><div class="footer"><p>FarmBond — AI-Powered Smart Farming</p><p><a href="${APP_URL}/privacy">Privacy Policy</a></p></div></div></body></html>`;
    return sendEmail(args.email, `🔄 Your FarmBond Pro Subscription Renews in ${args.daysRemaining} Day${args.daysRemaining === 1 ? '' : 's'}`, htmlContent);
  },
});

/**
 * Send a subscription expired email
 */
export const sendSubscriptionExpiredEmail = action({
  args: { userId: v.id("users"), email: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) return { sent: false, reason: "API key not configured" };
    const upgradeUrl = `${APP_URL}/settings?tab=subscription`;
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7faf7}.container{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{background:linear-gradient(135deg,#16a34a,#15803d);padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.content{padding:32px}.warning-box{background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:20px;margin:24px 0}.warning-box h3{margin-top:0;color:#92400e;font-size:16px}.warning-box ul{margin:8px 0 0 0;padding-left:20px}.warning-box li{margin-bottom:6px;font-size:14px}.cta-button{display:inline-block;background:#16a34a;color:#fff!important;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0}.footer{background:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:14px}.footer a{color:#16a34a}</style></head><body><div class="container"><div class="header"><h1>🌱 FarmBond</h1></div><div class="content"><h2>Your Subscription Has Expired</h2><p>Hi ${args.name || "there"},</p><p>Your FarmBond Pro subscription has expired. You've been downgraded to the Free plan.</p><div class="warning-box"><h3>⚠️ Features you've lost access to:</h3><ul><li>🤖 Unlimited AI farming assistant</li><li>🛰️ Satellite imagery & NDVI analysis</li><li>📊 Advanced analytics & reports</li><li>📄 PDF & Excel exports</li><li>🎯 Priority support</li></ul></div><p>Resubscribe today for just <strong>$5/month</strong>!</p><a href="${upgradeUrl}" class="cta-button">Resubscribe to Pro — $5/month</a><p>We'd love to have you back! 🚜<br>The FarmBond Team</p></div><div class="footer"><p>FarmBond — AI-Powered Smart Farming</p></div></div></body></html>`;
    return sendEmail(args.email, `⚠️ Your FarmBond Pro Subscription Has Expired`, htmlContent);
  },
});

/**
 * Send payment method reminder email
 */
export const sendPaymentMethodReminder = action({
  args: { userId: v.id("users"), email: v.string(), name: v.string(), daysUntilRenewal: v.number(), subscriptionEndDate: v.number() },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) return { sent: false, reason: "API key not configured" };
    const renewalDate = new Date(args.subscriptionEndDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const billingUrl = `${APP_URL}/settings?tab=subscription`;
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7faf7}.container{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.content{padding:32px}.alert-badge{display:inline-block;background:#fef2f2;color:#991b1b;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;margin:16px 0}.info-box{background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:20px;margin:24px 0}.info-box h3{margin-top:0;color:#92400e;font-size:16px}.cta-button{display:inline-block;background:#16a34a;color:#fff!important;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0}.footer{background:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:14px}.footer a{color:#16a34a}</style></head><body><div class="container"><div class="header"><h1>🌱 FarmBond</h1></div><div class="content"><h2>⚡ Action Required: Update Your Payment Method</h2><p>Hi ${args.name || "there"},</p><div class="alert-badge">💳 Payment verification needed</div><p>Your FarmBond Pro subscription is set to renew on <strong>${renewalDate}</strong> for <strong>$5/month</strong>.</p><div class="info-box"><h3>⚠️ Why are we contacting you?</h3><p>To ensure uninterrupted access, please verify your payment method is up to date.</p><ul><li>Your payment method may be expired or invalid</li><li>A failed payment could interrupt your Pro access</li><li>Updating takes just 2 minutes</li></ul></div><a href="${billingUrl}" class="cta-button">Update Payment Method</a><p>Happy farming! 🚜<br>The FarmBond Team</p></div><div class="footer"><p>FarmBond — AI-Powered Smart Farming</p></div></div></body></html>`;
    return sendEmail(args.email, `⚡ Action Required: Update Payment Method Before Renewal`, htmlContent);
  },
});

/**
 * Send subscription activated email after successful payment
 */
export const sendSubscriptionActivatedEmail = action({
  args: { userId: v.id("users"), email: v.string(), name: v.string(), subscriptionEndDate: v.number() },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) return { sent: false, reason: "API key not configured" };
    const endDate = new Date(args.subscriptionEndDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const settingsUrl = `${APP_URL}/settings?tab=subscription`;
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7faf7}.container{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{background:linear-gradient(135deg,#16a34a,#15803d);padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.content{padding:32px}.success-box{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin:24px 0}.success-box h3{margin-top:0;color:#166534;font-size:16px}.success-box ul{margin:8px 0 0 0;padding-left:20px}.success-box li{margin-bottom:6px;font-size:14px}.cta-button{display:inline-block;background:#16a34a;color:#fff!important;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0}.footer{background:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:14px}.footer a{color:#16a34a}</style></head><body><div class="container"><div class="header"><h1>🌱 FarmBond</h1></div><div class="content"><h2>🎉 Welcome to FarmBond Pro!</h2><p>Hi ${args.name || "there"},</p><p>Your subscription is now active! You've been upgraded to Pro.</p><div class="success-box"><h3>🌟 Your Pro features are now unlocked:</h3><ul><li>🤖 Unlimited AI farming assistant</li><li>🛰️ Satellite imagery & NDVI analysis</li><li>📊 Advanced analytics & reports</li><li>🧑‍🌾 Expert consultations</li><li>📄 PDF & Excel exports</li><li>🎯 Priority support</li></ul></div><p><strong>Next billing date:</strong> ${endDate} ($5/month)</p><a href="${settingsUrl}" class="cta-button">Manage Subscription</a><p>Happy farming! 🚜<br>The FarmBond Team</p></div><div class="footer"><p>FarmBond — AI-Powered Smart Farming</p></div></div></body></html>`;
    return sendEmail(args.email, `🎉 Welcome to FarmBond Pro!`, htmlContent);
  },
});

/**
 * Send payment failed email with retry instructions
 */
export const sendPaymentFailedEmail = action({
  args: { userId: v.id("users"), email: v.string(), name: v.string(), failureCount: v.number(), subscriptionEndDate: v.number() },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) return { sent: false, reason: "API key not configured" };
    const billingUrl = `${APP_URL}/settings?tab=subscription`;
    const isRetry = args.failureCount > 1;
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7faf7}.container{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.content{padding:32px}.alert-badge{display:inline-block;background:#fef2f2;color:#991b1b;padding:8px 16px;border-radius:20px;font-weight:600;font-size:14px;margin:16px 0}.warning-box{background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:20px;margin:24px 0}.warning-box h3{margin-top:0;color:#92400e;font-size:16px}.cta-button{display:inline-block;background:#dc2626;color:#fff!important;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0}.footer{background:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:14px}.footer a{color:#16a34a}</style></head><body><div class="container"><div class="header"><h1>🌱 FarmBond</h1></div><div class="content"><h2>${isRetry ? '⚠️ Payment Failed Again' : '⚠️ Payment Failed'}</h2><p>Hi ${args.name || "there"},</p><div class="alert-badge">💳 Payment issue detected</div><p>We were unable to process your payment for FarmBond Pro ($5/month).</p><div class="warning-box"><h3>What you need to do:</h3><ul><li>Check that your card has sufficient funds</li><li>Verify your card details are correct</li><li>Update your payment method if your card has expired</li><li>Contact your bank if payments are being declined</li></ul></div><p><strong>Important:</strong> If payment isn't updated within 3 days, your Pro access may be suspended.</p><a href="${billingUrl}" class="cta-button">Update Payment Method</a><p>If you have any questions, reply to this email.</p><p>Happy farming! 🚜<br>The FarmBond Team</p></div><div class="footer"><p>FarmBond — AI-Powered Smart Farming</p></div></div></body></html>`;
    return sendEmail(args.email, `${isRetry ? '⚠️' : '⚠️'} Payment Failed - Update Your Payment Method`, htmlContent);
  },
});

/**
 * Send subscription cancelled email
 */
export const sendSubscriptionCancelledEmail = action({
  args: { userId: v.id("users"), email: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) return { sent: false, reason: "API key not configured" };
    const resubscribeUrl = `${APP_URL}/settings?tab=subscription`;
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7faf7}.container{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{background:linear-gradient(135deg,#6b7280,#4b5563);padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.content{padding:32px}.info-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;margin:24px 0}.info-box h3{margin-top:0;color:#0369a1;font-size:16px}.cta-button{display:inline-block;background:#16a34a;color:#fff!important;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0}.footer{background:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:14px}.footer a{color:#16a34a}</style></head><body><div class="container"><div class="header"><h1>🌱 FarmBond</h1></div><div class="content"><h2>Subscription Cancelled</h2><p>Hi ${args.name || "there"},</p><p>Your FarmBond Pro subscription has been cancelled. You've been downgraded to the Free plan.</p><div class="info-box"><h3>What you've lost access to:</h3><ul><li>🤖 Unlimited AI farming assistant</li><li>🛰️ Satellite imagery & NDVI analysis</li><li>📊 Advanced analytics & reports</li><li>📄 PDF & Excel exports</li><li>🎯 Priority support</li></ul></div><p>Changed your mind? Resubscribe anytime for just <strong>$5/month</strong>.</p><a href="${resubscribeUrl}" class="cta-button">Resubscribe to Pro</a><p>We're sorry to see you go! 🚜<br>The FarmBond Team</p></div><div class="footer"><p>FarmBond — AI-Powered Smart Farming</p></div></div></body></html>`;
    return sendEmail(args.email, `Subscription Cancelled - FarmBond`, htmlContent);
  },
});

/**
 * Send an invoice email to a user
 */
export const sendInvoiceEmail = action({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    invoiceId: v.string(),
    invoiceNumber: v.string(),
    amount: v.number(),
    currency: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
    paymentMethodLast4: v.string(),
  },
  handler: async (ctx, args) => {
    if (!RESEND_API_KEY) return { sent: false, reason: "API key not configured" };
    const invoiceUrl = `${APP_URL}/payment-history`;
    const periodStart = new Date(args.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const periodEnd = new Date(args.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const amountFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: args.currency.toUpperCase() }).format(args.amount / 100);
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7faf7}.container{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{background:linear-gradient(135deg,#16a34a,#15803d);padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.content{padding:32px}.invoice-box{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;margin:24px 0}.invoice-box h3{margin-top:0;color:#166534;font-size:16px}.invoice-box table{width:100%;border-collapse:collapse;margin:12px 0}.invoice-box td{padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px}.invoice-box td:last-child{text-align:right;font-weight:600}.cta-button{display:inline-block;background:#16a34a;color:#fff!important;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0}.footer{background:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:14px}.footer a{color:#16a34a}</style></head><body><div class="container"><div class="header"><h1>🌱 FarmBond</h1></div><div class="content"><h2>📄 Your Invoice is Ready</h2><p>Hi ${args.name || "there"},</p><p>Thank you for your subscription! Here's your invoice for the current billing period.</p><div class="invoice-box"><h3>Invoice #${args.invoiceNumber}</h3><table><tr><td>Invoice Date</td><td>${periodStart}</td></tr><tr><td>Service Period</td><td>${periodStart} — ${periodEnd}</td></tr><tr><td>Payment Method</td><td>•••• ${args.paymentMethodLast4}</td></tr><tr><td style="border-top:2px solid #16a34a;padding-top:12px"><strong>Amount Paid</strong></td><td style="border-top:2px solid #16a34a;padding-top:12px;color:#16a34a"><strong>${amountFormatted}</strong></td></tr></table></div><a href="${invoiceUrl}" class="cta-button">View & Download Invoice</a><p>You can also download a PDF copy of this invoice from your payment history.</p><p>Happy farming! 🚜<br>The FarmBond Team</p></div><div class="footer"><p>FarmBond — AI-Powered Smart Farming</p><p><a href="${APP_URL}/privacy">Privacy Policy</a> | <a href="${APP_URL}/settings?tab=notifications">Unsubscribe</a></p></div></div></body></html>`;
    return sendEmail(args.email, `📄 FarmBond Invoice #${args.invoiceNumber} — ${amountFormatted}`, htmlContent);
  },
});

/**
 * Helper function to send email via Resend
 */
async function sendEmail(to: string, subject: string, html: string) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
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
}
