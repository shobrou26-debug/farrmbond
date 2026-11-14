import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DIGEST_LOOKAHEAD_DAYS,
  DIGEST_RECENT_DAYS,
  DIGEST_MAX_EVENTS,
  DIGEST_MAX_NOTIFICATIONS,
  computeDigestWindow,
  selectUpcomingEvents,
  selectRecentNotifications,
  summarizeDigestFinances,
  buildDigestEmailModel,
  renderDigestEmail,
  escapeHtml,
} from "../lib/emailDigest";

// ============================================================
// Weekly email digest — pure core + wiring
//
// Completes the "email digests" gap (pref existed, no sender).
// These tests guard the pure window/selection/summary/renderer
// logic and the wiring between the batched cron, the preference
// gate, the audit dedup, and the Brevo transport action.
// ============================================================

const DAY = 24 * 60 * 60 * 1000;

describe("digest window math", () => {
  test("window spans 7 days ahead and 7 days back", () => {
    expect(DIGEST_LOOKAHEAD_DAYS).toBe(7);
    expect(DIGEST_RECENT_DAYS).toBe(7);
    const now = 1_700_000_000_000;
    const w = computeDigestWindow(now);
    expect(w.now).toBe(now);
    expect(w.windowEnd).toBe(now + 7 * DAY);
    expect(w.recentStart).toBe(now - 7 * DAY);
  });
});

describe("upcoming event selection", () => {
  const now = 1_700_000_000_000;
  const w = computeDigestWindow(now);

  test("keeps only events inside [now, now+7d), sorted soonest first", () => {
    const events = [
      { title: "Past planting", eventType: "planting", startDate: now - DAY },
      { title: "Harvest", eventType: "harvesting", startDate: now + 3 * DAY },
      { title: "Irrigation", eventType: "irrigation", startDate: now + 1 * DAY },
      { title: "Too far out", eventType: "other", startDate: now + 8 * DAY },
    ];
    const selected = selectUpcomingEvents(events, w);
    expect(selected.map((e) => e.title)).toEqual(["Irrigation", "Harvest"]);
  });

  test("caps at DIGEST_MAX_EVENTS, keeping the soonest", () => {
    const events = Array.from({ length: 8 }, (_, i) => ({
      title: `Event ${i}`,
      eventType: "other",
      startDate: now + (i + 1) * DAY,
    }));
    expect(DIGEST_MAX_EVENTS).toBe(5);
    const selected = selectUpcomingEvents(events, w);
    expect(selected).toHaveLength(5);
    expect(selected[0].title).toBe("Event 0");
    expect(selected[4].title).toBe("Event 4");
  });

  test("boundary events are excluded (start === windowEnd)", () => {
    const selected = selectUpcomingEvents(
      [{ title: "Edge", eventType: "other", startDate: now + 7 * DAY }],
      w
    );
    expect(selected).toHaveLength(0);
  });
});

describe("recent notification selection", () => {
  const now = 1_700_000_000_000;
  const w = computeDigestWindow(now);

  test("keeps only notifications in [now-7d, now], newest first, capped", () => {
    expect(DIGEST_MAX_NOTIFICATIONS).toBe(5);
    const notifications = [
      { title: "Old", message: "too old", createdAt: now - 8 * DAY },
      { title: "A", message: "a", createdAt: now - 2 * DAY },
      { title: "B", message: "b", createdAt: now - 1 * DAY },
      { title: "Future?", message: "clock skew", createdAt: now + DAY },
    ];
    const selected = selectRecentNotifications(notifications, w);
    expect(selected.map((n) => n.title)).toEqual(["B", "A"]);
  });
});

describe("finances summary", () => {
  const now = 1_700_000_000_000;
  const w = computeDigestWindow(now);

  test("summarizes income/expenses/net per currency without merging currencies", () => {
    const summary = summarizeDigestFinances([
      { type: "income", amount: 500, currency: "ZMW", date: now - DAY },
      { type: "expense", amount: 200, currency: "ZMW", date: now - DAY },
      { type: "income", amount: 100, currency: "USD", date: now - DAY },
    ]);
    expect(summary["ZMW"]).toEqual({ income: 500, expenses: 200, net: 300 });
    expect(summary["USD"]).toEqual({ income: 100, expenses: 0, net: 100 });
  });

  test("with a window, excludes out-of-window and dateless transactions (honesty)", () => {
    const summary = summarizeDigestFinances(
      [
        { type: "income", amount: 999, currency: "ZMW", date: now - 9 * DAY },
        { type: "income", amount: 50, currency: "ZMW" }, // no date — unverifiable
        { type: "income", amount: 70, currency: "ZMW", date: now - DAY },
      ],
      w
    );
    expect(summary["ZMW"]).toEqual({ income: 70, expenses: 0, net: 70 });
  });

  test("empty input yields empty summary (no invented zero blocks)", () => {
    expect(summarizeDigestFinances([], w)).toEqual({});
  });
});

