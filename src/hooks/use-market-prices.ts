import { useState, useEffect, useCallback } from "react";

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

export interface PriceHistory {
  date: string;
  price: number;
}

export interface MarketPricesData {
  commodities: CommodityPrice[];
  lastUpdated: Date;
  source: string;
}

// ============================================================
// Local Market Prices (Simulated for East African Markets)
// ============================================================

const localMarketPrices: CommodityPrice[] = [
  {
    id: "maize",
    name: "Maize (White)",
    category: "cereal",
    unit: "90kg bag",
    currency: "KES",
    currentPrice: 4100,
    previousPrice: 3800,
    change: 300,
    changePercent: 7.9,
    trend: "up",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "NAFARM",
  },
  {
    id: "beans",
    name: "Beans (Rose Coco)",
    category: "legume",
    unit: "90kg bag",
    currency: "KES",
    currentPrice: 8500,
    previousPrice: 8200,
    change: 300,
    changePercent: 3.7,
    trend: "up",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "NAFARM",
  },
  {
    id: "wheat",
    name: "Wheat",
    category: "cereal",
    unit: "90kg bag",
    currency: "KES",
    currentPrice: 5200,
    previousPrice: 5400,
    change: -200,
    changePercent: -3.7,
    trend: "down",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "NAFARM",
  },
  {
    id: "tomatoes",
    name: "Tomatoes",
    category: "vegetable",
    unit: "kg",
    currency: "KES",
    currentPrice: 85,
    previousPrice: 70,
    change: 15,
    changePercent: 21.4,
    trend: "up",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "Local Market",
  },
  {
    id: "potatoes",
    name: "Potatoes (Irish)",
    category: "vegetable",
    unit: "50kg bag",
    currency: "KES",
    currentPrice: 2800,
    previousPrice: 3000,
    change: -200,
    changePercent: -6.7,
    trend: "down",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "Local Market",
  },
  {
    id: "milk",
    name: "Fresh Milk",
    category: "dairy",
    unit: "litre",
    currency: "KES",
    currentPrice: 55,
    previousPrice: 52,
    change: 3,
    changePercent: 5.8,
    trend: "up",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "Dairy Board",
  },
  {
    id: "eggs",
    name: "Eggs (Tray of 30)",
    category: "poultry" as const,
    unit: "tray",
    currency: "KES",
    currentPrice: 480,
    previousPrice: 450,
    change: 30,
    changePercent: 6.7,
    trend: "up",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "Local Market",
  },
  {
    id: "chicken",
    name: "Live Chicken",
    category: "livestock",
    unit: "kg",
    currency: "KES",
    currentPrice: 450,
    previousPrice: 420,
    change: 30,
    changePercent: 7.1,
    trend: "up",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "Local Market",
  },
  {
    id: "goat",
    name: "Goat (Live)",
    category: "livestock",
    unit: "head",
    currency: "KES",
    currentPrice: 8500,
    previousPrice: 8000,
    change: 500,
    changePercent: 6.3,
    trend: "up",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "Local Market",
  },
  {
    id: "cattle",
    name: "Cattle (Live)",
    category: "livestock",
    unit: "head",
    currency: "KES",
    currentPrice: 85000,
    previousPrice: 82000,
    change: 3000,
    changePercent: 3.7,
    trend: "up",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "Local Market",
  },
  {
    id: "sorghum",
    name: "Sorghum",
    category: "cereal",
    unit: "90kg bag",
    currency: "KES",
    currentPrice: 3800,
    previousPrice: 3600,
    change: 200,
    changePercent: 5.6,
    trend: "up",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "NAFARM",
  },
  {
    id: "cassava",
    name: "Cassava (Fresh)",
    category: "tuber" as const,
    unit: "kg",
    currency: "KES",
    currentPrice: 35,
    previousPrice: 38,
    change: -3,
    changePercent: -7.9,
    trend: "down",
    lastUpdated: new Date().toISOString(),
    region: "Nairobi",
    source: "Local Market",
  },
];

// ============================================================
// World Bank Commodity Price Indicators
// ============================================================

const worldBankIndicators: Record<string, string> = {
  wheat: "PC.WHEAT.MT",
  maize: "PC.CORN.MT",
  rice: "PC.RICE.MT",
  soybean: "PC.SOYBEAN.MT",
  sugar: "PC.SUGAR.US",
  cotton: "PC.COTTON.MT",
};

// ============================================================
// Hook
// ============================================================

interface UseMarketPricesOptions {
  region?: string;
  category?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
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
  const {
    region = "Nairobi",
    category,
    autoRefresh = true,
    refreshInterval = 300000, // 5 minutes
  } = options;

  const [data, setData] = useState<MarketPricesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Add some random variation to simulate real-time price changes
      const prices = localMarketPrices.map((price) => {
        const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
        const newPrice = Math.round(price.currentPrice * (1 + variation));
        const change = newPrice - price.previousPrice;
        const changePercent = (change / price.previousPrice) * 100;
        const newTrend: "up" | "down" | "stable" = change > 0 ? "up" : change < 0 ? "down" : "stable";

        return {
          ...price,
          currentPrice: newPrice,
          change,
          changePercent: parseFloat(changePercent.toFixed(1)),
          trend: newTrend,
          lastUpdated: new Date().toISOString(),
        };
      });

      setData({
        commodities: prices,
        lastUpdated: new Date(),
        source: "NAFARM + Local Markets",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch market prices");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();

    if (autoRefresh) {
      const interval = setInterval(fetchPrices, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPrices, autoRefresh, refreshInterval]);

  const getCommodity = useCallback(
    (id: string) => data?.commodities.find((c) => c.id === id),
    [data]
  );

  const getByCategory = useCallback(
    (cat: string) => data?.commodities.filter((c) => c.category === cat) || [],
    [data]
  );

  const getTopGainers = useCallback(
    (limit = 5) =>
      data
        ? [...data.commodities]
            .sort((a, b) => b.changePercent - a.changePercent)
            .slice(0, limit)
        : [],
    [data]
  );

  const getTopLosers = useCallback(
    (limit = 5) =>
      data
        ? [...data.commodities]
            .sort((a, b) => a.changePercent - b.changePercent)
            .slice(0, limit)
        : [],
    [data]
  );

  return {
    data,
    isLoading,
    error,
    refetch: fetchPrices,
    getCommodity,
    getByCategory,
    getTopGainers,
    getTopLosers,
  };
}
