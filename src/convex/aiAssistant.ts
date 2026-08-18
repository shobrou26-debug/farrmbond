import { action, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { createAuditLog, isSubscriptionActive } from "./authHelpers";

// ============================================================
// AI Farming Assistant
// Primary: Groq | Fallback: Gemini
// ============================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ============================================================
// Quota
// ============================================================

const AI_FREE_DAILY_CHAT_LIMIT = 5;
const AI_PRO_DAILY_CHAT_LIMIT = 500;
const AI_FREE_DAILY_DETECT_LIMIT = 3;
const AI_PRO_DAILY_DETECT_LIMIT = 100;

export function getAiDailyLimit(isPro: boolean, usageAction: "ai_chat" | "ai_disease"): number {
  if (usageAction === "ai_chat") return isPro ? AI_PRO_DAILY_CHAT_LIMIT : AI_FREE_DAILY_CHAT_LIMIT;
  return isPro ? AI_PRO_DAILY_DETECT_LIMIT : AI_FREE_DAILY_DETECT_LIMIT;
}

export const getAiUsageCount = internalQuery({
  args: { userId: v.id("users"), usageAction: v.string() },
  handler: async (ctx, args) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_user_action", (q) => q.eq("userId", args.userId).eq("action", args.usageAction))
      .filter((q) => q.gte(q.field("createdAt"), startOfDay.getTime()))
      .collect();
    return rows.length;
  },
});

export const logAiUsage = internalMutation({
  args: { userId: v.id("users"), usageAction: v.string(), feature: v.string() },
  handler: async (ctx, args) => {
    await createAuditLog(ctx, { userId: args.userId, action: args.usageAction, resource: "ai_assistant", resourceId: args.userId, changes: { feature: args.feature } });
  },
});

async function getAiQuota(ctx: any, usageAction: "ai_chat" | "ai_disease"): Promise<{ userId: any; limit: number; isPro: boolean }> {
  const user = await ctx.runQuery(api.users.currentUser);
  if (!user) throw new Error("Authentication required");
  const isPro = user.subscriptionTier === "pro" && isSubscriptionActive(user);
  return { userId: user._id, limit: getAiDailyLimit(isPro, usageAction), isPro };
}

// ============================================================
// System prompt — Farm Management Advisor
// ============================================================

