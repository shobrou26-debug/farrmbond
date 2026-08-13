import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

// ============================================================
// About page data-honesty regression tests
//
// The public About page previously presented fabricated company
// statistics as fact (50,000+ farmers, 12 countries, $12M saved,
// $45M revenue uplift, 500-farmer Nakuru pilot, 23% yield gain,
// 2.5M AI recommendations, 150K hectares). FarmBond has no
// verified user base or impact data, so these source-level guards
// forbid the claims from returning.
// ============================================================

const readAbout = (): string =>
  readFileSync(new URL("../pages/About.tsx", import.meta.url), "utf8");

describe("About page — no fabricated adoption/impact statistics", () => {
  const src = readAbout();

  test("no fabricated farmer/adoption counts remain", () => {
    expect(src).not.toContain("50,000");
    expect(src).not.toContain("Farmers Served");
    expect(src).not.toContain("12 countries");
    expect(src).not.toContain("1 million farmers");
    expect(src).not.toContain("500 farmers");
    expect(src).not.toContain("Nakuru");
  });

  test("no fabricated financial impact claims remain", () => {
    expect(src).not.toContain("$12 million");
    expect(src).not.toContain("$45 million");
    expect(src).not.toContain("saved");
    expect(src).not.toContain("revenues by over");
  });

  test("no fabricated yield/impact percentages remain", () => {
    expect(src).not.toContain("23%");
    expect(src).not.toContain("18%");
    expect(src).not.toContain("Yield Gain");
  });

  test("no fabricated platform metrics remain", () => {
    expect(src).not.toContain("2.5M");
    expect(src).not.toContain("150K");
    expect(src).not.toContain("50K+");
    expect(src).not.toContain("AI Recommendations");
    expect(src).not.toContain("Hectares Monitored");
  });

  test("no wrong product name remains", () => {
    expect(src).not.toContain("FarmBridge");
  });

  test("honest mission/capability language is present instead", () => {
    expect(src).toContain("transparent");
    expect(src).toContain("verifiable impact");
    expect(src).toContain("not estimates");
    expect(src).toContain("measuring our impact");
  });
});
