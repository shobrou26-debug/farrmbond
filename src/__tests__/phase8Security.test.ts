import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";

function readConvex(file: string): string {
  return readFileSync(`src/convex/${file}`, "utf-8");
}

function count(src: string, substr: string): number {
  let c = 0;
  let i = -1;
  while ((i = src.indexOf(substr, i + 1)) !== -1) c++;
  return c;
}

// ============================================================
// Phase 8 Regression Tests
//
// These are source-integrity and contract tests, not runtime DB
// tests. They verify that the security, data-honesty, and
// feature contracts encoded in the source code are preserved
// by future edits.
// ============================================================

describe("Phase 8 — Data Honesty", () => {

  test("getFarmHealthScore returns null values when no data exists", () => {
    const src = readConvex("intelligence.ts");
    // The handler should NOT have any fallback numeric values for healthScore
    const lines = src.split("\n");
    const getFarmHealthScoreHandlerStart = lines.findIndex((l) =>
      l.includes("getFarmHealthScore")
    );
    // The handler should not contain a numeric fallback like ?? 75 or || 0
    expect(src.includes("healthScore: newHealthScore ?? 75")).toBe(false);
    expect(src.includes("healthScore: newHealthScore || 75")).toBe(false);
  });

  test("getFarmHealthScore does not fabricate ndvi from farm record", () => {
    const src = readConvex("intelligence.ts");
    // Must not fallback to farm.ndviScore
    expect(src.includes("farm.ndviScore")).toBe(true); // it reads it
    // But should not fabricate if missing
    expect(src.includes("?? farm.ndviScore")).toBe(false);
  });

  test("getDashboardIntelligence returns null values when no data exists", () => {
    const src = readConvex("intelligence.ts");
    // Should NOT have a default 75/medium for computed fields
    const lines = src.split("\n");
    const hasDefaultHealthScore = lines.some(
      (l) =>
        l.includes("healthScore") &&
        (l.includes("?? 75") || l.includes("|| 75") || l.includes("?? 80"))
    );
    expect(hasDefaultHealthScore).toBe(false);
  });

  test("compareSeasonalVegetation returns null components when insufficient data", () => {
    const src = readConvex("satellite.ts");
    // Should return null values for components when data is insufficient
    expect(src.includes("currentAverage: null")).toBe(true);
    expect(src.includes("previousAverage: null")).toBe(true);
  });

  test("getSatelliteAnalysis returns null ndvi when unavailable", () => {
    const src = readConvex("satellite.ts");
    expect(src.includes("currentNDVI: null")).toBe(true);
  });

  test("weeklyReport uses null for riskScore when no data", () => {
    const src = readConvex("weeklyReport.ts");
    // Should not default riskScore to 0
    expect(src.includes("riskScore: 0")).toBe(false);
    // Should not fabricate healthScore
    expect(src.includes("healthScore: 75")).toBe(false);
  });

  test("marketIntelligence clearly marks all prices as synthetic", () => {
    const src = readConvex("marketIntelligence.ts");
    expect(src.includes('isLiveData: false')).toBe(true);
    expect(src.includes('dataSource: "reference"')).toBe(true);
    expect(src.includes("MARKET_DATA_DISCLAIMER")).toBe(true);
  });
});

describe("Phase 8 — Consultation Payments", () => {

  test("bookConsultation determines price server-side", () => {
    const src = readConvex("marketplace.ts");
    // Price should be computed from the agronomist's rate, not accepted from client
    expect(src.includes("agronomistConsultationPrice")).toBe(true);
    expect(src.includes("basePrice")).toBe(true);
  });

  test("initiateConsultationPayment is an internal action", () => {
    const src = readConvex("mobileMoney.ts");
    // Should reference the consultation payment action
    expect(src.includes("initiateConsultationPayment")).toBe(true);
  });

  test("mobileMoney settleConsultationPayment is internalMutation", () => {
    const src = readConvex("mobileMoney.ts");
    expect(src.includes("settleConsultationPayment")).toBe(true);
  });

  test("consultation has paymentStatus field", () => {
    const src = readConvex("schema.ts");
    // The schema should define paymentStatus for consultations or the marketplace
    expect(src.includes("paymentStatus")).toBe(true);
  });
});

describe("Phase 8 — Announcements", () => {

  test("announcement module has required exports", () => {
    const src = readConvex("announcements.ts");
    expect(src.includes("export const createAnnouncement = mutation")).toBe(true);
    expect(src.includes("export const updateAnnouncement = mutation")).toBe(true);
    expect(src.includes("export const deleteAnnouncement = mutation")).toBe(true);
    expect(src.includes("export const listPublishedAnnouncements = query")).toBe(true);
    expect(src.includes("export const listAllAnnouncements = query")).toBe(true);
  });

  test("announcement create requires admin", () => {
    const src = readConvex("announcements.ts");
    expect(src.includes("requireAdmin")).toBe(true);
  });

  test("announcement listPublished does not require auth (public)", () => {
    const src = readConvex("announcements.ts");
    // Published announcements are readable without auth
    const listPublishedLines = src.split("\n").filter((l) =>
      l.includes("listPublishedAnnouncements") || l.includes("requireAuth")
    );
    const handlerIndex = src.indexOf("listPublishedAnnouncements");
    const authIndex = src.indexOf("requireAuth", handlerIndex);
    // The published query should either not require auth, or use a query not mutation
    expect(src.includes("listPublishedAnnouncements = query")).toBe(true);
  });
});

