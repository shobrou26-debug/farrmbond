/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminBootstrap from "../adminBootstrap.js";
import type * as ads from "../ads.js";
import type * as aiAssistant from "../aiAssistant.js";
import type * as analytics from "../analytics.js";
import type * as announcements from "../announcements.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as authHelpers from "../authHelpers.js";
import type * as community from "../community.js";
import type * as cron from "../cron.js";
import type * as cronBatch from "../cronBatch.js";
import type * as crops from "../crops.js";
import type * as currency from "../currency.js";
import type * as detectionResults from "../detectionResults.js";
import type * as emails from "../emails.js";
import type * as exports from "../exports.js";
import type * as farmCalendar from "../farmCalendar.js";
import type * as farmLocations from "../farmLocations.js";
import type * as farmingEvents from "../farmingEvents.js";
import type * as farms from "../farms.js";
import type * as http from "../http.js";
import type * as intelligence from "../intelligence.js";
import type * as irrigation from "../irrigation.js";
import type * as knowledgeArticles from "../knowledgeArticles.js";
import type * as livestock from "../livestock.js";
import type * as marketIntelligence from "../marketIntelligence.js";
import type * as marketplace from "../marketplace.js";
import type * as messaging from "../messaging.js";
import type * as mobileMoney from "../mobileMoney.js";
import type * as mobileMoneyWebhook from "../mobileMoneyWebhook.js";
import type * as satellite from "../satellite.js";
import type * as seedData from "../seedData.js";
import type * as smartNotifications from "../smartNotifications.js";
import type * as smartNotificationsCron from "../smartNotificationsCron.js";
import type * as soil from "../soil.js";
import type * as stripe from "../stripe.js";
import type * as stripeWebhook from "../stripeWebhook.js";
import type * as subscriptions from "../subscriptions.js";
import type * as supportTickets from "../supportTickets.js";
import type * as testMtnOAuth from "../testMtnOAuth.js";
import type * as transactions from "../transactions.js";
import type * as trials from "../trials.js";
import type * as users from "../users.js";
import type * as weather from "../weather.js";
import type * as weatherAlerts from "../weatherAlerts.js";
import type * as weeklyReport from "../weeklyReport.js";
import type * as yieldPredictions from "../yieldPredictions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminBootstrap: typeof adminBootstrap;
  ads: typeof ads;
  aiAssistant: typeof aiAssistant;
  analytics: typeof analytics;
  announcements: typeof announcements;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  authHelpers: typeof authHelpers;
  community: typeof community;
  cron: typeof cron;
  cronBatch: typeof cronBatch;
  crops: typeof crops;
  currency: typeof currency;
  detectionResults: typeof detectionResults;
  emails: typeof emails;
  exports: typeof exports;
  farmCalendar: typeof farmCalendar;
  farmLocations: typeof farmLocations;
  farmingEvents: typeof farmingEvents;
  farms: typeof farms;
  http: typeof http;
  intelligence: typeof intelligence;
  irrigation: typeof irrigation;
  knowledgeArticles: typeof knowledgeArticles;
  livestock: typeof livestock;
  marketIntelligence: typeof marketIntelligence;
  marketplace: typeof marketplace;
  messaging: typeof messaging;
  mobileMoney: typeof mobileMoney;
  mobileMoneyWebhook: typeof mobileMoneyWebhook;
  satellite: typeof satellite;
  seedData: typeof seedData;
  smartNotifications: typeof smartNotifications;
  smartNotificationsCron: typeof smartNotificationsCron;
  soil: typeof soil;
  stripe: typeof stripe;
  stripeWebhook: typeof stripeWebhook;
  subscriptions: typeof subscriptions;
  supportTickets: typeof supportTickets;
  testMtnOAuth: typeof testMtnOAuth;
  transactions: typeof transactions;
  trials: typeof trials;
  users: typeof users;
  weather: typeof weather;
  weatherAlerts: typeof weatherAlerts;
  weeklyReport: typeof weeklyReport;
  yieldPredictions: typeof yieldPredictions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