const SYSTEM_PROMPT = `You are FarmBond AI, a professional farm management advisor. You help farmers make data-driven decisions using their actual FarmBond account data.

═══════════════════════════════════════════════════════════════
IDENTITY
═══════════════════════════════════════════════════════════════
You are a knowledgeable, practical farming advisor. You combine general agricultural science with the farmer's real FarmBond data to give personalized, actionable guidance. You think like a farm manager — prioritizing what matters most, right now.

═══════════════════════════════════════════════════════════════
ADVISORY FRAMEWORK
═══════════════════════════════════════════════════════════════
When answering farm questions, think in these timeframes:

**TODAY** — What needs attention right now?
**THIS WEEK** — What should be planned or started?
**UPCOMING** — What's coming in the next 1-4 weeks?
**RISKS** — What could go wrong? What needs prevention?
**OPPORTUNITIES** — What can be optimized or improved?
**LONG-TERM** — What foundational improvements should be made?

When giving action plans, prioritize by urgency:
1. Critical risks (livestock health, extreme weather, overdue tasks)
2. Time-sensitive actions (planting windows, harvest timing)
3. Crop management (fertilization, pest control, irrigation)
4. Livestock care (vaccinations, health checks, feeding)
5. Financial optimization (expense reduction, revenue improvement)
6. Long-term improvements (soil health, infrastructure)

Normally give 3-5 prioritized recommendations. Do not overwhelm.

═══════════════════════════════════════════════════════════════
DATA SOURCES PROVIDED BELOW
═══════════════════════════════════════════════════════════════
The farmer's FarmBond account provides:
• Current date and season
• Farmer profile (name, country, language, currency, units, timezone)
• Farms: name, location, size, soil type, pH, NDVI, irrigation type
• Crops: name, variety, type, planting date, age in days, status, health score, harvest timing
• Livestock: type, quantity, status, health score, vaccination schedule, overdue status
• Weather: current conditions + multi-day forecast (labeled "cached")
• Soil: pH, organic matter, NPK, moisture, drainage, texture, fertility, recommendations
• Irrigation: active schedules, methods, water amounts, next runs, overdue alerts
• Finances: total income, expenses, profit, margin, this month's figures
• Market: reference prices for their crops (NOT live market data — reference benchmarks)
• Farm health: overall score with crop/livestock/soil/weather/financial components
• Irrigation alerts: overdue schedules, weather conflicts

ALL DATA BELOW IS REAL — from the farmer's FarmBond account. Use it directly.

═══════════════════════════════════════════════════════════════
HOW TO ANSWER — MATCH THE QUESTION TYPE
═══════════════════════════════════════════════════════════════

**"What should I do today?" / "What are my priorities?"**
→ Scan all available data. Give a prioritized daily action list:
  🔴 HIGH — Must do now (risks, overdue tasks, critical weather)
  🟡 IMPORTANT — Should do today or tomorrow
  🟢 OPPORTUNITY — Good to do when time allows
→ Each item: what to do + why + which FarmBond data supports it.
→ If data is missing, say what you'd need to give better advice.

**"Create my weekly plan" / "What should I do this week?"**
→ Give a day-by-day plan (Mon-Fri, Weekend) based on:
  - Weather forecast (if available)
  - Irrigation schedules and next runs
  - Crop stages and timing
  - Livestock vaccination/health schedule
  - Financial activities
→ Only include real activities. If data is missing, note it.

**"How is my farm doing?" / Farm overview**
→ Summarize key numbers from the data:
  1. Overview — headline metrics
  2. What's going well — positive indicators
  3. Needs attention — concerns or missing data
  4. Top actions — 2-3 specific next steps

**"Which crop needs attention?" / Crop prioritization**
→ Rank crops by urgency using:
  - Health score (lower = more urgent)
  - Age relative to expected harvest (overdue = urgent)
  - Weather exposure
  - Soil conditions
→ Return a numbered priority list with reason for each.

**"Should I irrigate?" / Irrigation questions**
→ Consider:
  - Active schedules and next run times
  - Soil moisture (if available)
  - Weather forecast (rain expected?)
  - Crop water needs based on growth stage
→ Distinguish SCHEDULED irrigation from COMPLETED irrigation.
→ Never claim water was applied unless irrigation history confirms it.

**"How is my soil?" / Soil questions**
→ Use actual soil data when available:
  - pH, NPK levels, organic matter, moisture, drainage, texture, fertility
  - Existing soil recommendations
→ When soil data is missing: "I don't have soil data for this farm yet. You can record a soil test in the Soil section."

**"How are my livestock?" / Livestock questions**
→ Use actual livestock records:
  - Health scores, vaccination status, overdue vaccinations
  - Quantity, type, status
→ Clearly distinguish recorded data from general veterinary advice.
→ Never diagnose disease. Always recommend a veterinarian for health concerns.

**"Am I making money?" / Financial questions**
→ Use actual financial data:
  - Income vs expenses
  - Profit margin
  - This month vs overall
  - Trend if visible
→ Respect the farmer's display currency.
→ When data is incomplete: "Your financial records show [X]. To get a fuller picture, you could add more transactions."

**"What market opportunities exist?" / Market questions**
→ Use reference market data (clearly labeled as reference).
→ Never claim: "Today's market price is X"
→ Instead: "FarmBond's reference data shows [crop] at [price] [currency]/[unit] with a [trend] trend."

**"Why is my farm health score low?" / Health explanation**
→ Break down the health score components:
  - Overall score and what contributes to it
  - Which component is dragging the score down
  - What the farmer can do to improve it
→ Only explain components that have data. Don't invent explanations for missing components.

**Disease/health questions**
→ General guidance based on described symptoms.
→ NEVER claim a definitive diagnosis.
→ ALWAYS recommend consulting a local agronomist or veterinarian.

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════
• Use **bold** for section headers
• Use • bullet points for lists
• Use numbered steps for sequential actions
• Use emoji sparingly for visual clarity (🌱 🐛 🌤️ 💰 🐄 🔴 🟡 🟢)
• Keep responses proportional: concise for simple questions, structured for complex ones
• End with "Next step: ..." when appropriate
• Be specific: include days, amounts, percentages from the data
• Be practical: give concrete steps, not vague advice
• Be encouraging but honest about risks

═══════════════════════════════════════════════════════════════
AGRICULTURAL SAFETY
═══════════════════════════════════════════════════════════════
When discussing treatments, always distinguish:
- "possible signs of..." (observation) from "this is..." (diagnosis)
- General educational information from specific recommendations

For pesticides, herbicides, fertilizers:
- Provide general knowledge about options
- Always recommend following local regulations and label instructions
- Never recommend specific chemical concentrations without professional guidance
- Suggest consulting a local agronomist or extension officer for application advice

For livestock medication and veterinary treatment:
- Never prescribe medication or dosage
- Always recommend consulting a qualified veterinarian
- Provide general information about common conditions for educational purposes

For irrigation:
- Provide guidance based on available data
- Never claim water was applied unless irrigation history confirms it
- Distinguish SCHEDULED from COMPLETED irrigation

For extreme weather:
- Provide practical preparation advice when weather data is available
- Recommend protective actions based on forecast severity
- Never minimize severe weather risks

For food safety:
- Provide general best-practice guidance
- Recommend local food safety standards and regulations
- Never claim compliance with specific certifications

═══════════════════════════════════════════════════════════════
HONESTY RULES (mandatory — never break these)
═══════════════════════════════════════════════════════════════
• NEVER invent crop yields, farm statistics, prices, weather, soil values, livestock counts, health scores, financial figures, or vaccination dates.
• When data is missing, say: "I don't have that data in your FarmBond account yet. You can record it in [relevant section] to get better advice."
• Always label the source:
  - "Your data shows..." or "Based on your FarmBond data..." (real data)
  - "Based on general agricultural practice..." (general knowledge)
  - "This data is not available in your FarmBond account." (missing)
• Market prices are reference benchmarks, NOT live market data.
• Weather is cached — not a live reading.
• Irrigation history shows COMPLETED runs. Schedules show PLANNED runs. Never confuse them.
• For disease/health: general guidance only. Never diagnose. Recommend a qualified expert.
• Never claim an action was performed when you only gave advice.

═══════════════════════════════════════════════════════════════
CURRENCY, UNITS, AND LOCALIZATION
═══════════════════════════════════════════════════════════════
• Use the farmer's display currency (shown in their profile or Finances line) for all financial amounts.
• Respect the farmer's unit preference (metric/imperial). Convert weather data if needed.
• Respond in the farmer's language preference if stated; otherwise respond in the language they write in.
• Consider their country and climate zone for seasonal and planting advice.`;

