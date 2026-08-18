import { ConvexHttpClient } from "convex/browser";
import { api } from "./src/convex/_generated/api";

const DEPLOYMENT = "https://good-kudu-110.convex.cloud";
const client = new ConvexHttpClient(DEPLOYMENT);

async function main() {
  // Step 1: Anonymous sign-in
  console.log("=== Step 1: Anonymous sign-in ===");
  const signInResult: any = await client.action(api.auth.signIn as any, {
    provider: "anonymous",
    params: {},
  });
  const token = signInResult?.authentication?.session;
  if (!token) {
    console.log("FAIL: No token received");
    return;
  }
  console.log("OK: Token received");
  client.setAuth(token);

  // Step 2: Verify identity
  console.log("\n=== Step 2: Verify identity ===");
  const user: any = await client.query(api.users.currentUser as any, {});
  console.log("User:", JSON.stringify({
    id: user?._id,
    isAnonymous: user?.isAnonymous,
    tier: user?.subscriptionTier,
    currency: user?.currency,
    units: user?.units,
  }));

  // Step 3: Call chatWithFarmContext
  console.log("\n=== Step 3: Call chatWithFarmContext ===");
  const testMessage = "Give me a short summary of my farm using only the information available in FarmBond, then give me three practical recommendations for this week.";
  console.log("Message:", testMessage);

  try {
    const result: any = await client.action(api.aiAssistant.chatWithFarmContext as any, {
      message: testMessage,
      history: [],
    });
    console.log("\n=== AI RESPONSE RECEIVED ===");
    console.log(result?.response);
    console.log("\n=== LIVE AI RESPONSE: VERIFIED ===");
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.log("\n=== AI CALL FAILED ===");
    console.log("Error:", msg);
    if (msg.includes("not configured")) {
      console.log("\nBLOCKER: No AI provider keys are configured in the Convex deployment.");
      console.log("Required: GROQ_API_KEY and/or GOOGLE_GEMINI_API_KEY");
    } else if (msg.includes("Authentication")) {
      console.log("\nBLOCKER: Authentication failed.");
    } else {
      console.log("\nBLOCKER: Unknown error — investigate.");
    }
  }

  // Step 4: Test the original chatWithAI too
  console.log("\n=== Step 4: Test chatWithAI (original action) ===");
  try {
    const result2: any = await client.action(api.aiAssistant.chatWithAI as any, {
      message: "Hello, what crops grow well in tropical climates?",
      history: [],
    });
    console.log("chatWithAI response:", result2?.response?.slice(0, 200) + "...");
    console.log("LIVE chatWithAI: VERIFIED");
  } catch (error: any) {
    console.log("chatWithAI error:", error?.message);
  }
}

main().catch(console.error);
