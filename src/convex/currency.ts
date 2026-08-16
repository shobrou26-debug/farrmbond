// ============================================================
// Shared Currency Conversion (single source of truth)
// ============================================================
// Pure module (no React, no Convex bindings) so the SAME conversion
// function and rates are used by:
//   - the frontend useCurrency() hook (display + per-row conversion)
//   - Convex financial summaries (server-side aggregation)
// This keeps every surface — Dashboard, Finances, Analytics, exports,
// weekly reports — consistent with the same approximate display rates.
//
// NOTE: These are static, approximate rates maintained for DISPLAY
// purposes. They are not a trading/money-movement FX feed. Any
// cross-currency aggregation in FarmBond is a display conversion only;
// stored amounts are never rewritten.
// ============================================================

export const EXCHANGE_RATES_TO_USD: Record<string, number> = {
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
  ZMW: 27.5,
  MWK: 1740,
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

/**
 * Convert an amount from one currency to another using the approximate
 * display rates above. Unknown currencies fall back to an identity rate,
 * so a missing/legacy currency never zeroes or distorts an amount.
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
