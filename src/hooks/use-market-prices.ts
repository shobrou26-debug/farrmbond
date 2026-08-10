import { useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// ============================================================
// Types
// ============================================================

export interface CommodityPrice {
  id: string;
  name: string;
  category: "cereal" | "legume" | "vegetable" | "fruit" | "livestock" | "dairy" | "poultry" | "tuber";
  unit: string;
  currency: string;
  currentPrice: number;
  previousPrice: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  lastUpdated: string;
  region: string;
  source: string;
}

export interface MarketPricesData {
  commodities: CommodityPrice[];
  lastUpdated: Date;
  source: string;
  /** True when prices come from a live exchange; always false today. */
  isLiveData: boolean;
  /** Server-authoritative label: "reference" for benchmark data. */
  dataSource: string;
}

// ============================================================
// Mapping from backend reference prices to display model
// ============================================================

const CATEGORY_BY_CROP: Record<string, CommodityPrice["category"]> = {
  maize: "cereal",
  wheat: "cereal",
  rice: "cereal",
  sorghum: "cereal",
  beans: "legume",
  soybean: "legume",
  tomato: "vegetable",
  potato: "vegetable",
  cassava: "tuber",
  avocado: "fruit",
  mango: "fruit",
  coffee: "fruit",
  tea: "cereal",
};

function titleCase(crop: string): string {
  return crop.charAt(0).toUpperCase() + crop.slice(1);
}

/**
 * Map a backend marketIntelligence price row to the display model.
 *
 * NOTE ON DATA ACCURACY: the backend returns deterministic *reference*
 * prices derived from regional price benchmarks (min/max ranges with a
 * slow daily trend). This is reference/planning data — NOT live exchange
 * data. The `source` field reflects that so the UI never claims real-time
 * pricing.
 */
function mapBackendPrice(row: {
  crop: string;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  unit: string;
  currency: string;
  change: number; // percent, rounded
  trend: string;
  lastUpdated: number;
  isLiveData?: boolean;
  dataSource?: string;
}): CommodityPrice {
  const changePercent = row.change;
  // Reconstruct previous price from the reported percent change
  const previousPrice = Math.round(row.currentPrice / (1 + changePercent / 100));
  const change = row.currentPrice - previousPrice;
  const trend: CommodityPrice["trend"] =
    row.trend === "up" || row.trend === "down" || row.trend === "stable"
      ? row.trend
      : "stable";

  return {
    id: row.crop,
    name: titleCase(row.crop),
    category: CATEGORY_BY_CROP[row.crop] ?? "cereal",
    unit: row.unit,
    currency: row.currency,
    currentPrice: row.currentPrice,
    previousPrice,
    change,
    changePercent,
    trend,
    lastUpdated: new Date(row.lastUpdated).toISOString(),
    region: "Regional benchmark",
    source: "Reference market data",
  };
}

// ============================================================
// Hook
// ============================================================

interface UseMarketPricesOptions {
  category?: string;
}

interface UseMarketPricesReturn {
  data: MarketPricesData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  getCommodity: (id: string) => CommodityPrice | undefined;
  getByCategory: (category: string) => CommodityPrice[];
  getTopGainers: (limit?: number) => CommodityPrice[];
  getTopLosers: (limit?: number) => CommodityPrice[];
}

export function useMarketPrices(options: UseMarketPricesOptions = {}): UseMarketPricesReturn {
  const { category } = options;

  // Reactive subscription to the backend reference prices. Convex keeps
  // this fresh automatically — no manual polling, no fabricated variation.
  const backendPrices = useQuery(api.marketIntelligence.getMarketPrices, {});

  const isLoading = backendPrices === undefined;
  const error = null;

  const commodities = useMemo<CommodityPrice[]>(() => {
    if (!backendPrices) return [];
    return backendPrices.map(mapBackendPrice);
  }, [backendPrices]);

  const data = useMemo<MarketPricesData | null>(() => {
    if (!backendPrices) return null;
    const lastTs = backendPrices.reduce(
      (max, row) => Math.max(max, row.lastUpdated),
      0
    );
    // The server marks every reference row isLiveData=false; the hook
    // propagates that contract instead of claiming live data. The cast
    // keeps this a runtime check even though today's type is a literal
    // `false` — when a real live feed is wired up the flag flips.
    const anyLive = backendPrices.some(
      (row) => (row.isLiveData as boolean) === true
    );
    const dataSource = backendPrices[0]?.dataSource ?? "reference";
    return {
      commodities,
      lastUpdated: lastTs > 0 ? new Date(lastTs) : new Date(),
      source: "Reference market data",
      isLiveData: anyLive,
      dataSource,
    };
  }, [backendPrices, commodities]);

  // Data is reactive via Convex — no client-side refetch needed.
  const refetch = useCallback(() => {
    // Intentionally a no-op: the query re-subscribes automatically when
    // the underlying data changes in Convex.
  }, []);

  const getCommodity = useCallback(
    (id: string) => commodities.find((c) => c.id === id),
    [commodities]
  );

  const getByCategory = useCallback(
    (cat: string) => commodities.filter((c) => c.category === cat),
    [commodities]
  );

  const getTopGainers = useCallback(
    (limit = 5) =>
      [...commodities].sort((a, b) => b.changePercent - a.changePercent).slice(0, limit),
    [commodities]
  );

  const getTopLosers = useCallback(
    (limit = 5) =>
      [...commodities].sort((a, b) => a.changePercent - b.changePercent).slice(0, limit),
    [commodities]
  );

  const filteredByCategory = useMemo(() => {
    if (!category || category === "all") return commodities;
    return getByCategory(category);
  }, [category, commodities, getByCategory]);

  return {
    data: data ? { ...data, commodities: filteredByCategory } : null,
    isLoading,
    error,
    refetch,
    getCommodity,
    getByCategory,
    getTopGainers,
    getTopLosers,
  };
}
