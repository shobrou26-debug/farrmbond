import { action, internalMutation, internalQuery } from "./_generated/server";
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
 * Build Groq/OpenAI-compatible messages array from conversation history
 */
function buildGroqMessages(
  history: Array<{ role: string; parts: Array<{ text: string }> }> | undefined,
  currentMessage: string,
) {
  const messages: Array<{ role: string; content: string }> = [];

  // System instruction
  messages.push({ role: "system", content: SYSTEM_PROMPT });

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
    if (!GROQ_API_KEY) {
      throw new Error(
        "AI service is not configured. Please add GROQ_API_KEY to your environment variables. " +
        "Get a free key at https://console.groq.com — 14,400 requests/day free."
      );
    }

    // Auth + daily usage quota (free users get a limited allowance; Pro is
    // near-unlimited). Enforced server-side — cannot be bypassed from the UI.
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

    const messages = buildGroqMessages(args.history, args.message);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
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

        // If Groq is down, try Gemini as fallback for text
        if (GEMINI_API_KEY) {
          console.log("Falling back to Gemini for text chat...");
          return await chatWithGeminiFallback(args.message, args.history);
        }

        throw new Error(`AI service error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("No response generated from AI");
      }

      // Record usage only after a successful response
      await ctx.runMutation(internal.aiAssistant.logAiUsage, {
        userId: quota.userId,
        usageAction: "ai_chat",
        feature: "chat",
      });

      return { response: text };
    } catch (error) {
      console.error("AI chat error:", error);
      throw error;
    }
  },
});

/**
 * Gemini fallback for text chat (when Groq is unavailable)
 */
async function chatWithGeminiFallback(
  message: string,
  history?: Array<{ role: string; parts: Array<{ text: string }> }>,
) {
  if (!GEMINI_API_KEY) {
    throw new Error("No AI provider available");
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (!history || history.length === 0) {
    contents.push({
      role: "user",
      parts: [{ text: `System instruction: ${SYSTEM_PROMPT}\n\nUser question: ${message}` }],
    });
  } else {
    contents.push({
      role: "user",
      parts: [{ text: `System instruction: ${SYSTEM_PROMPT}\n\n${history[0]?.parts[0]?.text || message}` }],
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
