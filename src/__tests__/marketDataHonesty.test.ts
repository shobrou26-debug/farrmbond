import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildReferencePriceRow,
  MARKET_DATA_SOURCE,
  MARKET_DATA_DISCLAIMER,
  type ReferencePriceRow,
} from "../convex/marketIntelligence";

// ============================================================
// Phase 6 — Data honesty: CROP_PRICES are synthetic reference
// benchmarks (static regional ranges + a deterministic daily
// wave). They must NEVER be presented as live market data.
// These tests lock that contract at the pure-function level and
// at the UI level.
// ============================================================

const readFrontend = (file: string): string =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("MARKET_DATA_SOURCE / disclaimer constants", () => {
  test("the source constant is 'reference', not 'live'", () => {
    expect(MARKET_DATA_SOURCE).toBe("reference");
  });

  test("the disclaimer clearly says the data is not live", () => {
    expect(MARKET_DATA_DISCLAIMER.length).toBeGreaterThan(20);
    expect(MARKET_DATA_DISCLAIMER.toLowerCase()).toContain("not live");
  });
});

describe("buildReferencePriceRow — the data-honesty contract", () => {
  const now = Date.UTC(2026, 7, 10, 12, 0, 0);

  test("every row is explicitly flagged as non-live reference data", () => {
    for (const crop of ["maize", "wheat", "coffee", "tomato", "beans", "rice"]) {
      const row = buildReferencePriceRow(crop, now);
      expect(row.isLiveData).toBe(false);
      expect(row.dataSource).toBe("reference");
    }
  });

  test("rows are deterministic — identical inputs produce identical output", () => {
    const a = buildReferencePriceRow("maize", now);
    const b = buildReferencePriceRow("maize", now);
    expect(a).toEqual(b);
  });

  test("prices stay inside the declared reference range", () => {
    const row = buildReferencePriceRow("maize", now);
    expect(row.currentPrice).toBeGreaterThanOrEqual(row.minPrice * 0.9);
    expect(row.currentPrice).toBeLessThanOrEqual(row.maxPrice * 1.1);
    expect(row.minPrice).toBeLessThanOrEqual(row.maxPrice);
  });

  test("known crops use their benchmark unit and currency", () => {
    const maize = buildReferencePriceRow("maize", now);
    expect(maize.unit).toBe("90kg bag");
    expect(maize.currency).toBe("KES");
  });

  test("unknown crops still fail closed as reference data (no live claims)", () => {
    const row = buildReferencePriceRow("durian", now);
    expect(row.isLiveData).toBe(false);
    expect(row.dataSource).toBe("reference");
    expect(row.currency).toBe("KES");
  });

  test("trend is consistent with the computed change", () => {
    const row = buildReferencePriceRow("maize", now);
    if (row.trend === "up") expect(row.change).toBeGreaterThan(1);
    if (row.trend === "down") expect(row.change).toBeLessThan(-1);
    if (row.trend === "stable") expect(Math.abs(row.change)).toBeLessThanOrEqual(1);
  });

  test("the row shape carries the reference fields (compile-time guard)", () => {
    const row: ReferencePriceRow = buildReferencePriceRow("wheat", now);
    expect(typeof row.currentPrice).toBe("number");
    expect(typeof row.lastUpdated).toBe("number");
  });
});

// ============================================================
// UI honesty: the Finances market section must not imply live
// freshness and must say the data is reference-only.
// ============================================================

describe("Finances market-price UI honesty", () => {
  const finances = readFrontend("pages/Finances.tsx");

  test("the UI no longer renders a live 'Updated HH:MM:SS' clock for prices", () => {
    expect(finances).not.toContain("Updated {marketData.lastUpdated.toLocaleTimeString()}");
  });

  test("the UI explicitly labels the prices as reference, not live", () => {
    expect(finances).toContain("Reference prices");
    expect(finances).toContain("not live market data");
  });

  test("the section subtitle describes reference benchmarks", () => {
    expect(finances).toContain("Reference market data for planning");
  });
});

// ============================================================
// Hook honesty: the consumer exposes the server's isLiveData
// flag rather than hardcoding a live claim.
// ============================================================

describe("useMarketPrices hook honesty", () => {
  const hook = readFrontend("hooks/use-market-prices.ts");

  test("the hook propagates isLiveData and dataSource from the backend", () => {
    expect(hook).toContain("isLiveData");
    expect(hook).toContain("dataSource");
  });

  test("the hook derives liveness from the rows instead of assuming it", () => {
    expect(hook).toContain("row.isLiveData");
    expect(hook).toContain("=== true");
  });
});
