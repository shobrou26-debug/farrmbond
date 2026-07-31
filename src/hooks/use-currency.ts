import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// ============================================================
// Supported Currencies
// ============================================================

export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "KES"
  | "NGN"
  | "GHS"
  | "ZAR"
  | "TZS"
  | "UGX"
  | "ETB"
  | "RWF"
  | "INR"
  | "BRL"
  | "MXN"
  | "PHP"
  | "IDR"
  | "THB"
  | "VND"
  | "CNY"
  | "JPY"
  | "AUD"
  | "CAD"
  | "CHF"
  | "SEK"
  | "NOK"
  | "DKK"
  | "PLN"
  | "CZK"
  | "HUF"
  | "TRY"
  | "AED"
  | "SAR"
  | "PKR"
  | "BDT"
  | "LKR"
  | "MMK"
  | "KHR";

export interface Currency {
  code: CurrencyCode;
  name: string;
  symbol: string;
  locale: string;
  flag: string;
}

export const CURRENCIES: Currency[] = [
  // Africa
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", locale: "en-KE", flag: "🇰🇪" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", locale: "en-NG", flag: "🇳🇬" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", locale: "en-GH", flag: "🇬🇭" },
  { code: "ZAR", name: "South African Rand", symbol: "R", locale: "en-ZA", flag: "🇿🇦" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", locale: "en-TZ", flag: "🇹🇿" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", locale: "en-UG", flag: "🇺🇬" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", locale: "en-ET", flag: "🇪🇹" },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", locale: "rw-RW", flag: "🇷🇼" },

  // Americas
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", locale: "de-DE", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB", flag: "🇬🇧" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", locale: "pt-BR", flag: "🇧🇷" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", locale: "es-MX", flag: "🇲🇽" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", locale: "en-CA", flag: "🇨🇦" },

  // Asia
  { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN", flag: "🇮🇳" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs", locale: "en-PK", flag: "🇵🇰" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", locale: "bn-BD", flag: "🇧🇩" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", locale: "en-PH", flag: "🇵🇭" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", locale: "id-ID", flag: "🇮🇩" },
  { code: "THB", name: "Thai Baht", symbol: "฿", locale: "th-TH", flag: "🇹🇭" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", locale: "vi-VN", flag: "🇻🇳" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", locale: "zh-CN", flag: "🇨🇳" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", locale: "ja-JP", flag: "🇯🇵" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", locale: "si-LK", flag: "🇱🇰" },
  { code: "MMK", name: "Myanmar Kyat", symbol: "K", locale: "my-MM", flag: "🇲🇲" },
  { code: "KHR", name: "Cambodian Riel", symbol: "៛", locale: "km-KH", flag: "🇰🇭" },

  // Middle East
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", locale: "ar-AE", flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", locale: "ar-SA", flag: "🇸🇦" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", locale: "tr-TR", flag: "🇹🇷" },

  // Oceania
  { code: "AUD", name: "Australian Dollar", symbol: "A$", locale: "en-AU", flag: "🇦🇺" },

  // Europe
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", locale: "de-CH", flag: "🇨🇭" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", locale: "sv-SE", flag: "🇸🇪" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", locale: "nb-NO", flag: "🇳🇴" },
  { code: "DKK", name: "Danish Krone", symbol: "kr", locale: "da-DK", flag: "🇩🇰" },
  { code: "PLN", name: "Polish Złoty", symbol: "zł", locale: "pl-PL", flag: "🇵🇱" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", locale: "cs-CZ", flag: "🇨🇿" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", locale: "hu-HU", flag: "🇭🇺" },
];

// ============================================================
// Approximate exchange rates to USD (for display purposes)
// ============================================================

const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  KES: 153,
  NGN: 1540,
  GHS: 14.8,
  ZAR: 18.2,
  TZS: 2510,
  UGX: 3780,
  ETB: 56,
  RWF: 1350,
  INR: 83.5,
  BRL: 4.97,
  MXN: 17.1,
  CAD: 1.36,
  PHP: 56,
  IDR: 15700,
  THB: 35.5,
  VND: 24300,
  CNY: 7.24,
  JPY: 149,
  AUD: 1.53,
  CHF: 0.88,
  SEK: 10.4,
  NOK: 10.6,
  DKK: 6.87,
  PLN: 4.03,
  CZK: 22.7,
  HUF: 358,
  TRY: 32.5,
  AED: 3.67,
  SAR: 3.75,
  PKR: 286,
  BDT: 110,
  LKR: 312,
  MMK: 2100,
  KHR: 4100,
};

