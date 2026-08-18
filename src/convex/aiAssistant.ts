import { action, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { createAuditLog, isSubscriptionActive } from "./authHelpers";

// ============================================================
// AI Farming Assistant
// Primary: Groq (free tier: 14,400 requests/day, fast inference)
// Fallback: Google Gemini for multimodal/image analysis
// ============================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile"; // 1,000 req/day free — best quality
// Alternative: "llama-3.1-8b-instant" — 14,400 req/day free — fastest

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ============================================================
// AI usage limits (per-user, per-day)
// Free plan gets a daily quota; Pro (active subscription) is unlimited.
// Usage is tracked in the audit log (action "ai_chat" / "ai_disease").
// ============================================================

const AI_FREE_DAILY_CHAT_LIMIT = 5;
const AI_PRO_DAILY_CHAT_LIMIT = 500;
const AI_FREE_DAILY_DETECT_LIMIT = 3;
const AI_PRO_DAILY_DETECT_LIMIT = 100;

/** Pure limit selector (exported for tests): free users get a small
 * daily allowance; active Pro users get a much larger one. */
export function getAiDailyLimit(
  isPro: boolean,
  usageAction: "ai_chat" | "ai_disease"
): number {
  if (usageAction === "ai_chat") {
    return isPro ? AI_PRO_DAILY_CHAT_LIMIT : AI_FREE_DAILY_CHAT_LIMIT;
  }
  return isPro ? AI_PRO_DAILY_DETECT_LIMIT : AI_FREE_DAILY_DETECT_LIMIT;
}

/** Internal: count a user's AI calls today for a given usage action. */
export const getAiUsageCount = internalQuery({
  args: {
    userId: v.id("users"),
    usageAction: v.string(),
  },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_user_action", (q) =>
        q.eq("userId", args.userId).eq("action", args.usageAction)
      )
      .filter((q) => q.gte(q.field("createdAt"), startOfDay.getTime()))
      .collect();
    return rows.length;
  },
});

/** Internal: record one AI usage entry for the authenticated user. */
export const logAiUsage = internalMutation({
  args: {
    userId: v.id("users"),
    usageAction: v.string(),
    feature: v.string(),
  },
  handler: async (ctx, args) => {
    await createAuditLog(ctx, {
      userId: args.userId,
      action: args.usageAction,
      resource: "ai_assistant",
      resourceId: args.userId,
      changes: { feature: args.feature },
    });
  },
});

/**
 * Resolve the authenticated user's daily AI allowance.
 * Returns the limit, or throws when the user is not authenticated.
 */
async function getAiQuota(
  ctx: any,
  usageAction: "ai_chat" | "ai_disease"
): Promise<{ userId: any; limit: number; isPro: boolean }> {
  const user = await ctx.runQuery(api.users.currentUser);
  if (!user) throw new Error("Authentication required");
  const isPro = user.subscriptionTier === "pro" && isSubscriptionActive(user);
  const limit = getAiDailyLimit(isPro, usageAction);
  return { userId: user._id, limit, isPro };
}

// ============================================================
// System prompt — structured for data-driven recommendations
// ============================================================

