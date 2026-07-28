import { action } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// AI Farming Assistant - Powered by Google Gemini
// Free tier: 1,500 requests/day, multimodal support
// ============================================================

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
 * Send a message to the AI farming assistant
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
    if (!GEMINI_API_KEY) {
      throw new Error("AI service is not configured. Please add GOOGLE_GEMINI_API_KEY to your environment variables.");
    }

    // Build conversation history
    const contents = [];

    // Add system instruction as first user message if no history
    if (!args.history || args.history.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: `System instruction: ${SYSTEM_PROMPT}\n\nUser question: ${args.message}` }],
      });
    } else {
      // Add system context to first message
      contents.push({
        role: "user",
        parts: [{ text: `System instruction: ${SYSTEM_PROMPT}\n\n${args.history[0]?.parts[0]?.text || args.message}` }],
      });
      // Add rest of history
      for (let i = 1; i < args.history.length; i++) {
        contents.push(args.history[i]);
      }
      // Add current message
      contents.push({
        role: "user",
        parts: [{ text: args.message }],
      });
    }

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);
        throw new Error(`AI service error: ${response.status}`);
      }

      const data = await response.json();

      // Extract text from Gemini response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("No response generated from AI");
      }

      return { response: text };
    } catch (error) {
      console.error("AI chat error:", error);
      throw error;
    }
  },
});

/**
 * Detect plant disease from image (multimodal)
 */
export const detectDisease = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(),
    additionalInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!GEMINI_API_KEY) {
      throw new Error("AI service is not configured.");
    }

    const prompt = `You are an expert plant pathologist. Analyze this image of a plant/leaf/crop and identify any diseases, pests, or health issues.

Provide your analysis in this format:
**Diagnosis:** [Primary disease/pest identified]
**Confidence:** [High/Medium/Low]
**Severity:** [Low/Medium/High/Critical]

**Description:** Brief explanation of what you see

**Treatment:**
• [Treatment step 1]
• [Treatment step 2]
• [Treatment step 3]

**Prevention:**
• [Prevention tip 1]
• [Prevention tip 2]

**Immediate Actions:**
• [What to do right now]

If the image is unclear or you cannot identify a specific disease, provide general plant health assessment tips and ask for a clearer image.

${args.additionalInfo ? `Additional context from farmer: ${args.additionalInfo}` : ""}`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      return { analysis: text };
    } catch (error) {
      console.error("Disease detection error:", error);
      throw error;
    }
  },
});
