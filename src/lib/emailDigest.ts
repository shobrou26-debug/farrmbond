// ============================================================
// Weekly email digest — pure core (cron + renderer)
//
// Shared between the batched cron mutation (src/convex/
// weeklyDigest.ts) and the email renderer so all window math,
// selection rules, and HTML generation are pure and unit-tested.
// Data honesty: the digest only ever contains rows that really
// exist in the database — no placeholder or invented content.
// ============================================================

/** How far ahead the digest looks for upcoming calendar events. */
export const DIGEST_LOOKAHEAD_DAYS = 7;

/** How far back the digest looks for recent notifications. */
export const DIGEST_RECENT_DAYS = 7;

/** Max items per digest section — keeps the email scannable. */
export const DIGEST_MAX_EVENTS = 5;
export const DIGEST_MAX_NOTIFICATIONS = 5;

export interface DigestWindow {
  /** Digest generation time (ms epoch). */
  now: number;
  /** Upcoming events with startDate in [now, now + LOOKAHEAD). */
  windowEnd: number;
  /** Recent notifications with createdAt in [now - RECENT, now]. */
  recentStart: number;
}

export function computeDigestWindow(now: number): DigestWindow {
  return {
    now,
    windowEnd: now + DIGEST_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000,
    recentStart: now - DIGEST_RECENT_DAYS * 24 * 60 * 60 * 1000,
  };
}

// ------------------------------------------------------------
// Selection rules
// ------------------------------------------------------------

export interface DigestEventInput {
  title: string;
  eventType: string;
  startDate: number;
  farmName?: string;
}

/**
 * Upcoming calendar events inside the look-ahead window, soonest
 * first, capped at DIGEST_MAX_EVENTS. Pure — same input, same output.
 */
export function selectUpcomingEvents<T extends DigestEventInput>(
  events: T[],
  window: DigestWindow,
  limit: number = DIGEST_MAX_EVENTS
): T[] {
  return events
    .filter((e) => e.startDate >= window.now && e.startDate < window.windowEnd)
    .sort((a, b) => a.startDate - b.startDate)
    .slice(0, limit);
}

export interface DigestNotificationInput {
  title: string;
  message: string;
  createdAt: number;
}

/**
 * Recent notifications inside the look-back window, newest first,
 * capped at DIGEST_MAX_NOTIFICATIONS. Pure.
 */
