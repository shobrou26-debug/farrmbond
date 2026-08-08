import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
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

/** Get current market prices for crops (deterministic reference prices) */
export const getMarketPrices = query({
  args: { cropTypes: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const crops = args.cropTypes ?? Object.keys(CROP_PRICES);
    const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));

    return crops.map((crop) => {
      const base = CROP_PRICES[crop.toLowerCase()] ?? { min: 50, max: 100, unit: "kg", currency: "KES" };
      const mid = (base.min + base.max) / 2;
      const variation = deterministicVariation(crop.toLowerCase(), dayIndex);
      const currentPrice = Math.round(mid * (1 + variation));
      const prevPrice = Math.round(mid * (1 + deterministicVariation(crop.toLowerCase(), dayIndex - 1)));
      const change = currentPrice - prevPrice;
      const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

      return {
        crop: crop.toLowerCase(),
        currentPrice,
        minPrice: base.min,
        maxPrice: base.max,
        unit: base.unit,
        currency: base.currency,
        change: Math.round(changePercent),
        trend: changePercent > 1 ? "up" : changePercent < -1 ? "down" : "stable",
        lastUpdated: Date.now(),
      };
    });
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
      recommendation: profitMargin > 30
        ? "Good profit margin. Consider expanding production."
        : profitMargin > 15
        ? "Moderate profit. Look for cost reduction opportunities."
        : "Low profit margin. Review costs and consider alternative crops.",
    };
  },
});

/** Store market price snapshot */
export const storeMarketPrice = mutation({
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