// ============================================================
// Message builder
// ============================================================

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
      messages.push({ role: msg.role === "model" ? "assistant" : "user", content: cleaned });
    }
    messages.push({ role: "user", content: currentMessage });
  }
  return messages;
}

async function enforceChatQuota(ctx: ActionCtx) {
  const quota = await getAiQuota(ctx, "ai_chat");
  const used = await ctx.runQuery(internal.aiAssistant.getAiUsageCount, { userId: quota.userId, usageAction: "ai_chat" });
  if (used >= quota.limit) {
    throw new Error(quota.isPro ? "Daily AI message limit reached. Please try again tomorrow." : `Free plan allows ${AI_FREE_DAILY_CHAT_LIMIT} AI messages per day. Upgrade to Pro for unlimited AI — Settings > Subscription.`);
  }
  return quota;
}

async function logChatUsage(ctx: ActionCtx, userId: any) {
  await ctx.runMutation(internal.aiAssistant.logAiUsage, { userId, usageAction: "ai_chat", feature: "chat" });
}

async function runChatCompletion(systemPrompt: string, message: string, history: Array<{ role: string; parts: Array<{ text: string }> }> | undefined): Promise<string> {
  if (GROQ_API_KEY) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ model: GROQ_MODEL, messages: buildGroqMessages(history, message, systemPrompt), temperature: 0.7, top_p: 0.95, max_tokens: 2048, frequency_penalty: 0.1, presence_penalty: 0.1 }),
      });
      if (!response.ok) { const e = await response.text(); console.error("Groq API error:", response.status, e); throw new Error(`Groq error: ${response.status}`); }
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
// Farm context builder — enriched for advisory use
// ============================================================

function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "—";
  return decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
}

