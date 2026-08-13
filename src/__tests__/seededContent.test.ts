import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

// ============================================================
// Seeded/demo content data-integrity regression tests
//
// The admin seed tool creates demo agronomists, companies, seeds,
// knowledge articles, and farming events. Previously these were
// indistinguishable from real content — a farmer could book (and pay
// for) a consultation with a seeded agronomist. These source-level
// guards lock the server-enforced contract:
//
//   * Every seeded table carries an isSeeded marker.
//   * Every seed insert sets isSeeded: true.
//   * Public reads exclude seeded rows; booking/registration reject
//     seeded profiles; a direct backend call cannot bypass this.
//   * Admins retain visibility through includeSeeded args.
// ============================================================

const read = (file: string): string =>
  readFileSync(new URL(`../convex/${file}`, import.meta.url), "utf8");

const count = (source: string, re: RegExp): number =>
  (source.match(re) ?? []).length;

describe("Schema — isSeeded marker on every seeded table", () => {
  const schema = read("schema.ts");

  test("agronomistProfiles has isSeeded", () => {
    const block = schema.slice(schema.indexOf("agronomistProfiles: defineTable"), schema.indexOf("consultations: defineTable"));
    expect(block).toContain("isSeeded: v.optional(v.boolean())");
  });

  test("agriculturalCompanies has isSeeded", () => {
    const block = schema.slice(schema.indexOf("agriculturalCompanies: defineTable"), schema.indexOf("seeds: defineTable"));
    expect(block).toContain("isSeeded: v.optional(v.boolean())");
  });

  test("seeds has isSeeded", () => {
    const block = schema.slice(schema.indexOf("seeds: defineTable"), schema.indexOf("userBookmarks: defineTable"));
    expect(block).toContain("isSeeded: v.optional(v.boolean())");
  });

  test("knowledgeArticles has isSeeded", () => {
    const block = schema.slice(schema.indexOf("knowledgeArticles: defineTable"), schema.indexOf("irrigationSchedules: defineTable"));
    expect(block).toContain("isSeeded: v.optional(v.boolean())");
  });

  test("farmingEvents has isSeeded", () => {
    const block = schema.slice(schema.indexOf("farmingEvents: defineTable"), schema.indexOf("eventRegistrations: defineTable"));
    expect(block).toContain("isSeeded: v.optional(v.boolean())");
  });
});

describe("seedData — every insert marks the row as seeded", () => {
  const seed = read("seedData.ts");

  test("agronomist profiles are inserted with isSeeded: true", () => {
    const block = seed.slice(seed.indexOf('insert("agronomistProfiles"'), seed.indexOf('insert("agriculturalCompanies"'));
    expect(block).toContain("isSeeded: true");
  });

  test("companies, seeds, articles, and events are inserted with isSeeded: true", () => {
    expect(seed.slice(seed.indexOf('insert("agriculturalCompanies"'), seed.indexOf('insert("seeds"'))).toContain("isSeeded: true");
    expect(seed.slice(seed.indexOf('insert("seeds"'), seed.indexOf('insert("knowledgeArticles"'))).toContain("isSeeded: true");
    expect(seed.slice(seed.indexOf('insert("knowledgeArticles"'), seed.indexOf('insert("farmingEvents"'))).toContain("isSeeded: true");
    expect(seed.slice(seed.indexOf('insert("farmingEvents"'))).toContain("isSeeded: true");
  });
});

describe("marketplace — seeded agronomists are never bookable (server-enforced)", () => {
  const src = read("marketplace.ts");

  test("isSeededAgronomist helper exists", () => {
    expect(src).toContain("export function isSeededAgronomist");
  });

  test("listAgronomists excludes seeded profiles by default, with includeSeeded escape for admins", () => {
    expect(src).toContain("includeSeeded: v.optional(v.boolean())");
    expect(src).toContain("(args.includeSeeded || !isSeededAgronomist(p))");
  });

  test("getAgronomist returns null for seeded profiles", () => {
    expect(src).toContain("isSeededAgronomist(profile)) return null");
  });

  test("bookConsultation rejects seeded profiles — direct backend calls cannot bypass", () => {
    const block = src.slice(src.indexOf("export const bookConsultation"), src.indexOf("getConsultationByIdInternal"));
    expect(block).toContain("isSeededAgronomist(agronomistProfile)");
    expect(block).toContain("not available for bookings");
  });

  test("listCompanies/listSeeds exclude seeded by default and getCompany/getSeed return null for seeded", () => {
    expect(src).toContain("args.includeSeeded || c.isSeeded !== true");
    expect(src).toContain("args.includeSeeded || s.isSeeded !== true");
    expect(src).toContain("if (!company || company.isSeeded === true) return null;");
    expect(src).toContain("if (!seed || seed.isSeeded === true) return null;");
  });
});

describe("knowledgeArticles — seeded articles never appear publicly", () => {
  const src = read("knowledgeArticles.ts");

  test("listPublished excludes seeded articles", () => {
    expect(src).toContain("a.isSeeded !== true");
  });

  test("getArticle returns null for seeded articles to non-admins", () => {
    expect(src).toContain("if (article.isSeeded === true && !isAdmin) return null;");
  });
});

describe("farmingEvents — seeded events are not listed or registrable", () => {
  const src = read("farmingEvents.ts");

  test("listEvents excludes seeded events", () => {
    expect(src).toContain("e.isSeeded !== true");
  });

  test("registerForEvent rejects seeded events server-side", () => {
    expect(src).toContain("event.isSeeded === true");
  });
});

describe("Admin visibility preserved", () => {
  test("admin pages pass includeSeeded: true so seeded content remains manageable", () => {
    const admin = readFileSync(new URL("../pages/AdminDashboard.tsx", import.meta.url), "utf8");
    const seedMgmt = readFileSync(new URL("../pages/SeedManagement.tsx", import.meta.url), "utf8");
    expect(count(admin, /includeSeeded: true/g)).toBeGreaterThanOrEqual(3);
    expect(count(seedMgmt, /includeSeeded: true/g)).toBeGreaterThanOrEqual(2);
  });
});
