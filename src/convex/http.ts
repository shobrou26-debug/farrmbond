import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { stripeWebhook } from "./stripeWebhook";
import { mtnMoMoWebhook, airtelMoneyWebhook, mobileMoneyWebhook } from "./mobileMoneyWebhook";

const http = httpRouter();

auth.addHttpRoutes(http);

// Stripe webhook endpoint
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: stripeWebhook,
});

// MTN MoMo webhook endpoint
http.route({
  path: "/momo/webhook",
  method: "POST",
  handler: mtnMoMoWebhook,
});

// Airtel Money webhook endpoint
http.route({
  path: "/airtel/webhook",
  method: "POST",
  handler: airtelMoneyWebhook,
});

// Generic mobile money webhook endpoint (routes by provider param)
http.route({
  path: "/mobile-money/webhook",
  method: "POST",
  handler: mobileMoneyWebhook,
});

export default http;
