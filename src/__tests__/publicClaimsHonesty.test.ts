import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

// ============================================================
// Public-claims data-honesty regression tests
//
// The Landing page previously presented fabricated farmer
// testimonials ("Trusted by Farmers Worldwide") and claimed
// "thousands of farmers" were using FarmBond. The About page
// presented fictional employees as real team members (Ex-Google,
// KALRO, Stripe/Shopify, Safaricom). These source-level guards
// forbid the fabricated claims from returning and lock the honest
// replacements (capability sections, verifiable-only claims, and
// pricing that matches the server-enforced free-tier limits).
// ============================================================

const readLanding = (): string =>
  readFileSync(new URL("../pages/Landing.tsx", import.meta.url), "utf8");

const readAbout = (): string =>
  readFileSync(new URL("../pages/About.tsx", import.meta.url), "utf8");

describe("Landing page — no fabricated testimonials or adoption claims", () => {
  const src = readLanding();

  test("no fictional testimonial authors remain", () => {
    expect(src).not.toContain("Grace Wanjiku");
    expect(src).not.toContain("Peter Mwangi");
    expect(src).not.toContain("James Ochieng");
  });

  test("no testimonial framing or invented results remain", () => {
    expect(src).not.toContain("Testimonials");
    expect(src).not.toContain("Trusted by");
    expect(src).not.toContain("Farmers Worldwide");
    expect(src).not.toContain("Saved my entire crop");
    expect(src).not.toContain("cut costs by 23%");
    expect(src).not.toContain("incredibly accurate");
  });

  test("no fabricated adoption claims remain", () => {
    expect(src).not.toContain("thousands of farmers");
    expect(src).not.toContain("join thousands");
    expect(src).not.toContain("star ratings");
  });

  test("the honest capability section is present instead", () => {
    expect(src).toContain("Built for Farmers");
    expect(src).toContain("What FarmBond");
    expect(src).toContain('id="built-for-farmers"');
    expect(src).toContain("No customer testimonials");
  });

  test("pricing copy matches the server-enforced free tier", () => {
    // Backend: 1 farm (farms.ts), 5 crops (crops.ts), 5 livestock
    // (livestock.ts FREE_LIVESTOCK_LIMIT = 5), 5 AI chats/day
    // (aiAssistant.ts AI_FREE_DAILY_CHAT_LIMIT = 5).
    expect(src).toContain("Limited AI (5/day)");
    expect(src).not.toContain("Limited AI (10/day)");
    expect(src).toContain("5 livestock entries");
    expect(src).toContain("1 farm");
    expect(src).toContain("5 crops");
  });
});

describe("About page — no fictional team members", () => {
  const src = readAbout();

  test("no fictional employee names remain", () => {
    expect(src).not.toContain("Sarah Kimani");
    expect(src).not.toContain("James Ochieng");
    expect(src).not.toContain("Maria Wanjiku");
    expect(src).not.toContain("Peter Odhiambo");
    expect(src).not.toContain("Grace Nyambura");
    expect(src).not.toContain("David Mwangi");
  });

  test("no fictional employer claims remain", () => {
    expect(src).not.toContain("KALRO");
    expect(src).not.toContain("Ex-Google");
    expect(src).not.toContain("Stripe and Shopify");
    expect(src).not.toContain("Safaricom");
    expect(src).not.toContain("CEO & Co-Founder");
  });

  test("no 'Meet the Team' framing remains", () => {
    expect(src).not.toContain("Meet the People Behind FarmBond");
    expect(src).not.toContain("Our Team");
    expect(src).not.toContain("teamMembers");
  });

  test("the honest approach section is present instead", () => {
    expect(src).toContain("Our Approach");
    expect(src).toContain("How We Build FarmBond");
    expect(src).toContain("Real team members will be listed here");
  });
});
