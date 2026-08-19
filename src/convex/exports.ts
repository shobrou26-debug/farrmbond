import { action } from "./_generated/server";
import { v } from "convex/values";
import { hasPremiumAccess, hasRole } from "./authHelpers";
import { ROLES } from "./schema";
import { api } from "./_generated/api";

// ============================================================
// Server-Authorized Export Data (Phase 4A)
// PDF/Excel exports are a Pro feature. The client never exports from
// local state alone — it first calls this gated action, which:
//   1. requires an ACTIVE (unexpired) Pro subscription, and
//   2. returns the data to export from the backend.
// Free and expired users receive a clean authorization error.
// ============================================================

export type ExportResource = "transactions" | "analytics" | "audit_log";

const EXPORT_RESOURCES = ["transactions", "analytics", "audit_log"] as const;

/**
 * Pro gate for actions (actions cannot touch the db directly, so the user
 * is resolved through the authenticated session query). Throws a clean
 * authorization error for free/expired users.
 */
async function requireExportEntitlement(ctx: any) {
  const user = await ctx.runQuery(api.users.currentUser);
  if (!user) {
    throw new Error("Authentication required");
  }
  // Platform admins may export regardless of their own subscription tier.
  if (hasRole(user.role, ROLES.ADMIN)) return;
  if (!hasPremiumAccess(user)) {
    throw new Error(
      "PDF/Excel exports are a Pro feature. Upgrade at Settings > Subscription — expired subscriptions are treated as Free."
    );
  }
}

/**
 * Gated action: fetch the data needed for a Pro export.
 */
export const getExportData = action({
  args: {
    resource: v.union(
      v.literal("transactions"),
      v.literal("analytics"),
      v.literal("audit_log")
    ),
  },
  handler: async (ctx, args) => {
    await requireExportEntitlement(ctx);

    const now = Date.now();

    switch (args.resource) {
      case "transactions": {
        const transactions: any[] = await ctx.runQuery(
          api.transactions.listUserTransactions,
          {}
        );
        const rows = await Promise.all(
          transactions.map(async (t) => {
            let farmName = "Unknown";
            if (t.farmId) {
              try {
                const farm: any = await ctx.runQuery(api.farms.getFarm, {
                  farmId: t.farmId,
                });
                farmName = farm?.name ?? "Unknown";
              } catch {
                farmName = "Unknown";
              }
            }
            return {
              date: new Date(t.date).toISOString().split("T")[0],
              type: t.type,
              category: t.category,
              description: t.description,
              amount: t.amount,
              // Keep the stored currency on the row so the frontend can convert
              // each amount into the user's configured currency before export
              // (transactions are stored in the currency selected at entry time,
              // which is not always KES).
              currency: t.currency ?? "KES",
              farm: farmName,
              paymentMethod: t.paymentMethod ?? "",
            };
          })
        );
        return { resource: args.resource, generatedAt: now, rows };
      }

      case "analytics": {
        const financial: any = await ctx.runQuery(
          api.transactions.getFinancialSummary,
          {}
        );
        const monthly: any[] = await ctx.runQuery(
          api.transactions.getMonthlyFinancialSummary,
          { months: 7 }
        );
        const rows = (monthly || []).map((d) => ({
          period: d.month,
          revenue: d.income,
          expenses: d.expenses,
          profit: d.profit,
        }));
        // Note: frontend exportAnalyticsData uses 'revenue' key — mapped above.
        return {
          resource: args.resource,
          generatedAt: now,
          rows,
          summary: financial,
        };
      }

      case "audit_log": {
        const logs: any[] = await ctx.runQuery(
          api.admin.listAuditLogsForViewer,
          { limit: 500 }
        );
        const rows = logs.map((log) => ({
          action: log.action,
          entityType: log.resource,
          entityId: log.resourceId,
          status: "success",
          timestamp: new Date(log.createdAt).toISOString(),
          details: log.changes ? JSON.stringify(log.changes) : "",
        }));
        return { resource: args.resource, generatedAt: now, rows };
      }

      default:
        throw new Error("Unsupported export resource");
    }
  },
});

export { EXPORT_RESOURCES };
