import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { requireAuth } from "./authHelpers";

// ============================================================
// Market Intelligence Module
// ============================================================

const CROP_PRICES: Record<string, { min: number; max: number; unit: string; currency: string }> = {
  maize: { min: 3000, max: 4500, unit: "90kg bag", currency: "KES" },
  wheat: { min: 4000, max: 5500, unit: "90kg bag", currency: "KES" },
  coffee: { min: 50000, max: 80000, unit: "ton", currency: "KES" },
  tea: { min: 300, max: 500, unit: "kg", currency: "KES" },
  tomato: { min: 30, max: 80, unit: "kg", currency: "KES" },
  beans: { min: 80, max: 150, unit: "kg", currency: "KES" },
  potato: { min: 25, max: 60, unit: "kg", currency: "KES" },
  avocado: { min: 40, max: 120, unit: "kg", currency: "KES" },
  mango: { min: 20, max: 60, unit: "kg", currency: "KES" },
  rice: { min: 80, max: 140, unit: "kg", currency: "KES" },
};

// Data honesty: CROP_PRICES are STATIC regional benchmark ranges (KES) and
// the daily trend is a deterministic synthetic wave. Nothing here is live
// exchange or auction data. Every query that returns these prices carries
// `isLiveData: false` + `dataSource: "reference"` so the UI can never claim
// real-time pricing, and consumers can label them clearly.
export const MARKET_DATA_SOURCE = "reference" as const;
export const MARKET_DATA_DISCLAIMER =
  "Indicative reference prices for planning — not live market data.";

export type ReferencePriceRow = {
  crop: string;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  unit: string;
  currency: string;
  change: number;
  trend: "up" | "down" | "stable";
  lastUpdated: number;
  isLiveData: false;
  dataSource: typeof MARKET_DATA_SOURCE;
};

/**
 * Deterministic pseudo-price trend: stable within a day, varies slowly
 * between days based on the crop key. No randomness — the same inputs
 * always produce the same output, so the UI never flickers.
 */
function deterministicVariation(crop: string, dayIndex: number): number {
  let hash = 0;
  for (let i = 0; i < crop.length; i++) {
    hash = (hash * 31 + crop.charCodeAt(i)) % 1000;
  }
  // Slow sine wave: full cycle over ~24 days, amplitude ±10%
  return Math.sin((dayIndex + hash / 100) * (Math.PI / 12)) * 0.1;
}

/**
 * Pure: build one reference-price row. Extracted for testability — the
 * data-honesty contract (isLiveData always false) lives here so a
 * regression that turns these into "live" prices is caught by unit tests.
 */
export function buildReferencePriceRow(
  crop: string,
  now: number = Date.now()
): ReferencePriceRow {
  const key = crop.toLowerCase();
  const base = CROP_PRICES[key] ?? { min: 50, max: 100, unit: "kg", currency: "KES" };
  const dayIndex = Math.floor(now / (24 * 60 * 60 * 1000));
  const mid = (base.min + base.max) / 2;
  const variation = deterministicVariation(key, dayIndex);
  const currentPrice = Math.round(mid * (1 + variation));
  const prevPrice = Math.round(mid * (1 + deterministicVariation(key, dayIndex - 1)));
  const change = currentPrice - prevPrice;
  const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

  return {
    crop: key,
    currentPrice,
    minPrice: base.min,
    maxPrice: base.max,
    unit: base.unit,
    currency: base.currency,
    change: Math.round(changePercent),
    trend: changePercent > 1 ? "up" : changePercent < -1 ? "down" : "stable",
    lastUpdated: now,
    isLiveData: false,
    dataSource: MARKET_DATA_SOURCE,
  };
}

/** Get current market prices for crops (deterministic reference prices) */
export const getMarketPrices = query({
  args: { cropTypes: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const crops = args.cropTypes ?? Object.keys(CROP_PRICES);
    return crops.map((crop) => buildReferencePriceRow(crop));
  },
});