const SYSTEM_PROMPT = `You are FarmBond AI, a professional agricultural intelligence assistant. You help farmers make informed, data-driven decisions about their farms.

═══════════════════════════════════════════════════════════════
IDENTITY
═══════════════════════════════════════════════════════════════
You are a knowledgeable, practical, and honest farming advisor. You combine general agricultural science with the farmer's actual FarmBond data to provide personalized guidance.

═══════════════════════════════════════════════════════════════
DATA SOURCES
═══════════════════════════════════════════════════════════════
The farmer's FarmBond account may provide you with:
- Farms: name, location, size, soil type, pH, NDVI, irrigation type
- Crops: name, variety, planting date, status, health score, harvest date
- Livestock: type, quantity, status, health score, vaccination schedule
- Weather: current conditions + forecast (cached, labeled "cached" in the data)
- Soil: pH, organic matter, NPK, moisture, drainage, fertility rating
- Irrigation: active schedules, water amounts, last run, upcoming runs
- Finances: income, expenses, profit (converted to their display currency)
- Market: reference prices for their crops (labeled as reference data, NOT live market data)
- Health: overall farm health score when enough data exists

When this data is provided below, it is REAL data from their FarmBond account.

═══════════════════════════════════════════════════════════════
RESPONSE FRAMEWORK
═══════════════════════════════════════════════════════════════
For every farming question, follow this structure:

1. **Data Assessment** — briefly state what FarmBond data you have for this question and what is missing.
2. **Analysis** — interpret the available data (e.g., weather forecast, crop stage, soil condition).
3. **Recommendations** — give 2-4 specific, actionable steps. Each step should:
   - Start with a clear action verb
   - Include timing when relevant (e.g., "within the next 2 days")
   - Reference the source (e.g., "Based on your weather forecast..." or "General best practice...")
4. **Risk Note** — mention any risks if relevant, or say "No significant risks detected."
5. **Local Expert** — where appropriate, remind them to verify with a local agronomist or extension officer.

═══════════════════════════════════════════════════════════════
HONESTY RULES (mandatory — never break these)
═══════════════════════════════════════════════════════════════
- NEVER invent farm statistics, crop yields, financial figures, market prices, or weather data.
- When you lack data to answer a specific question, say: "I don't have enough recorded data for that yet. Here's what you could do to build this information in FarmBond..."
- Clearly distinguish between:
  A) Data retrieved from FarmBond (reference it: "Your data shows...")
  B) General agricultural knowledge (label it: "Based on general agricultural practice...")
  C) Information that is unavailable (say: "This information is not available in your FarmBond account.")
- For plant disease or livestock health questions: provide general guidance based on described symptoms, but NEVER claim a definitive diagnosis. Always recommend consulting a veterinarian, agronomist, or extension officer.
- Market prices labeled "reference" are reference benchmarks, NOT live exchange data. Never present them as real-time market prices.
- Weather data labeled "cached" is the last cached forecast, not a live reading.

═══════════════════════════════════════════════════════════════
CURRENCY AND UNITS
═══════════════════════════════════════════════════════════════
- The farmer's currency preference is stated in their profile. Use it for all financial amounts.
- The farmer's unit preference (metric/imperial) is stated in their profile. Respect it.
- Weather data in the context is in metric (°C, km/h, mm). If the farmer uses imperial, convert in your response.
- Never assume a currency. If none is stated, ask rather than guessing.

═══════════════════════════════════════════════════════════════
LOCALIZATION
═══════════════════════════════════════════════════════════════
- The farmer's language preference is in their profile. Respond in that language when stated.
- If no language is stated, respond in the language the user writes in.
- Consider their country and climate zone when giving planting or seasonal advice.

═══════════════════════════════════════════════════════════════
RECOMMENDATION PRIORITIES
═══════════════════════════════════════════════════════════════
When asked to prioritize or give an action plan, rank by:
1. Urgent risks (livestock health, extreme weather, overdue irrigation)
2. Time-sensitive opportunities (optimal planting windows, market selling)
3. Crop management (fertilization, pest control, growth monitoring)
4. Financial optimization (expense reduction, profit improvement)
5. Long-term planning (soil improvement, infrastructure, diversification)

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════
- Use **bold** for section headers
- Use bullet points (•) for lists
- Use numbered steps for sequential actions
- Keep responses focused: 150-400 words unless the question requires more detail
- Use emoji sparingly for visual clarity (🌱 🐛 🌤️ 💰 🐄)
- Be professional, encouraging, and practical
- Give concrete steps, not vague advice`;

/**
 * Build Groq/OpenAI-compatible messages array from conversation history.
 * Accepts an optional system prompt override so farm-aware requests can
 * inject the farmer's real FarmBond context.
 */