function daysBetween(from: number, to: number): string {
  const days = Math.round((to - from) / (24 * 60 * 60 * 1000));
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return "today";
  return `in ${days} days`;
}

async function buildFarmContext(ctx: ActionCtx): Promise<string> {
  const parts: string[] = [];
  const now = Date.now();
  const today = new Date(now);

  // ── Date / season ────────────────────────────────────────────
  const month = today.toLocaleString("en", { month: "long" });
  const dayOfWeek = today.toLocaleString("en", { weekday: "long" });
  const hemisphere = today.getMonth() >= 3 && today.getMonth() <= 9 ? "northern" : "southern";
  parts.push(`Current date: ${today.toISOString().slice(0, 10)} (${dayOfWeek}, ${month}, ${hemisphere} hemisphere)`);

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
        (loc?.latitude != null && loc?.longitude != null ? ` [lat ${loc.latitude.toFixed(2)}, lon ${loc.longitude.toFixed(2)}]` : ""),
    ];

    // Soil from farm record
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
        if (soil.recommendations?.length) farmLines.push(`  Soil advice: ${soil.recommendations.slice(0, 3).join("; ")}`);
      }
    } catch { /* unavailable */ }

    // Crops — with age, harvest timing, and warnings
    const cropsRes = await ctx.runQuery(api.crops.listFarmCrops, { farmId: farm._id });
    const crops = cropsRes?.page ?? [];
    if (crops.length > 0) {
      const cropBits = crops.slice(0, 6).map((c) => {
        const ageDays = Math.round((now - c.plantingDate) / (24 * 60 * 60 * 1000));
        const bits = [c.name, c.variety ? `(${c.variety})` : "", `type: ${c.type}`, `planted ${new Date(c.plantingDate).toISOString().slice(0, 10)} (${ageDays}d ago)`, `status: ${c.status}`];
        if (c.healthScore != null) bits.push(`health: ${c.healthScore}/100`);
        if (c.expectedHarvestDate) {
          const harvestDays = Math.round((c.expectedHarvestDate - now) / (24 * 60 * 60 * 1000));
          if (harvestDays < 0) bits.push(`harvest OVERDUE by ${Math.abs(harvestDays)}d`);
          else if (harvestDays <= 7) bits.push(`harvest in ${harvestDays}d ⚠️`);
          else bits.push(`harvest ${daysBetween(now, c.expectedHarvestDate)}`);
        }
        return bits.filter(Boolean).join(" ");
      });
      farmLines.push(`  Crops (${crops.length}): ${cropBits.join(" | ")}${crops.length > 6 ? ` (+${crops.length - 6} more)` : ""}`);
    } else {
      farmLines.push("  Crops: none on this farm");
    }

    // Livestock — with overdue vaccination warnings
    const livestockRes = await ctx.runQuery(api.livestock.listFarmLivestock, { farmId: farm._id });
    const livestock = livestockRes?.page ?? [];
    if (livestock.length > 0) {
      const liveBits = livestock.slice(0, 4).map((l) => {
        const bits = [`${l.quantity} ${l.type}`, `status: ${l.status}`];
        if (l.healthScore != null) bits.push(`health: ${l.healthScore}/100`);
        if (l.nextVaccination) {
          const vaccDays = Math.round((l.nextVaccination - now) / (24 * 60 * 60 * 1000));
          if (vaccDays <= 0) bits.push(`vaccination OVERDUE by ${Math.abs(vaccDays)}d 🔴`);
          else if (vaccDays <= 7) bits.push(`vaccination in ${vaccDays}d 🟡`);
          else bits.push(`vaccination in ${vaccDays}d`);
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
        const weather = await ctx.runQuery(api.weather.getCachedWeather, { latitude: loc.latitude, longitude: loc.longitude });
        if (weather) {
          const wbits = [`temp ${weather.temperature}°C`, `humidity ${weather.humidity}%`, `wind ${weather.windSpeed} km/h`, `precip ${weather.precipitation} mm`];
          if (weather.uvIndex != null) wbits.push(`UV ${weather.uvIndex}`);
          const forecastDays = (weather.forecast ?? []).slice(0, 5).map((f) => `${new Date(f.date).toISOString().slice(0, 10)}: ${f.tempHigh}/${f.tempLow}°C, ${f.precipitation}mm, ${f.condition}`);
          farmLines.push(`  Weather (cached): ${wbits.join(", ")}`);
          if (forecastDays.length) farmLines.push(`  Forecast: ${forecastDays.join(" | ")}`);
        } else {
          farmLines.push("  Weather: no cached forecast for this location");
        }
      } catch { farmLines.push("  Weather: unavailable"); }
    }

    // Irrigation schedules + alerts
    try {
      const schedules = await ctx.runQuery(api.irrigation.listMySchedules, { farmId: farm._id });
      const active = schedules.filter((s: any) => s.isActive);
      const overdue = active.filter((s: any) => s.nextRunAt != null && s.nextRunAt < now);
      if (active.length > 0) {
        const schedBits = active.slice(0, 4).map((s: any) => {
          const nextRun = s.nextRunAt ? daysBetween(now, s.nextRunAt) : "no upcoming run";
          return `"${s.name}" (${s.method ?? "unspecified"}, ${s.waterAmount}L, ${s.frequency}, next: ${nextRun})`;
        });
        farmLines.push(`  Irrigation (${active.length} active): ${schedBits.join("; ")}`);
        if (overdue.length > 0) farmLines.push(`  ⚠️ OVERDUE: ${overdue.length} schedule(s) past their next run time`);
      } else {
        farmLines.push("  Irrigation: no active schedules");
      }
    } catch { /* unavailable */ }

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
    } catch { /* unavailable */ }

    parts.push(farmLines.join("\n"));
  }

  if (farms.length > 3) parts.push(`(${farms.length - 3} more farms not detailed)`);

  // Financial summary
  try {
    const fin = await ctx.runQuery(api.transactions.getFinancialSummary, {});
    const cur = user?.currency ?? "KES";
    const fBits: string[] = [`total income ${Math.round(fin.totalIncome)}`, `total expenses ${Math.round(fin.totalExpenses)}`, `net profit ${Math.round(fin.netProfit)}`];
    if (fin.totalIncome > 0) fBits.push(`margin ${Math.round(((fin.totalIncome - fin.totalExpenses) / fin.totalIncome) * 100)}%`);
    fBits.push(`this month: income ${Math.round(fin.thisMonthIncome)}, expenses ${Math.round(fin.thisMonthExpenses)}, profit ${Math.round(fin.thisMonthProfit)}`);
    parts.push(`Finances (${cur}): ${fBits.join(", ")}`);
  } catch { /* unavailable */ }

  // Market reference prices
  try {
    const market = await ctx.runQuery(api.marketIntelligence.getMarketPrices, {});
    if (Array.isArray(market) && market.length > 0) {
      const priceBits = market.slice(0, 6).map((p: any) => `${p.crop}: ${p.currentPrice} ${p.currency}/${p.unit} (${p.trend})`);
      parts.push(`Market (reference benchmarks — NOT live prices): ${priceBits.join(" | ")}`);
    }
  } catch { /* unavailable */ }

  return parts.join("\n");
}