/** Get market insights for user's crops */
export const getMarketInsights = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    // Get user's crops
    const crops = await ctx.db
      .query("crops")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const cropTypes = [...new Set(crops.map((c) => c.type?.toLowerCase() ?? "maize"))];

    // Get current prices (deterministic)
    const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const prices = cropTypes.map((crop) => {
      const base = CROP_PRICES[crop] ?? { min: 50, max: 100, unit: "kg", currency: "KES" };
      const mid = (base.min + base.max) / 2;
      const variation = deterministicVariation(crop, dayIndex);
      const currentPrice = Math.round(mid * (1 + variation));

      return {
        crop,
        currentPrice,
        minPrice: base.min,
        maxPrice: base.max,
        unit: base.unit,
        currency: base.currency,
        trend: variation > 0.02 ? "up" : variation < -0.02 ? "down" : "stable",
        // Data honesty: synthetic reference value, never live market data.
        isLiveData: false as const,
        dataSource: MARKET_DATA_SOURCE,
      };
    });

    // Generate insights
    const insights: Array<{
      type: "opportunity" | "warning" | "info";
      title: string;
      description: string;
      crop: string;
      confidence: number;
    }> = [];

    for (const price of prices) {
      if (price.trend === "up") {
        insights.push({
          type: "opportunity",
          title: `${price.crop.charAt(0).toUpperCase() + price.crop.slice(1)} Prices Rising`,
          description: `Current ${price.crop} price is KES ${price.currentPrice}/${price.unit}. Consider selling now for maximum profit.`,
          crop: price.crop,
          confidence: 75,
        });
      } else if (price.trend === "down") {
        insights.push({
          type: "warning",
          title: `${price.crop.charAt(0).toUpperCase() + price.crop.slice(1)} Prices Declining`,
          description: `Current ${price.crop} price is KES ${price.currentPrice}/${price.unit}. Consider holding or processing before selling.`,
          crop: price.crop,
          confidence: 70,
        });
      }
    }

    // Add general market insights
    insights.push({
      type: "info",
      title: "Market Activity High",
      description: "Agricultural markets are active this week. Good time for bulk sales.",
      crop: "general",
      confidence: 65,
    });

    return {
      prices,
      insights,
      lastUpdated: Date.now(),
      // Data honesty: these prices and trend insights are generated from
      // reference benchmarks, not live exchange data.
      isLiveData: false as const,
      dataSource: MARKET_DATA_SOURCE,
      disclaimer: MARKET_DATA_DISCLAIMER,
    };
  },
});

/** Get profitability analysis for a crop */
export const getProfitabilityAnalysis = query({
  args: {
    cropType: v.string(),
    quantity: v.number(),
    unit: v.string(),
    productionCost: v.number(),
  },
  handler: async (ctx, args) => {
    const base = CROP_PRICES[args.cropType.toLowerCase()] ?? { min: 50, max: 100, unit: "kg", currency: "KES" };
    const currentPrice = Math.round((base.min + base.max) / 2);

    const revenue = currentPrice * args.quantity;
    const profit = revenue - args.productionCost;
    const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
    const roi = args.productionCost > 0 ? Math.round((profit / args.productionCost) * 100) : 0;

    // Determine optimal selling window
    const now = new Date();
    const month = now.getMonth();
    const isOptimalSellingWindow = month >= 6 && month <= 9; // Post-harvest season

    return {
      cropType: args.cropType,
      currentPrice,
      unit: base.unit,
      currency: base.currency,
      revenue,
      productionCost: args.productionCost,
      profit,
      profitMargin,
      roi,
      isOptimalSellingWindow,
      // Data honesty: the price input is a reference benchmark, so the
      // profit estimate is planning-grade, not a live quote.
      isLiveData: false as const,
      dataSource: MARKET_DATA_SOURCE,
      disclaimer: MARKET_DATA_DISCLAIMER,
      recommendation: profitMargin > 30
        ? "Good profit margin. Consider expanding production."
        : profitMargin > 15
        ? "Moderate profit. Look for cost reduction opportunities."
        : "Low profit margin. Review costs and consider alternative crops.",
    };
  },
});

/**
 * Store a market price snapshot.
 * INTERNAL ONLY — intended for a trusted market-data ingestion job (cron/
 * admin pipeline). Was public and unauthenticated: any client could inject
 * arbitrary price records that would surface as "real" market data in
 * price-history charts. No public caller exists today, so it is now
 * server-side only.
 */
export const storeMarketPrice = internalMutation({
  args: {
    cropType: v.string(),
    price: v.number(),
    unit: v.string(),
    currency: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("marketPrices", {
      cropType: args.cropType.toLowerCase(),
      country: "KE",
      price: args.price,
      unit: args.unit,
      currency: args.currency,
      trend: "stable" as const,
      source: args.source,
      recordedAt: Date.now(),
    });

    return true;
  },
});

/** Get price history for a crop */
export const getPriceHistory = query({
  args: {
    cropType: v.string(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

    const history = await ctx.db
      .query("marketPrices")
      .withIndex("by_crop", (q) => q.eq("cropType", args.cropType.toLowerCase()))
      .filter((q) => q.gte(q.field("recordedAt"), cutoffDate))
      .order("asc")
      .collect();

    return history.map((h) => ({
      date: h.recordedAt,
      price: h.price,
      label: new Date(h.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  },
});