function buildGroqMessages(
  history: Array<{ role: string; parts: Array<{ text: string }> }> | undefined,
  currentMessage: string,
  systemPrompt: string = SYSTEM_PROMPT,
) {
  const messages: Array<{ role: string; content: string }> = [];

  // System instruction
  messages.push({ role: "system", content: systemPrompt });

  if (!history || history.length === 0) {
    messages.push({ role: "user", content: currentMessage });
  } else {
    // Convert Gemini-style history to OpenAI/Groq format
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      const text = msg.parts?.map((p) => p.text).join("\n") || "";
      // Strip system instruction prefix from first message if present
      const cleaned = i === 0 ? text.replace(/^System instruction:.*?\n\n/s, "") : text;
      messages.push({
        role: msg.role === "model" ? "assistant" : "user",
        content: cleaned,
      });
    }
    messages.push({ role: "user", content: currentMessage });
  }

  return messages;
}

/**
 * Enforce the user's daily AI chat quota.
 * Returns the resolved quota (userId + limit) or throws when over limit.
 */
async function enforceChatQuota(ctx: ActionCtx) {
  const quota = await getAiQuota(ctx, "ai_chat");
  const used = await ctx.runQuery(internal.aiAssistant.getAiUsageCount, {
    userId: quota.userId,
    usageAction: "ai_chat",
  });
  if (used >= quota.limit) {
    throw new Error(
      quota.isPro
        ? "Daily AI message limit reached. Please try again tomorrow."
        : `Free plan allows ${AI_FREE_DAILY_CHAT_LIMIT} AI messages per day. Upgrade to Pro for unlimited AI — Settings > Subscription.`
    );
  }
  return quota;
}

/** Record one successful chat usage entry. */
async function logChatUsage(ctx: ActionCtx, userId: any) {
  await ctx.runMutation(internal.aiAssistant.logAiUsage, {
    userId,
    usageAction: "ai_chat",
    feature: "chat",
  });
}

/**
 * Shared chat completion: calls Groq and falls back to Gemini when Groq
 * fails or is unconfigured. Throws only when no provider can answer.
 */