// ============================================================
// Actions
// ============================================================

export const chatWithAI = action({
  args: { message: v.string(), history: v.optional(v.array(v.object({ role: v.union(v.literal("user"), v.literal("model")), parts: v.array(v.object({ text: v.string() })) }))) },
  handler: async (ctx, args) => {
    const quota = await enforceChatQuota(ctx);
    const text = await runChatCompletion(SYSTEM_PROMPT, args.message, args.history);
    await logChatUsage(ctx, quota.userId);
    return { response: text };
  },
});

export const chatWithFarmContext = action({
  args: { message: v.string(), history: v.optional(v.array(v.object({ role: v.union(v.literal("user"), v.literal("model")), parts: v.array(v.object({ text: v.string() })) }))) },
  handler: async (ctx, args) => {
    const quota = await enforceChatQuota(ctx);
    const farmContext = await buildFarmContext(ctx);
    const systemPrompt = `${SYSTEM_PROMPT}\n\n===== THE FARMER'S CURRENT FARMBOND DATA =====\n${farmContext}\n\n===== CRITICAL RULES =====\n1. The data above is REAL. Use it directly when answering.\n2. NEVER invent farm statistics, weather, prices, yields, health scores, or financial figures.\n3. If needed data is missing, say: "I don't have that data in your FarmBond account yet."\n4. Distinguish FarmBond data ("Your data shows...") from general knowledge ("Based on general agricultural practice...").\n5. Disease/health: general guidance only. Never diagnose. Recommend a local expert.\n6. Weather is cached. Market prices are reference benchmarks. Labels in the data indicate this.\n7. Irrigation SCHEDULES show planned runs. OVERDUE flags mean a scheduled run was missed.\n8. Respect the farmer's currency, units, language, and timezone preferences.\n9. Financial advice uses the display currency shown in the Finances line.\n10. Adapt response to the question: concise for simple, structured for complex.`;
    const text = await runChatCompletion(systemPrompt, args.message, args.history);
    await logChatUsage(ctx, quota.userId);
    return { response: text };
  },
});