// ============================================================
// Formatting Helpers
// ============================================================

/**
 * Format a number as currency using Intl.NumberFormat
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = "KES",
  options?: { showSymbol?: boolean; compact?: boolean }
): string {
  const currency = CURRENCIES.find((c) => c.code === currencyCode);
  const locale = currency?.locale ?? "en-US";
  const { showSymbol = true, compact = false } = options ?? {};

  try {
    return new Intl.NumberFormat(locale, {
      style: showSymbol ? "currency" : "decimal",
      currency: currencyCode,
      minimumFractionDigits: currencyCode === "JPY" || currencyCode === "VND" || currencyCode === "IDR" || currencyCode === "KHR" ? 0 : 2,
      maximumFractionDigits: 2,
      notation: compact ? "compact" : "standard",
      compactDisplay: "short",
    }).format(amount);
  } catch {
    // Fallback for unsupported currencies
    return `${currency?.symbol ?? currencyCode} ${amount.toLocaleString()}`;
  }
}

/**
 * Convert an amount from one currency to another using approximate rates
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  const fromRate = EXCHANGE_RATES_TO_USD[fromCurrency] ?? 1;
  const toRate = EXCHANGE_RATES_TO_USD[toCurrency] ?? 1;
  // Convert to USD first, then to target
  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
}

/**
 * Get currency info by code
 */
export function getCurrencyInfo(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

/**
 * Currency groups for the select dropdown
 */
export const CURRENCY_GROUPS = [
  {
    label: "Africa",
    currencies: CURRENCIES.filter((c) =>
      ["KES", "NGN", "GHS", "ZAR", "TZS", "UGX", "ETB", "RWF"].includes(c.code)
    ),
  },
  {
    label: "Americas",
    currencies: CURRENCIES.filter((c) =>
      ["USD", "BRL", "MXN", "CAD"].includes(c.code)
    ),
  },
  {
    label: "Europe",
    currencies: CURRENCIES.filter((c) =>
      ["EUR", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF"].includes(c.code)
    ),
  },
  {
    label: "Asia",
    currencies: CURRENCIES.filter((c) =>
      ["INR", "PKR", "BDT", "PHP", "IDR", "THB", "VND", "CNY", "JPY", "LKR", "MMK", "KHR"].includes(c.code)
    ),
  },
  {
    label: "Middle East",
    currencies: CURRENCIES.filter((c) =>
      ["AED", "SAR", "TRY"].includes(c.code)
    ),
  },
  {
    label: "Oceania",
    currencies: CURRENCIES.filter((c) =>
      ["AUD"].includes(c.code)
    ),
  },
];

// ============================================================
// Hook
// ============================================================

const STORAGE_KEY = "farmbond-currency";

export function useCurrency() {
  const prefs = useQuery(api.users.getPreferences);
  const updatePrefs = useMutation(api.users.updatePreferences);

  // Determine currency: prefer user preference, then localStorage, then KES
  const currency = useMemo(() => {
    if (prefs?.currency) return prefs.currency;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    }
    return "KES";
  }, [prefs?.currency]);

  /**
   * Set user's currency preference (persists to Convex + localStorage)
   */
  const setCurrency = useCallback(
    async (code: string) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, code);
      }
      await updatePrefs({ currency: code });
    },
    [updatePrefs]
  );

  /**
   * Format an amount in the user's preferred currency
   */
  const format = useCallback(
    (amount: number, options?: { showSymbol?: boolean; compact?: boolean; currencyOverride?: string }) => {
      return formatCurrency(amount, options?.currencyOverride ?? currency, options);
    },
    [currency]
  );

  /**
   * Convert between currencies (useful for displaying historical amounts)
   */
  const convert = useCallback(
    (amount: number, fromCurrency: string) => {
      return convertCurrency(amount, fromCurrency, currency);
    },
    [currency]
  );

  /**
   * Get the currency symbol for the current currency
   */
  const symbol = useMemo(() => {
    return getCurrencyInfo(currency)?.symbol ?? currency;
  }, [currency]);

  /**
   * Get full currency info
   */
  const info = useMemo(() => {
    return getCurrencyInfo(currency);
  }, [currency]);

  return {
    currency,
    setCurrency,
    format,
    convert,
    symbol,
    info,
    currencies: CURRENCIES,
    currencyGroups: CURRENCY_GROUPS,
    isLoading: prefs === undefined,
  };
}