export function selectRecentNotifications<T extends DigestNotificationInput>(
  notifications: T[],
  window: DigestWindow,
  limit: number = DIGEST_MAX_NOTIFICATIONS
): T[] {
  return notifications
    .filter((n) => n.createdAt >= window.recentStart && n.createdAt <= window.now)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

// ------------------------------------------------------------
// Finances summary (honest, per-currency — never merges currencies)
// ------------------------------------------------------------

export interface DigestFinanceTotals {
  income: number;
  expenses: number;
  net: number;
}

export type DigestFinancesSummary = Record<string, DigestFinanceTotals>;

/**
 * Sum income/expenses/net per currency. Currencies are never merged:
 * a mixed-currency farmer sees one block per currency they actually
 * recorded (data honesty — no invented exchange rates).
 */
export function summarizeDigestFinances(
  transactions: Array<{
    type: "income" | "expense";
    amount: number;
    currency: string;
    date?: number;
  }>,
  window?: DigestWindow
): DigestFinancesSummary {
  const summary: DigestFinancesSummary = {};
  for (const tx of transactions) {
    if (window) {
      // When a window is provided, only transactions provably inside it
      // are counted (a transaction without a date cannot be verified and
      // is excluded — data honesty). Callers without a window get totals
      // over the full set they passed in.
      if (tx.date === undefined) continue;
      if (tx.date < window.recentStart || tx.date > window.now) continue;
    }
    const currency = tx.currency || "USD";
    const bucket = summary[currency] ?? { income: 0, expenses: 0, net: 0 };
    if (tx.type === "income") {
      bucket.income += tx.amount;
    } else {
      bucket.expenses += tx.amount;
    }
    bucket.net = bucket.income - bucket.expenses;
    summary[currency] = bucket;
  }
  return summary;
}

// ------------------------------------------------------------
// Email model + renderer
// ------------------------------------------------------------

export interface DigestEmailModel {
  farmerName: string;
  weekLabel: string;
  events: Array<DigestEventInput & { dateLabel: string }>;
  notifications: Array<DigestNotificationInput & { dateLabel: string }>;
  finances: DigestFinancesSummary;
  dashboardUrl: string;
  manageUrl: string;
  hasContent: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function shortDate(ts: number): string {
  // UTC keeps rendering deterministic regardless of server timezone.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(ts));
}

/**
 * Build the digest model from pre-selected data. `hasContent` is false
 * when there is genuinely nothing to report — the cron skips the send
 * rather than emailing an empty shell.
 */
export function buildDigestEmailModel(input: {
  farmerName?: string;
  now: number;
  events: DigestEventInput[];
  notifications: DigestNotificationInput[];
  finances: DigestFinancesSummary;
  dashboardUrl: string;
  manageUrl: string;
}): DigestEmailModel {
  const window = computeDigestWindow(input.now);
  const events = input.events.map((e) => ({
    ...e,
    dateLabel: shortDate(e.startDate),
  }));
  const notifications = input.notifications.map((n) => ({
    ...n,
    dateLabel: shortDate(n.createdAt),
  }));
  const hasFinances = Object.values(input.finances).some(
    (f) => f.income !== 0 || f.expenses !== 0
  );
  return {
    farmerName: input.farmerName || "there",
    weekLabel: `${shortDate(input.now)} – ${shortDate(input.now + WEEK_MS)}`,
    events,
    notifications,
    finances: input.finances,
    dashboardUrl: input.dashboardUrl,
    manageUrl: input.manageUrl,
    hasContent: events.length > 0 || notifications.length > 0 || hasFinances,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Render subject + HTML for the digest. All dynamic content is
 * HTML-escaped; links are the caller-provided app URLs.
 */
export function renderDigestEmail(model: DigestEmailModel): {
  subject: string;
  html: string;
} {
  const eventCount = model.events.length;
  const subject = `🌱 Your FarmBond week ahead${eventCount > 0 ? ` — ${eventCount} upcoming task${eventCount === 1 ? "" : "s"}` : ""}`;

  const eventRows = model.events
    .map(
      (e) => `<li><strong>${escapeHtml(e.dateLabel)}</strong> — ${escapeHtml(e.title)}${e.farmName ? ` <span style="color:#64748b">(${escapeHtml(e.farmName)})</span>` : ""} <span style="color:#16a34a;font-size:13px">${escapeHtml(e.eventType)}</span></li>`
    )
    .join("");

  const notificationRows = model.notifications
    .map(
      (n) => `<li><strong>${escapeHtml(n.dateLabel)}</strong> — ${escapeHtml(n.title)}<br/><span style="color:#475569;font-size:13px">${escapeHtml(n.message)}</span></li>`
    )
    .join("");

  const financeBlocks = Object.entries(model.finances)
    .map(
      ([currency, f]) =>
        `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin:12px 0"><strong>${escapeHtml(currency)}</strong><ul style="margin:8px 0 0;padding-left:20px"><li>Income: <strong>${formatMoney(f.income, currency)}</strong></li><li>Expenses: <strong>${formatMoney(f.expenses, currency)}</strong></li><li>Net: <strong style="color:${f.net >= 0 ? "#16a34a" : "#b91c1c"}">${formatMoney(f.net, currency)}</strong></li></ul></div>`
    )
    .join("");

  const sections: string[] = [];
  if (eventRows) {
    sections.push(
      `<h3 style="color:#16a34a">📅 Coming up this week</h3><ul style="padding-left:20px">${eventRows}</ul>`
    );
  }
  if (financeBlocks) {
    sections.push(`<h3 style="color:#16a34a">💰 Finances (last 7 days)</h3>${financeBlocks}`);
  }
  if (notificationRows) {
    sections.push(
      `<h3 style="color:#16a34a">🔔 Recent activity</h3><ul style="padding-left:20px">${notificationRows}</ul>`
    );
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f7faf7}.container{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)}.header{background:linear-gradient(135deg,#16a34a,#15803d);padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:24px}.content{padding:32px}.cta-button{display:inline-block;background:#16a34a;color:#fff!important;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0}.footer{background:#f8fafc;padding:24px;text-align:center;color:#64748b;font-size:14px}.footer a{color:#16a34a}</style></head><body><div class="container"><div class="header"><h1>🌱 FarmBond Weekly Digest</h1></div><div class="content"><h2>Hi ${escapeHtml(model.farmerName)}, here's your week</h2><p><strong>${escapeHtml(model.weekLabel)}</strong></p>${sections.join("")}<a href="${escapeHtml(model.dashboardUrl)}" class="cta-button">Open Your Dashboard</a></div><div class="footer"><p>FarmBond — AI-Powered Smart Farming</p><p><a href="${escapeHtml(model.manageUrl)}">Notification Settings</a> | <a href="${escapeHtml(model.dashboardUrl.replace(/\/dashboard.*$/, "/privacy"))}">Privacy Policy</a></p></div></div></body></html>`;

  return { subject, html };
}