// ============================================================
// Gemini fallback
// ============================================================

async function chatWithGeminiFallback(message: string, history?: Array<{ role: string; parts: Array<{ text: string }> }>, systemPrompt: string = SYSTEM_PROMPT) {
  if (!GEMINI_API_KEY) throw new Error("No AI provider available");
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (!history || history.length === 0) {
    contents.push({ role: "user", parts: [{ text: `System instruction: ${systemPrompt}\n\nUser question: ${message}` }] });
  } else {
    contents.push({ role: "user", parts: [{ text: `System instruction: ${systemPrompt}\n\n${history[0]?.parts[0]?.text || message}` }] });
    for (let i = 1; i < history.length; i++) contents.push(history[i]);
    contents.push({ role: "user", parts: [{ text: message }] });
  }
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048 }, safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }] }),
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
  args: { imageBase64: v.string(), mimeType: v.string(), additionalInfo: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!GEMINI_API_KEY) throw new Error("Image analysis requires Google Gemini. Please add GOOGLE_GEMINI_API_KEY to your environment variables. Get a free key at https://aistudio.google.com/apikey — 1,500 requests/day free.");
    const quota = await getAiQuota(ctx, "ai_disease");
    const used = await ctx.runQuery(internal.aiAssistant.getAiUsageCount, { userId: quota.userId, usageAction: "ai_disease" });
    if (used >= quota.limit) throw new Error(quota.isPro ? "Daily image analysis limit reached. Please try again tomorrow." : `Free plan allows ${AI_FREE_DAILY_DETECT_LIMIT} image analyses per day. Upgrade to Pro for more — Settings > Subscription.`);
    const prompt = `You are an expert plant pathologist. Analyze this image of a plant/leaf/crop and identify any diseases, pests, or health issues.\n\nRespond with ONLY a single valid JSON object — no markdown, no code fences, no commentary. Use exactly this schema:\n{\n  "type": "disease" | "pest",\n  "name": "short disease or pest name, or \\"No issue detected\\" when the plant looks healthy",\n  "confidence": 0-100 numeric integer, or null when the image is unclear,\n  "severity": "low" | "medium" | "high" | "critical",\n  "description": "brief plain-text explanation",\n  "symptoms": ["symptom", "..."],\n  "causes": ["cause", "..."],\n  "recommendations": ["action", "..."],\n  "organicTreatments": ["organic treatment", "..."],\n  "chemicalTreatments": ["chemical treatment", "..."],\n  "prevention": ["prevention tip", "..."],\n  "affectedCrops": ["crop", "..."]\n}\n\nRules:\n- severity must be one of the lowercase values "low", "medium", "high", "critical".\n- confidence must be a number between 0 and 100, or null when the image is unclear.\n- If the image is unclear or no disease is identifiable, set name to "No issue detected", severity to "low", and provide general plant health tips in recommendations.\n\n${args.additionalInfo ? `Additional context from farmer: ${args.additionalInfo}` : ""}`;
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mimeType: args.mimeType, data: args.imageBase64 } }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 1500, responseMimeType: "application/json" } }),
      });
      if (!response.ok) throw new Error("AI analysis failed");
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No analysis generated");
      await ctx.runMutation(internal.aiAssistant.logAiUsage, { userId: quota.userId, usageAction: "ai_disease", feature: "disease_detection" });
      return { analysis: text };
    } catch (error) { console.error("Disease detection error:", error); throw error; }
  },
});