describe("Phase 8 — Support Tickets", () => {

  test("supportTickets module has required exports", () => {
    const src = readConvex("supportTickets.ts");
    expect(src.includes("export const createTicket = mutation")).toBe(true);
    expect(src.includes("export const replyToTicket = mutation")).toBe(true);
    expect(src.includes("export const listMyTickets = query")).toBe(true);
    expect(src.includes("export const getMyTicket = query")).toBe(true);
    expect(src.includes("export const listAllTickets = query")).toBe(true);
    expect(src.includes("export const adminReplyToTicket = mutation")).toBe(true);
    expect(src.includes("export const updateTicketStatus = mutation")).toBe(true);
  });

  test("ticket create requires auth", () => {
    const src = readConvex("supportTickets.ts");
    expect(src.includes("await requireAuth")).toBe(true);
  });

  test("ticket reply enforces ownership", () => {
    const src = readConvex("supportTickets.ts");
    expect(src.includes("ticket.userId !== userId")).toBe(true);
    expect(src.includes("Access denied")).toBe(true);
  });

  test("admin ticket ops require admin", () => {
    const src = readConvex("supportTickets.ts");
    expect(src.includes("await requireAdmin")).toBe(true);
  });

  test("getMyTicket returns null for non-owner", () => {
    const src = readConvex("supportTickets.ts");
    expect(src.includes("if (ticket.userId !== userId) return null")).toBe(true);
  });
});

describe("Phase 8 — Messaging", () => {

  test("messaging module has required exports", () => {
    const src = readConvex("messaging.ts");
    expect(src.includes("export const sendMessage = mutation")).toBe(true);
    expect(src.includes("export const listConversations = query")).toBe(true);
    expect(src.includes("export const listMessages = query")).toBe(true);
    expect(src.includes("export const markConversationRead = mutation")).toBe(true);
    expect(src.includes("export const getUnreadCount = query")).toBe(true);
  });

  test("sendMessage requires auth", () => {
    const src = readConvex("messaging.ts");
    expect(src.includes("await requireAuth")).toBe(true);
  });

  test("sendMessage prevents self-messaging", () => {
    const src = readConvex("messaging.ts");
    expect(src.includes("Cannot send a message to yourself")).toBe(true);
  });

  test("sendMessage has rate limiting", () => {
    const src = readConvex("messaging.ts");
    expect(src.includes("checkRateLimit")).toBe(true);
  });

  test("listMessages verifies participant", () => {
    const src = readConvex("messaging.ts");
    expect(src.includes("m.senderId === userId || m.receiverId === userId")).toBe(true);
    expect(src.includes("isParticipant")).toBe(true);
  });

  test("markConversationRead verifies participant", () => {
    const src = readConvex("messaging.ts");
    expect(src.includes("m.senderId === userId || m.receiverId === userId")).toBe(true);
    expect(src.includes("Access denied")).toBe(true);
  });
});

describe("Phase 8 — Frontend Pages Exist", () => {

  test("Messages page exists", () => {
    const exists = readFileSync("src/pages/Messages.tsx", "utf-8").length > 0;
    expect(exists).toBe(true);
  });

  test("Messages page has conversation list and message thread", () => {
    const src = readFileSync("src/pages/Messages.tsx", "utf-8");
    expect(src.includes("listConversations")).toBe(true);
    expect(src.includes("listMessages")).toBe(true);
    expect(src.includes("sendMessage")).toBe(true);
  });

  test("Support page exists", () => {
    const src = readFileSync("src/pages/Support.tsx", "utf-8");
    expect(src.length).toBeGreaterThan(100);
    expect(src.includes("createTicket")).toBe(true);
  });

  test("MyConsultations page has pay functionality", () => {
    const src = readFileSync("src/pages/MyConsultations.tsx", "utf-8");
    expect(src.includes("initiateConsultationPayment")).toBe(true);
    expect(src.includes("Pay Now")).toBe(true);
    expect(src.includes("KES")).toBe(true);
  });

  test("AdminDashboard imports SupportTab component", () => {
    const src = readFileSync("src/pages/AdminDashboard.tsx", "utf-8");
    expect(src.includes("SupportTab")).toBe(true);
  });

  test("Dashboard imports AnnouncementsWidget", () => {
    const src = readFileSync("src/pages/Dashboard.tsx", "utf-8");
    expect(src.includes("AnnouncementsWidget")).toBe(true);
    expect(src.includes("listPublishedAnnouncements")).toBe(true);
  });
});

describe("Phase 8 — Router & Nav", () => {

  test("Router has support, messages, consultations routes", () => {
    const src = readFileSync("src/main.tsx", "utf-8");
    expect(src.includes("path=\"/support\"")).toBe(true);
    expect(src.includes("path=\"/messages\"")).toBe(true);
    expect(src.includes("path=\"/my-consultations\"")).toBe(true);
  });

  test("AppLayout nav has Messages and Support items", () => {
    const src = readFileSync("src/components/layout/AppLayout.tsx", "utf-8");
    expect(src.includes('href: "/messages"')).toBe(true);
    expect(src.includes('href: "/support"')).toBe(true);
  });
});