describe("digest model + renderer", () => {
  const now = 1_700_000_000_000;

  test("hasContent is false when there is nothing to report", () => {
    const model = buildDigestEmailModel({
      now,
      events: [],
      notifications: [],
      finances: {},
      dashboardUrl: "https://app/dashboard",
      manageUrl: "https://app/settings?tab=notifications",
    });
    expect(model.hasContent).toBe(false);
  });

  test("hasContent is true with any real content; defaults apply", () => {
    const model = buildDigestEmailModel({
      now,
      events: [
        { title: "Harvest maize", eventType: "harvesting", startDate: now + DAY },
      ],
      notifications: [],
      finances: {},
      dashboardUrl: "https://app/dashboard",
      manageUrl: "https://app/settings?tab=notifications",
    });
    expect(model.hasContent).toBe(true);
    expect(model.farmerName).toBe("there");
    expect(model.weekLabel).toContain("–");
  });

  test("escapes HTML in all dynamic content", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"
    );
    const { html } = renderDigestEmail(
      buildDigestEmailModel({
        farmerName: "<b>Evil</b>",
        now,
        events: [
          {
            title: "<img src=x onerror=alert(1)>",
            eventType: "other",
            startDate: now + DAY,
           
            farmName: "Farm <script>",
          },
        ],
        notifications: [
          { title: "<script>n</script>", message: "<i>m</i>", createdAt: now },
        ],
        finances: {},
        dashboardUrl: "https://app/dashboard",
        manageUrl: "https://app/settings?tab=notifications",
      })
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  test("subject counts events; rendered html includes links and finance blocks", () => {
    const { subject, html } = renderDigestEmail(
      buildDigestEmailModel({
        farmerName: "Chileshe",
        now,
        events: [
          { title: "Harvest", eventType: "harvesting", startDate: now + DAY },
          { title: "Fertilize", eventType: "fertilizing", startDate: now + 2 * DAY },
        ],
        notifications: [],
        finances: { ZMW: { income: 500, expenses: 200, net: 300 } },
        dashboardUrl: "https://app/dashboard",
        manageUrl: "https://app/settings?tab=notifications",
      })
    );
    expect(subject).toContain("2 upcoming tasks");
    expect(html).toContain("https://app/dashboard");
    expect(html).toContain("https://app/settings?tab=notifications");
    expect(html).toContain("ZMW");
    expect(html).toContain("Net");
    // Negative net renders with the loss color class
    const loss = renderDigestEmail(
      buildDigestEmailModel({
        now,
        events: [],
        notifications: [],
        finances: { ZMW: { income: 0, expenses: 100, net: -100 } },
        dashboardUrl: "u",
        manageUrl: "m",
      })
    );
    expect(loss.html).toContain("#b91c1c");
  });
});

describe("weekly digest wiring (source guards)", () => {
  const read = (p: string): string =>
    readFileSync(new URL(p, import.meta.url), "utf8");

  const cron = read("../convex/crons.ts");
  const digestModule = read("../convex/weeklyDigest.ts");
  const emails = read("../convex/emails.ts");

  test("cron registers a weekly batched digest job", () => {
    expect(cron).toContain('"weekly_digest"');
    expect(cron).toContain("internal.weeklyDigest.sendWeeklyDigests");
    expect(cron).toContain("{ hours: 168 }");
  });

  test("digest cron is batched, gated by the persisted emailDigest pref, and deduped", () => {
    expect(digestModule).toContain("runCronBatch(");
    expect(digestModule).toContain("pageUsers");
    expect(digestModule).toContain('isNotificationCategoryEnabled(ctx, user._id, "emailDigest")');
    expect(digestModule).toContain('q.eq("userId", user._id).eq("action", "weekly_digest_sent")');
    expect(digestModule).toContain("internal.emails.sendWeeklyDigest");
    // Data honesty: empty digests are skipped, never sent.
    expect(digestModule).toContain("if (!model.hasContent) return;");
    // One digest per user per 7 days.
    expect(digestModule).toContain("DIGEST_DEDUP_MS = 7 * 24 * 60 * 60 * 1000");
  });

  test("transport action exists, is internal, and fails graceful without Brevo key", () => {
    expect(emails).toContain("export const sendWeeklyDigest = internalAction({");
    expect(emails).toContain('reason: "Brevo API key not configured"');
  });
});
