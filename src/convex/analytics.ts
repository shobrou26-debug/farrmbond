import { query } from "./_generated/server";
import { requireAuth, requireActiveSubscription, hasRole } from "./authHelpers";
import { ROLES } from "./schema";
import { api } from "./_generated/api";

// ============================================================
// Analytics Dashboard (Phase 4A)
// "Advanced analytics" is a Pro feature. The Analytics page reads ALL of
// its data through this single gated query instead of querying the
// underlying (free) endpoints directly — free/expired users get a clean
// authorization error and no data.
// ============================================================

interface AnalyticsDashboard {
  financial: any;
  monthly: any[];
  farms: any[];
  crops: any[];
  livestock: any[];
}

export const getAnalyticsDashboard = query({
  args: {},
  handler: async (ctx): Promise<AnalyticsDashboard> => {
    const { user } = await requireAuth(ctx);
    // Pro gate (tier + unexpired). Throws for free/expired users — unless
    // the viewer is a platform admin.
    if (!hasRole(user.role, ROLES.ADMIN)) {
      await requireActiveSubscription(ctx);
    }

    const [financial, monthly, farmsResult, cropsResult, livestockResult] =
      await Promise.all([
        ctx.runQuery(api.transactions.getFinancialSummary, {}),
        ctx.runQuery(api.transactions.getMonthlyFinancialSummary, { months: 7 }),
        ctx.runQuery(api.farms.listUserFarms, {
          paginationOpts: { numItems: 200, cursor: null },
        }),
        ctx.runQuery(api.crops.listUserCrops, {}),
        ctx.runQuery(api.livestock.listUserLivestock, {}),
      ]);

    return {
      financial,
      monthly: monthly || [],
      farms: farmsResult?.page ?? [],
      crops: cropsResult?.page ?? [],
      livestock: livestockResult?.page ?? [],
    };
  },
});