async function runChatCompletion(
  systemPrompt: string,
  message: string,
  history: Array<{ role: string; parts: Array<{ text: string }> }> | undefined,
): Promise<string> {
  if (GROQ_API_KEY) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: buildGroqMessages(history, message, systemPrompt),
          temperature: 0.7,
          top_p: 0.95,
          max_tokens: 2048,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API error:", response.status, errorText);
        throw new Error(`Groq error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
      throw new Error("No response generated from AI");
    } catch (error) {
      console.error("Groq chat failed, trying Gemini fallback:", error);
      // Fall through to Gemini when available
    }
  }

  if (GEMINI_API_KEY) {
    const result = await chatWithGeminiFallback(message, history, systemPrompt);
    return result.response;
  }

  throw new Error("AI service is not configured.");
}

// ============================================================
// Farm context builder — comprehensive, auth-scoped, honest
// ============================================================

/** Helper to safely format a number for the prompt. */
function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "—";
  return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
}

/**
 * Build a comprehensive, real FarmBond context block for the authenticated
 * farmer. Includes farms, crops, livestock, weather, irrigation schedules,
 * soil data, financial summary, market reference prices, and farm health.
 *
 * Every query is auth-scoped. Missing data is omitted or labeled unavailable
 * — never fabricated.
 */
async function buildFarmContext(ctx: ActionCtx): Promise<string> {
  const parts: string[] = [];
  const now = new Date();

  // ── Date/season context ──────────────────────────────────────
  parts.push(
    `Current date: ${now.toISOString().slice(0, 10)} (${now.toLocaleString("en", { weekday: "long" })})`
  );

  // ── Farmer profile ───────────────────────────────────────────
  const user = await ctx.runQuery(api.users.currentUser);
  if (user) {
    const bits: string[] = [];
    if (user.name) bits.push(`name: ${user.name}`);
    if (user.country) bits.push(`country: ${user.country}`);
    if (user.language) bits.push(`language: ${user.language}`);
    if (user.currency) bits.push(`currency: ${user.currency}`);
    if (user.units) bits.push(`units: ${user.units}`);
    if (user.timezone) bits.push(`timezone: ${user.timezone}`);
    if (bits.length) parts.push(`Farmer profile: ${bits.join(", ")}`);
  }

  // ── Farms ────────────────────────────────────────────────────
  const farmsRes = await ctx.runQuery(api.farms.listUserFarms, {});
  const farms = farmsRes?.page ?? [];
  if (farms.length === 0) {
    parts.push("Farms: none registered yet.");
    return parts.join("\n");
  }

  for (const farm of farms.slice(0, 3)) {
    const loc = farm.location;
    const locBits: string[] = [];
    if (loc?.address) locBits.push(loc.address);
    if (loc?.city) locBits.push(loc.city);
    if (loc?.country) locBits.push(loc.country);
    const sizeBit = farm.sizeUnit === "acres" ? `${farm.size} acres` : `${farm.size} ha`;
    const farmLines: string[] = [
      `Farm "${farm.name}" (${sizeBit}, status: ${farm.status})` +
        (locBits.length ? ` — ${locBits.join(", ")}` : "") +
        (loc?.latitude != null && loc?.longitude != null
          ? ` [lat ${loc.latitude.toFixed(2)}, lon ${loc.longitude.toFixed(2)}]`
          : ""),
    ];

    // Soil info from farm record
    const soilBits: string[] = [];
    if (farm.soilType) soilBits.push(`type: ${farm.soilType}`);
    if (farm.soilPh != null) soilBits.push(`pH: ${farm.soilPh}`);
    if (farm.ndviScore != null) soilBits.push(`NDVI: ${farm.ndviScore}/100`);
    if (farm.irrigationType) soilBits.push(`irrigation: ${farm.irrigationType}`);
    if (soilBits.length) farmLines.push(`  Soil: ${soilBits.join(", ")}`);

    // ── Detailed soil analysis (if available) ──────────────────
    try {
      const soil = await ctx.runQuery(api.soil.getSoilAnalysis, { farmId: farm._id });
      if (soil) {
        const sBits: string[] = [];
        if (soil.ph != null) sBits.push(`pH ${fmtNum(soil.ph, 1)}`);
        if (soil.organicMatter != null) sBits.push(`OM ${fmtNum(soil.organicMatter, 1)}%`);
        if (soil.nitrogen != null) sBits.push(`N ${fmtNum(soil.nitrogen, 1)}`);
        if (soil.phosphorus != null) sBits.push(`P ${fmtNum(soil.phosphorus, 1)}`);
        if (soil.potassium != null) sBits.push(`K ${fmtNum(soil.potassium, 1)}`);
        if (soil.soilMoisture != null) sBits.push(`moisture ${fmtNum(soil.soilMoisture)}%`);
        if (soil.drainage) sBits.push(`drainage: ${soil.drainage}`);
        if (soil.texture) sBits.push(`texture: ${soil.texture}`);
        if (soil.fertility) sBits.push(`fertility: ${soil.fertility}`);
        if (soil.isEstimated) sBits.push("(estimated — not a lab test)");
        if (sBits.length) farmLines.push(`  Detailed soil: ${sBits.join(", ")}`);
        if (soil.recommendations?.length) {
          farmLines.push(`  Soil recommendations: ${soil.recommendations.slice(0, 3).join("; ")}`);
        }
      }
    } catch {
      // Soil data unavailable — omit
    }

    // ── Crops ──────────────────────────────────────────────────
    const cropsRes = await ctx.runQuery(api.crops.listFarmCrops, {
      farmId: farm._id,
    });
    const crops = cropsRes?.page ?? [];
    if (crops.length > 0) {
      const cropBits = crops.slice(0, 6).map((c) => {
        const bits = [
          c.name,
          c.variety ? `(${c.variety})` : "",
          `planted ${new Date(c.plantingDate).toISOString().slice(0, 10)}`,
          `status: ${c.status}`,
        ];
        if (c.healthScore != null) bits.push(`health: ${c.healthScore}/100`);
        if (c.expectedHarvestDate) bits.push(`harvest ${new Date(c.expectedHarvestDate).toISOString().slice(0, 10)}`);
        return bits.filter(Boolean).join(" ");
      });
      farmLines.push(
        `  Crops: ${cropBits.join(" | ")}${crops.length > 6 ? ` (+${crops.length - 6} more)` : ""}`
      );
    } else {
      farmLines.push("  Crops: none on this farm");
    }

    // ── Livestock ──────────────────────────────────────────────
    const livestockRes = await ctx.runQuery(api.livestock.listFarmLivestock, {
      farmId: farm._id,
    });
    const livestock = livestockRes?.page ?? [];
    if (livestock.length > 0) {
      const liveBits = livestock.slice(0, 4).map((l) => {
        const bits = [`${l.quantity} ${l.type}`, `status: ${l.status}`];
        if (l.healthScore != null) bits.push(`health: ${l.healthScore}/100`);
        if (l.nextVaccination) bits.push(`next vaccination ${new Date(l.nextVaccination).toISOString().slice(0, 10)}`);
        return bits.join(", ");
      });
      farmLines.push(
        `  Livestock: ${liveBits.join(" | ")}${livestock.length > 4 ? ` (+${livestock.length - 4} more)` : ""}`
      );
    } else {
      farmLines.push("  Livestock: none on this farm");
    }

    // ── Weather ────────────────────────────────────────────────
    if (loc?.latitude != null && loc?.longitude != null) {
      try {
        const weather = await ctx.runQuery(api.weather.getCachedWeather, {
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        if (weather) {
          const wbits = [
            `temp ${weather.temperature}°C`,
            `humidity ${weather.humidity}%`,
            `wind ${weather.windSpeed} km/h`,
            `precip ${weather.precipitation} mm`,
          ];
          if (weather.uvIndex != null) wbits.push(`UV ${weather.uvIndex}`);

          const forecastDays = (weather.forecast ?? [])
            .slice(0, 5)
            .map(
              (f) =>
                `${new Date(f.date).toISOString().slice(0, 10)}: high ${f.tempHigh}°C / low ${f.tempLow}°C, ${f.precipitation} mm, ${f.condition}`
            );
          farmLines.push(`  Weather (cached): ${wbits.join(", ")}`);
          if (forecastDays.length) farmLines.push(`  Forecast: ${forecastDays.join(" | ")}`);
        } else {
          farmLines.push("  Weather: no cached forecast available for this location");
        }
      } catch {
        farmLines.push("  Weather: unavailable");
      }
    }

    // ── Irrigation schedules ───────────────────────────────────
    try {
      const schedules = await ctx.runQuery(api.irrigation.listMySchedules, {
        farmId: farm._id,
      });
      const active = schedules.filter((s: any) => s.isActive);
      if (active.length > 0) {
        const schedBits = active.slice(0, 4).map((s: any) => {
          const nextRun = s.nextRunAt
            ? `next run ${new Date(s.nextRunAt).toISOString().slice(0, 10)}`
            : "no upcoming run";
          return `"${s.name}" (${s.method}, ${s.waterAmount}L every ${s.frequency}, ${nextRun})`;
        });
        farmLines.push(`  Irrigation: ${active.length} active schedules — ${schedBits.join("; ")}`);
      } else {
        farmLines.push("  Irrigation: no active schedules");
      }
    } catch {
      // Irrigation data unavailable
    }

    // ── Farm health score ──────────────────────────────────────
    try {
      const health = await ctx.runQuery(api.intelligence.getFarmHealthScore, {
        farmId: farm._id,
      });
      if (health && health.overall != null) {
        const hBits = [`overall ${health.overall}/100`];
        if (health.cropHealth != null) hBits.push(`crops ${Math.round(health.cropHealth)}/100`);
        if (health.livestockHealth != null) hBits.push(`livestock ${Math.round(health.livestockHealth)}/100`);
        if (health.weatherRisk != null) hBits.push(`weather risk ${health.weatherRisk}/100`);
        if (health.vaccinationRate != null) hBits.push(`vaccination ${health.vaccinationRate}%`);
        farmLines.push(`  Farm health: ${hBits.join(", ")}`);
      }
    } catch {
      // Health score unavailable
    }

    parts.push(farmLines.join("\n"));
  }

  if (farms.length > 3) {
    parts.push(`(${farms.length - 3} more farms not detailed)`);
  }

  // ── Financial summary ────────────────────────────────────────
  try {
    const fin = await ctx.runQuery(api.transactions.getFinancialSummary, {});
    const cur = user?.currency ?? "KES";
    const fBits: string[] = [];
    fBits.push(`total income ${Math.round(fin.totalIncome)}`);
    fBits.push(`total expenses ${Math.round(fin.totalExpenses)}`);
    fBits.push(`net profit ${Math.round(fin.netProfit)}`);
    if (fin.totalIncome > 0) {
      const margin = Math.round(((fin.totalIncome - fin.totalExpenses) / fin.totalIncome) * 100);
      fBits.push(`margin ${margin}%`);
    }
    fBits.push(`this month: income ${Math.round(fin.thisMonthIncome)}, expenses ${Math.round(fin.thisMonthExpenses)}, profit ${Math.round(fin.thisMonthProfit)}`);
    parts.push(`Finances (${cur}): ${fBits.join(", ")}`);
  } catch {
    // Financial data unavailable
  }

  // ── Market reference prices ──────────────────────────────────
  try {
    const market = await ctx.runQuery(api.marketIntelligence.getMarketPrices, {});
    if (Array.isArray(market) && market.length > 0) {
      const priceBits = market.slice(0, 6).map((p: any) => {
        const bits = [`${p.crop}: ${p.currentPrice} ${p.currency}/${p.unit}`, `trend: ${p.trend}`];
        return bits.join(", ");
      });
      parts.push(`Market (reference data, NOT live prices): ${priceBits.join(" | ")}`);
    }
  } catch {
    // Market data unavailable
  }

  return parts.join("\n");
}

/**
 * Send a message to the AI farming assistant via Groq
 * Free tier: 14,400 requests/day (llama-3.1-8b-instant)
 * or 1,000 requests/day (llama-3.3-70b-versatile)
 */
export const chatWithAI = action({
  args: {
    message: v.string(),
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("model")),
          parts: v.array(v.object({ text: v.string() })),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const quota = await enforceChatQuota(ctx);
    const text = await runChatCompletion(SYSTEM_PROMPT, args.message, args.history);
    await logChatUsage(ctx, quota.userId);
    return { response: text };
  },
});

/**
 * Farm-aware chat: injects the farmer's REAL FarmBond context (farms,
 * crops, livestock, weather, irrigation, soil, finances, market prices,
 * farm health) into the system prompt so the assistant can answer
 * farm-specific questions using actual data — and honestly state when
 * data is missing.
 *
 * All data is fetched server-side through auth-guarded queries scoped to
 * the authenticated user, so one farmer can never see another farmer's data.
 */
export const chatWithFarmContext = action({
  args: {
    message: v.string(),
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("model")),
          parts: v.array(v.object({ text: v.string() })),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const quota = await enforceChatQuota(ctx);

    const farmContext = await buildFarmContext(ctx);

    const systemPrompt = `${SYSTEM_PROMPT}

===== THE FARMER'S CURRENT FARMBOND DATA =====
${farmContext}

===== CRITICAL RULES =====
1. The data above is REAL. Use it when answering farm-specific questions.
2. NEVER invent farm statistics, weather, prices, yields, health scores, or financial figures.
3. If data needed is missing, say so explicitly (e.g. "I don't have recorded data for that yet").
4. Always distinguish actual FarmBond data (reference "Your data shows..." or "Based on your FarmBond data...") from general recommendations ("Based on general agricultural practice...").
5. For disease or health questions: give general guidance but do NOT claim a definitive diagnosis. Recommend a local agronomist or veterinarian.
6. Weather is labeled "(cached)" — it is the last cached forecast, not a live reading.
7. Market prices are labeled "reference data" — they are benchmarks, not live exchange data.
8. Respect the farmer's currency, units, language, and timezone preferences stated in their profile.
9. When giving financial advice, use the farmer's display currency shown in the Finances line.`;

    const text = await runChatCompletion(systemPrompt, args.message, args.history);
    await logChatUsage(ctx, quota.userId);
    return { response: text };
  },
});

