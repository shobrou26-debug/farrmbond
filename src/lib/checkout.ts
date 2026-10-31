// Launch gate for paid checkout (core-feature launch).
//
// PAID_CHECKOUT_ENABLED=false withholds every user-facing paid purchase
// entry point (Stripe card checkout, Stripe billing portal, direct
// mobile-money initiation, and the pawaPay sandbox deposit) until a real
// live end-to-end payment has been verified. It is a CLIENT-SIDE UX gate
// only: server-side Pro enforcement, the free trial, subscription expiry
// rules, admin subscription management, and read-only status/history
// queries are all unchanged, and no server action grants access based on
// this flag.
//
// Flip to true only after a verified live end-to-end payment.
export const PAID_CHECKOUT_ENABLED = false;

export const CHECKOUT_UNAVAILABLE_NOTICE =
  "Paid subscriptions are temporarily unavailable while we finalize payment setup. Free features, your free trial, and everything you have already set up keep working as normal.";
