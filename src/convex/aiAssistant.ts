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

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ============================================================
// AI usage limits (per-user, per-day)
// ============================================================

const AI_FREE_DAILY_CHAT_LIMIT = 5;
const AI_PRO_DAILY_CHAT_LIMIT = 500;
const AI_FREE_DAILY_DETECT_LIMIT = 3;
const AI_PRO_DAILY_DETECT_LIMIT = 100;

/** Pure limit selector (exported for tests) */
export function getAiDailyLimit(
  isPro: boolean,
  usageAction: "ai_chat" | "ai_disease"
): number {
  if (usageAction === "ai_chat") {
    return isPro ? AI_PRO_DAILY_CHAT_LIMIT : AI_FREE_DAILY_CHAT_LIMIT;
  }
  return isPro ? AI_PRO_DAILY_DETECT_LIMIT : AI_FREE_DAILY_DETECT_LIMIT;
}

export const getAiUsageCount = internalQuery({
  args: { userId: v.id("users"), usageAction: v.string() },
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

export const logAiUsage = internalMutation({
  args: { userId: v.id("users"), usageAction: v.string(), feature: v.string() },
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
// System prompt — flexible, domain-aware, honest
// ============================================================

const SYSTEM_PROMPT = `You are FarmBond AI, a professional agricultural intelligence assistant. You help farmers make informed, data-driven decisions using their actual FarmBond account data.

═══════════════════════════════════════════════════════════════
IDENTITY
═══════════════════════════════════════════════════════════════
You are a knowledgeable, practical farming advisor. You combine general agricultural science with the farmer's real FarmBond data to give personalized, actionable guidance. You are encouraging but honest.

═══════════════════════════════════════════════════════════════
DATA SOURCES PROVIDED BELOW
═══════════════════════════════════════════════════════════════
The farmer's FarmBond account may provide:
• Farms: name, location, size, soil type, pH, NDVI, irrigation type
• Crops: name, variety, planting date, status, health score, harvest date
• Livestock: type, quantity, status, health score, vaccination schedule
• Weather: current conditions + multi-day forecast (labeled "cached")
• Soil: pH, organic matter, NPK, moisture, drainage, texture, fertility
• Irrigation: active schedules, water amounts, methods, next runs
• Finances: total income, expenses, profit, margin (in display currency)
• Market: reference prices for their crops (NOT live exchange data)
• Health: overall farm health score and component scores

ALL DATA BELOW IS REAL — from the farmer's FarmBond account. Use it directly.

═══════════════════════════════════════════════════════════════
HOW TO RESPOND — ADAPT TO THE QUESTION
═══════════════════════════════════════════════════════════════

**Simple questions** (e.g., "What's the weather?", "Is rain expected?"):
→ Give a direct, concise answer. No framework needed. 2-4 sentences.

**Farm overview questions** (e.g., "How is my farm doing?", "Give me a summary"):
→ Use this structure:
  1. **Overview** — summarize key numbers from the data
  2. **What's going well** — highlight positive indicators
  3. **Needs attention** — flag concerns or missing data
  4. **Top actions** — 2-3 specific next steps

**Advisory questions** (e.g., "Should I irrigate?", "What should I plant?"):
→ Use this structure:
  1. **What your data shows** — cite the relevant FarmBond data
  2. **What it means** — interpret the data
  3. **What to do** — specific, actionable recommendations with timing
  4. **What's missing** — any data gaps that would improve the advice

**Planning questions** (e.g., "What should I do this week?", "Prioritize my tasks"):
→ Create a prioritized action list:
  1. **Urgent** — must do now (risks, deadlines)
  2. **Important** — this week (crop management, livestock care)
  3. **Beneficial** — when time allows (improvements, planning)
→ Each item: what to do + why + when

**Financial questions** (e.g., "Am I making money?", "How are my expenses?"):
→ Use actual financial data from the context. Show:
  - Income vs expenses
  - Profit margin
  - This month vs overall
  - Suggestions for improvement

**Disease/health questions** (e.g., "My chicken look sick", "Brown spots on leaves"):
→ Provide general guidance based on described symptoms.
→ NEVER claim a definitive diagnosis.
→ ALWAYS recommend consulting a local agronomist or veterinarian.

═══════════════════════════════════════════════════════════════
HONESTY RULES (mandatory — never break these)
═══════════════════════════════════════════════════════════════
• NEVER invent crop yields, farm statistics, prices, weather, soil values, livestock counts, health scores, financial figures, or vaccination dates.
• When data is missing, say: "I don't have that data in your FarmBond account yet. You can record it in [relevant section] to get better advice."
• Always label the source of your statements:
  - "Your data shows..." or "Based on your FarmBond data..." (real data)
  - "Based on general agricultural practice..." (general knowledge)
  - "This data is not available in your FarmBond account." (missing)
• Market prices are reference benchmarks, NOT live market data. Never present them as current exchange prices.
• Weather is cached — not a live reading.
• For disease/health questions: general guidance only. Never diagnose definitively. Always recommend a qualified expert.

═══════════════════════════════════════════════════════════════
CURRENCY, UNITS, AND LOCALIZATION
═══════════════════════════════════════════════════════════════
• Use the farmer's display currency (shown in their profile or Finances line) for all financial amounts.
• Respect the farmer's unit preference (metric/imperial). Convert weather data if needed.
• Respond in the farmer's language preference if stated; otherwise respond in the language they write in.
• Consider their country and climate zone for seasonal and planting advice.

═══════════════════════════════════════════════════════════════
RECOMMENDATION PRIORITIES (when ranking actions)
═══════════════════════════════════════════════════════════════
1. Urgent risks — livestock health, extreme weather, overdue critical tasks
2. Time-sensitive opportunities — planting windows, harvest timing, market selling
3. Crop management — fertilization, pest control, irrigation optimization
4. Financial optimization — expense reduction, revenue improvement
5. Long-term planning — soil health, infrastructure, diversification

═══════════════════════════════════════════════════════════════
RESPONSE STYLE
═══════════════════════════════════════════════════════════════
• Use **bold** for section headers
• Use • bullet points for lists
• Use numbered steps (1. 2. 3.) for sequential actions
• Be specific: include days, amounts, percentages when available
• Be practical: give concrete steps, not vague advice
• Be encouraging but honest about risks
• Use emoji sparingly for visual clarity (🌱 🐛 🌤️ 💰 🐄)
• Keep responses proportional: short for simple questions, detailed for complex ones
• Aim for clarity over length — a farmer reading on a phone needs concise answers`;

/**
 * Build Groq/OpenAI-compatible messages array from conversation history.
 */
function buildGroqMessages(
  history: Array<{ role: string; parts: Array<{ text: string }> }> | undefined,
  currentMessage: string,
  systemPrompt: string = SYSTEM_PROMPT,
) {
  const messages: Array<{ role: string; content: string }> = [];
  messages.push({ role: "system", content: systemPrompt });

  if (!history || history.length === 0) {
    messages.push({ role: "user", content: currentMessage });
  } else {
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      const text = msg.parts?.map((p) => p.text).join("\n") || "";
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

async function logChatUsage(ctx: ActionCtx, userId: any) {
  await ctx.runMutation(internal.aiAssistant.logAiUsage, {
    userId,
    usageAction: "ai_chat",
    feature: "chat",
  });
}

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
    }
  }

  if (GEMINI_API_KEY) {
    const result = await chatWithGeminiFallback(message, history, systemPrompt);
    return result.response;
  }

  throw new Error("AI service is not configured.");
}

// ============================================================
// Farm context builder
// ============================================================

function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "—";
  return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
}

/** Calculate days between two timestamps, returning a human-readable string. */
function daysBetween(from: number, to: number): string {
  const days = Math.round((to - from) / (24 * 60 * 60 * 1000));
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return "today";
  return `in ${days} days`;
}

/**
 * Build a comprehensive, real FarmBond context block for the authenticated
 * farmer. Every query is auth-scoped. Missing data is omitted or labeled
 * unavailable — never fabricated.
 */
async function buildFarmContext(ctx: ActionCtx): Promise<string> {
  const parts: string[] = [];
  const now = Date.now();
  const today = new Date(now);

  // ── Date / season context ────────────────────────────────────
  const month = today.toLocaleString("en", { month: "long" });
  const hemisphere = today.getMonth() >= 3 && today.getMonth() <= 9 ? "northern" : "southern";
  parts.push(
    `Current date: ${today.toISOString().slice(0, 10)} (${today.toLocaleString("en", { weekday: "long" })}, ${month}, ${hemisphere} hemisphere)`
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

    // Detailed soil analysis
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
          farmLines.push(`  Soil advice: ${soil.recommendations.slice(0, 3).join("; ")}`);
        }
      }
    } catch {
      // Soil data unavailable
    }

    // Crops — include planting age in days
    const cropsRes = await ctx.runQuery(api.crops.listFarmCrops, { farmId: farm._id });
    const crops = cropsRes?.page ?? [];
    if (crops.length > 0) {
      const cropBits = crops.slice(0, 6).map((c) => {
        const ageDays = Math.round((now - c.plantingDate) / (24 * 60 * 60 * 1000));
        const bits = [
          c.name,
          c.variety ? `(${c.variety})` : "",
          `type: ${c.type}`,
          `planted ${new Date(c.plantingDate).toISOString().slice(0, 10)} (${ageDays}d ago)`,
          `status: ${c.status}`,
        ];
        if (c.healthScore != null) bits.push(`health: ${c.healthScore}/100`);
        if (c.expectedHarvestDate) bits.push(`harvest ${daysBetween(now, c.expectedHarvestDate)}`);
        return bits.filter(Boolean).join(" ");
      });
      farmLines.push(`  Crops (${crops.length}): ${cropBits.join(" | ")}${crops.length > 6 ? ` (+${crops.length - 6} more)` : ""}`);
    } else {
      farmLines.push("  Crops: none on this farm");
    }

    // Livestock — include days until next vaccination
    const livestockRes = await ctx.runQuery(api.livestock.listFarmLivestock, { farmId: farm._id });
    const livestock = livestockRes?.page ?? [];
    if (livestock.length > 0) {
      const liveBits = livestock.slice(0, 4).map((l) => {
        const bits = [`${l.quantity} ${l.type}`, `status: ${l.status}`];
        if (l.healthScore != null) bits.push(`health: ${l.healthScore}/100`);
        if (l.nextVaccination) {
          const vaccDays = Math.round((l.nextVaccination - now) / (24 * 60 * 60 * 1000));
          bits.push(`vaccination ${vaccDays <= 0 ? `OVERDUE by ${Math.abs(vaccDays)}d` : `in ${vaccDays}d`}`);
        }
        return bits.join(", ");
      });
      farmLines.push(`  Livestock (${livestock.length}): ${liveBits.join(" | ")}${livestock.length > 4 ? ` (+${livestock.length - 4} more)` : ""}`);
    } else {
      farmLines.push("  Livestock: none on this farm");
    }

    // Weather
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
                `${new Date(f.date).toISOString().slice(0, 10)}: ${f.tempHigh}/${f.tempLow}°C, ${f.precipitation}mm, ${f.condition}`
            );
          farmLines.push(`  Weather (cached): ${wbits.join(", ")}`);
          if (forecastDays.length) farmLines.push(`  Forecast: ${forecastDays.join(" | ")}`);
        } else {
          farmLines.push("  Weather: no cached forecast for this location");
        }
      } catch {
        farmLines.push("  Weather: unavailable");
      }
    }

    // Irrigation schedules
    try {
      const schedules = await ctx.runQuery(api.irrigation.listMySchedules, { farmId: farm._id });
      const active = schedules.filter((s: any) => s.isActive);
      if (active.length > 0) {
        const schedBits = active.slice(0, 4).map((s: any) => {
          const nextRun = s.nextRunAt ? daysBetween(now, s.nextRunAt) : "no upcoming run";
          return `"${s.name}" (${s.method ?? "unspecified method"}, ${s.waterAmount}L, ${s.frequency}, next: ${nextRun})`;
        });
        farmLines.push(`  Irrigation (${active.length} active): ${schedBits.join("; ")}`);
      } else {
        farmLines.push("  Irrigation: no active schedules");
      }
    } catch {
      // unavailable
    }

    // Farm health score
    try {
      const health = await ctx.runQuery(api.intelligence.getFarmHealthScore, { farmId: farm._id });
      if (health && health.overall != null) {
        const hBits = [`overall ${health.overall}/100`];
        if (health.cropHealth != null) hBits.push(`crops ${Math.round(health.cropHealth)}/100`);
        if (health.livestockHealth != null) hBits.push(`livestock ${Math.round(health.livestockHealth)}/100`);
        if (health.soilHealth != null) hBits.push(`soil ${Math.round(health.soilHealth)}/100`);
        if (health.weatherRisk != null) hBits.push(`weather risk ${health.weatherRisk}/100`);
        if (health.financialHealth != null) hBits.push(`financial ${Math.round(health.financialHealth)}/100`);
        if (health.vaccinationRate != null) hBits.push(`vaccination ${health.vaccinationRate}%`);
        farmLines.push(`  Health score: ${hBits.join(", ")}`);
      }
    } catch {
      // unavailable
    }

    parts.push(farmLines.join("\n"));
  }

  if (farms.length > 3) {
    parts.push(`(${farms.length - 3} more farms not detailed)`);
  }

  // Financial summary
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
    // unavailable
  }

  // Market reference prices
  try {
    const market = await ctx.runQuery(api.marketIntelligence.getMarketPrices, {});
    if (Array.isArray(market) && market.length > 0) {
      const priceBits = market.slice(0, 6).map((p: any) => {
        return `${p.crop}: ${p.currentPrice} ${p.currency}/${p.unit} (${p.trend})`;
      });
      parts.push(`Market (reference benchmarks — NOT live prices): ${priceBits.join(" | ")}`);
    }
  } catch {
    // unavailable
  }

  return parts.join("\n");
}

// ============================================================
// Exported actions
// ============================================================

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
1. The data above is REAL. Use it directly when answering.
2. NEVER invent farm statistics, weather, prices, yields, health scores, or financial figures.
3. If needed data is missing, say: "I don't have that data in your FarmBond account yet."
4. Distinguish FarmBond data ("Your data shows...") from general knowledge ("Based on general agricultural practice...").
5. Disease/health questions: general guidance only. Never diagnose. Recommend a local expert.
6. Weather is cached — not live. Market prices are reference benchmarks — not live.
7. Respect the farmer's currency, units, language, and timezone preferences.
8. Financial advice uses the display currency shown in the Finances line.
9. Adapt your response to the question: concise for simple questions, structured for complex ones.`;

    const text = await runChatCompletion(systemPrompt, args.message, args.history);
    await logChatUsage(ctx, quota.userId);
    return { response: text };
  },
});

// ============================================================
// Gemini fallback
// ============================================================

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

// ============================================================
// Disease detection (Gemini multimodal)
// ============================================================

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
