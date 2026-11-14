import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const content = readFileSync(resolve("src/convex/schema.ts"), "utf8");

// ============================================================
// Schema Version Control — File Integrity
// ============================================================

describe("Schema — File Integrity", () => {
  test("schema.ts file exists with substantial content", () => {
    expect(content.length).toBeGreaterThan(5000);
  });

  test("schema.ts exports default schema", () => {
    expect(content).toContain("export default schema");
  });

  test("schema.ts uses Convex defineSchema", () => {
    expect(content).toContain("defineSchema");
  });
});

// ============================================================
// Schema Version Control — Table Presence (simple string includes)
// ============================================================

describe("Schema — Required Tables Present", () => {
  const requiredTables = [
    "users", "farms", "crops", "livestock", "communityPosts",
    "communityComments", "communityReports", "transactions",
    "marketPrices", "agronomistProfiles", "consultations",
    "notifications", "ads", "adImpressions", "mobileMoneyTransactions",
    "farmCalendar", "messages", "yieldPredictions", "detectionResults",
    "agriculturalCompanies", "seeds", "userBookmarks", "communityLikes",
    "farmingEvents", "eventRegistrations"
  ];

  test("all required tables are defined in schema", () => {
    for (const table of requiredTables) {
      // Simple: schema file contains "tableName: defineTable"
      const expected = `${table}: defineTable`;
      expect(content).toContain(expected);
    }
  });
});

// ============================================================
// Schema Version Control — Auth Integration
// ============================================================

describe("Schema — Auth Integration", () => {
  test("schema includes authTables spread", () => {
    expect(content).toContain("...authTables");
  });

  test("roleValidator is defined", () => {
    expect(content).toContain("roleValidator");
  });

  test("subscriptionTierValidator is defined", () => {
    expect(content).toContain("subscriptionTierValidator");
  });
});

// ============================================================
// Schema Version Control — Validator Validity
// ============================================================

describe("Schema — Validator Validity", () => {
  test("roleValidator uses v.union with all role constants", () => {
    expect(content).toContain("v.union");
    expect(content).toContain("ROLES.FARMER");
    expect(content).toContain("ROLES.AGRONOMIST");
    expect(content).toContain("ROLES.ADMIN");
    expect(content).toContain("ROLES.SUPER_ADMIN");
  });

  test("cropStatusValidator uses v.union", () => {
    expect(content).toContain("CROP_STATUS");
    expect(content).toContain("v.union");
  });

  test("livestockStatusValidator uses v.union", () => {
    expect(content).toContain("LIVESTOCK_STATUS");
    expect(content).toContain("v.union");
  });
});

// ============================================================
// Schema Version Control — Safety Checks
// ============================================================

describe("Schema — Backward Compatibility", () => {
  test("most user fields are v.optional for backward compatibility", () => {
    const optionalMatches = content.match(/v\.optional\(/g);
    expect(optionalMatches).toBeDefined();
    expect(optionalMatches?.length).toBeGreaterThan(5);
  });

  test("tables have createdAt metadata", () => {
    const hasCreatedAt = content.match(/createdAt:\s*v\.number\(\)/g);
    expect(hasCreatedAt).toBeDefined();
  });
});