/**
 * Gemini fallback for text chat (when Groq is unavailable)
 */
async function chatWithGeminiFallback(
  message: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemPrompt: string = SYSTEM_PROMPT,
) {
  if (!GEMINI_API_KEY) {
    throw new Error("No AI provider available");
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (!history || history.length === 0) {
    contents.push({
      role: "user",
      parts: [{ text: `System instruction: ${systemPrompt}\n\nUser question: ${message}` }],
    });
  } else {
    contents.push({
      role: "user",
      parts: [{ text: `System instruction: ${systemPrompt}\n\n${history[0]?.parts[0]?.text || message}` }],
    });
    for (let i = 1; i < history.length; i++) {
      contents.push(history[i]);
    }
    contents.push({ role: "user", parts: [{ text: message }] });
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048 },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    }),
  });

  if (!response.ok) throw new Error("Fallback AI error");
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from fallback AI");
  return { response: text };
}

/**
 * Detect plant disease from image (multimodal — uses Gemini)
 * Groq doesn't support image analysis, so Gemini is used for vision tasks
 */
export const detectDisease = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(),
    additionalInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!GEMINI_API_KEY) {
      throw new Error(
        "Image analysis requires Google Gemini. Please add GOOGLE_GEMINI_API_KEY to your environment variables. " +
        "Get a free key at https://aistudio.google.com/apikey — 1,500 requests/day free."
      );
    }

    // Auth + daily usage quota (image analysis is more expensive — tighter
    // free allowance). Enforced server-side.
    const quota = await getAiQuota(ctx, "ai_disease");
    const used = await ctx.runQuery(internal.aiAssistant.getAiUsageCount, {
      userId: quota.userId,
      usageAction: "ai_disease",
    });
    if (used >= quota.limit) {
      throw new Error(
        quota.isPro
          ? "Daily image analysis limit reached. Please try again tomorrow."
          : `Free plan allows ${AI_FREE_DAILY_DETECT_LIMIT} image analyses per day. Upgrade to Pro for more — Settings > Subscription.`
      );
    }

    const prompt = `You are an expert plant pathologist. Analyze this image of a plant/leaf/crop and identify any diseases, pests, or health issues.

Respond with ONLY a single valid JSON object — no markdown, no code fences, no commentary. Use exactly this schema:
{
  "type": "disease" | "pest",
  "name": "short disease or pest name, or \"No issue detected\" when the plant looks healthy",
  "confidence": 0-100 numeric integer, or null when the image is unclear,
  "severity": "low" | "medium" | "high" | "critical",
  "description": "brief plain-text explanation",
  "symptoms": ["symptom", "..."],
  "causes": ["cause", "..."],
  "recommendations": ["action", "..."],
  "organicTreatments": ["organic treatment", "..."],
  "chemicalTreatments": ["chemical treatment", "..."],
  "prevention": ["prevention tip", "..."],
  "affectedCrops": ["crop", "..."]
}

Rules:
- severity must be one of the lowercase values "low", "medium", "high", "critical".
- confidence must be a number between 0 and 100, or null when the image is unclear.
- If the image is unclear or no disease is identifiable, set name to "No issue detected", severity to "low", and provide general plant health tips in recommendations.

${args.additionalInfo ? `Additional context from farmer: ${args.additionalInfo}` : ""}`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mimeType: args.mimeType,
                    data: args.imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1500,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        throw new Error("AI analysis failed");
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("No analysis generated");
      }

      // Record usage only after a successful analysis
      await ctx.runMutation(internal.aiAssistant.logAiUsage, {
        userId: quota.userId,
        usageAction: "ai_disease",
        feature: "disease_detection",
      });

      return { analysis: text };
    } catch (error) {
      console.error("Disease detection error:", error);
      throw error;
    }
  },
});
