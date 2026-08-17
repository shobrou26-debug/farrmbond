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
    // Phase 7: the by_user_action composite index narrows to (user, action)
    // before the createdAt window filter — the previous by_user query walked
    // the user's entire audit history on every AI call.
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

const SYSTEM_PROMPT = `You are FarmBond AI, an expert agricultural assistant powered by advanced AI. You help farmers worldwide increase productivity, reduce losses, and maximize profits.

CORE EXPERTISE:
- Crop management (planting, growing, harvesting, storage)
- Pest and disease identification and treatment
- Soil health and fertility management
- Weather-based farming decisions
- Irrigation and water management
- Livestock health and management
- Market prices and selling strategies
- Farm budgeting and financial planning
- Sustainable and organic farming practices
- Climate-smart agriculture
- Post-harvest handling and value addition

RESPONSE GUIDELINES:
1. Be specific and actionable - give concrete steps, not vague advice
2. Consider the farmer's location and climate when possible
3. Recommend both conventional and organic/low-cost solutions
4. Include prevention strategies, not just treatment
5. Mention specific products, dosages, and timing when relevant
6. Use clear formatting with bullet points and sections
7. Be encouraging and supportive
8. If you don't know something specific, say so honestly
9. Always remind farmers to consult local agricultural extension officers for region-specific advice
10. Support multiple languages - respond in the language the user writes in

FORMAT YOUR RESPONSES WITH:
- **Bold headers** for sections
- Bullet points for lists
- Specific numbers (days, amounts, percentages)
- Emoji sparingly for visual clarity (🌱 🐛 🌤️ 💰 🐄)

Keep responses concise but comprehensive. Aim for 150-400 words unless the question requires more detail.`;

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

/**
 * Build a concise, real FarmBond context block for the authenticated farmer.
 * Only includes data that actually exists (farms, crops, livestock, cached
 * weather, financial summary). When something is missing it is omitted or
 * explicitly marked unavailable — never fabricated.
 */
async function buildFarmContext(ctx: ActionCtx): Promise<string> {
  const parts: string[] = [];

  // Farmer profile — preferences the AI should respect in answers
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

  // Farms (all of them, capped for prompt size)
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

    const soilBits: string[] = [];
    if (farm.soilType) soilBits.push(`type: ${farm.soilType}`);
    if (farm.soilPh != null) soilBits.push(`pH: ${farm.soilPh}`);
    if (farm.ndviScore != null) soilBits.push(`NDVI: ${farm.ndviScore}/100`);
    if (farm.irrigationType) soilBits.push(`irrigation: ${farm.irrigationType}`);
    if (soilBits.length) farmLines.push(`  Soil: ${soilBits.join(", ")}`);

    // Crops on this farm
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
    }

    // Livestock on this farm
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
    }

    // Cached weather for the farm location (real data only; null when unavailable)
    if (loc?.latitude != null && loc?.longitude != null) {
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
          .slice(0, 3)
          .map(
            (f) =>
              `${new Date(f.date).toISOString().slice(0, 10)}: high ${f.tempHigh}°C / low ${f.tempLow}°C, ${f.precipitation} mm, ${f.condition}`
          );
        farmLines.push(`  Weather (cached): ${wbits.join(", ")}`);
        if (forecastDays.length) farmLines.push(`  Forecast (next days): ${forecastDays.join(" | ")}`);
      } else {
        farmLines.push("  Weather: no cached forecast available for this location");
      }
    }

    parts.push(farmLines.join("\n"));
  }

  if (farms.length > 3) {
    parts.push(`(${farms.length - 3} more farms not detailed)`);
  }

  // Financial summary — already converted to the user's display currency by
  // the backend; labeled with the user's currency code.
  try {
    const fin = await ctx.runQuery(api.transactions.getFinancialSummary, {});
    const cur = user?.currency ?? "KES";
    parts.push(
      `Finances (${cur}): total income ${Math.round(fin.totalIncome)}, total expenses ${Math.round(fin.totalExpenses)}, net profit ${Math.round(fin.netProfit)}; this month income ${Math.round(fin.thisMonthIncome)}, expenses ${Math.round(fin.thisMonthExpenses)}, profit ${Math.round(fin.thisMonthProfit)}`
    );
  } catch {
    // Financial data unavailable — omit rather than fabricate
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
 * Farm-aware chat: same as `chatWithAI` but injects the farmer's REAL
 * FarmBond context (farms, crops, livestock, cached weather, finances) into
 * the system prompt so the assistant can answer farm-specific questions
 * using actual data — and honestly state when data is missing.
 *
 * All data is fetched server-side through auth-guarded queries scoped to the
 * authenticated user, so one farmer can never see another farmer's data.
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

===== THE FARMER'S CURRENT FARMBOND DATA (real data from their FarmBond account) =====
${farmContext}

===== DATA HONESTY RULES (mandatory) =====
- The FarmBond data above is the ONLY farm-specific data you have. Use it when answering farm-specific questions.
- NEVER invent farm statistics, weather, prices, yields, health scores, or financial figures. If the data needed to answer is missing, say so explicitly (e.g. "I don't have recorded data for that yet").
- Always distinguish actual data (from the section above) from general agricultural recommendations.
- For plant or livestock disease questions, provide general guidance but do not claim a definitive diagnosis; recommend consulting a local agronomist or extension officer.
- Present weather and measurements in the farmer's preferred units when the profile includes a units preference; otherwise use the units shown in the data.`;

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

    // The client parses the response as JSON (see DiseaseDetection.tsx), so the
    // model MUST return strict JSON — never markdown. Severity is a lowercase
    // enum and confidence is numeric so the UI never renders "High%" or
    // invents a risk level from a missing field.
    const prompt = `You are an expert plant pathologist. Analyze this image of a plant/leaf/crop and identify any diseases, pests, or health issues.

Respond with ONLY a single valid JSON object — no markdown, no code fences, no commentary. Use exactly this schema:
{
  "type": "disease" | "pest",
  "name": "short disease or pest name, or "No issue detected" when the plant looks healthy",
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
