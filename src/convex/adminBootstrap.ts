import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireAuth, createAuditLog } from "./authHelpers";
import { ROLES } from "./schema";

// ============================================================
// First-Admin Bootstrap
//
// PURPOSE
//   FarmBond has no way to create the very first admin through the app:
//   every role change (admin.updateUserRole) requires an existing admin.
//   This module is the controlled, server-side bootstrap for the project
//   owner during initial production setup.
//
// SECURITY MODEL (fail-closed on every axis)
//   1. The mutation requires an AUTHENTICATED session (requireAuth) —
//      unauthenticated callers get "Authentication required".
//   2. The caller's verified email must EXACTLY match the
//      BOOTSTRAP_ADMIN_EMAIL environment variable (configured in the
//      Keys/API keys tab / Convex env). Arbitrary users cannot make
//      themselves admin: they don't know the configured email and it is
//      never exposed to the client.
//   3. Bootstrap is only possible while NO admin or super_admin exists.
//      Once the first admin is created, the mutation is permanently
//      inert — even if that admin is later demoted or deleted.
//   4. It never weakens requireAdmin/requireRole: those are untouched.
//   5. The bootstrap is audit-logged (action "admin_bootstrapped").
//
// USAGE (project owner)
//   1. Set BOOTSTRAP_ADMIN_EMAIL=<your-email> in Convex environment vars
//      (Keys/API keys tab). Do NOT leave it set after bootstrap — remove
//      it once the first admin exists.
//   2. Sign in with that email in the app.
//   3. Open the Dashboard — an "Initial admin setup" card appears ONLY
//      when no admin exists. Click "Claim initial admin access".
//   4. Verify the role change in Admin Dashboard. Remove the env var.
//   Alternative: call api.adminBootstrap.bootstrapFirstAdmin from the
//   Convex dashboard while signed in as the bootstrap email.
//
// Race note: two concurrent calls by the same owner could both succeed
// while no admin exists; both callers are the same email-gated person,
// so this is harmless and is the intended outcome for the owner.
// ============================================================

const BOOTSTRAP_ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;

export function isAdminRole(role: string | undefined): boolean {
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
}

export type BootstrapDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Pure decision rule (exported for tests).
 * Every axis fails closed: unconfigured env, an existing admin, an empty
 * or mismatched caller email — all deny.
 */
export function canBootstrapFirstAdmin(opts: {
  configuredEmail?: string;
  callerEmail?: string;
  existingAdminCount: number;
}): BootstrapDecision {
  const configured = (opts.configuredEmail ?? "").trim().toLowerCase();
  if (!configured) {
    return {
      allowed: false,
      reason:
        "Initial admin setup is not configured. Set BOOTSTRAP_ADMIN_EMAIL (Keys/API keys tab) and sign in with that email.",
    };
  }
  if (opts.existingAdminCount > 0) {
    return {
      allowed: false,
      reason: "An administrator already exists. Initial admin setup is closed.",
    };
  }
  const caller = (opts.callerEmail ?? "").trim().toLowerCase();
  if (!caller) {
    return {
      allowed: false,
      reason: "Your account has no verified email, so it cannot be the initial admin.",
    };
  }
  if (caller !== configured) {
    return {
      allowed: false,
      reason: "This account is not authorized for initial admin setup.",
    };
  }
  return { allowed: true };
}

/** Count existing platform admins (admin or super_admin), max 1 each. */
async function countExistingAdmins(ctx: QueryCtx | MutationCtx): Promise<number> {
  const [admins, superAdmins] = await Promise.all([
    ctx.db.query("users").withIndex("role", (q) => q.eq("role", ROLES.ADMIN)).take(1),
    ctx.db
      .query("users")
      .withIndex("role", (q) => q.eq("role", ROLES.SUPER_ADMIN))
      .take(1),
  ]);
  return admins.length + superAdmins.length;
}

/**
 * Authenticated query: should the signed-in user's Dashboard show the
 * initial-admin card? Only when bootstrap is configured AND no admin
 * exists yet. The email match is NOT exposed here (checked only in the
 * mutation) so the config value is never leaked to clients.
 */
export const getAdminBootstrapStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const adminExists = (await countExistingAdmins(ctx)) > 0;
    return {
      configured: !!BOOTSTRAP_ADMIN_EMAIL,
      adminExists,
      // Never true while adminExists — the card is only actionable during
      // the genuine zero-admin bootstrap window.
      canShowCard: !!BOOTSTRAP_ADMIN_EMAIL && !adminExists,
    };
  },
});

/**
 * Promote the signed-in caller to super_admin — ONLY under the bootstrap
 * rules above. Requires authentication; requires no existing admin;
 * requires the caller's email to match BOOTSTRAP_ADMIN_EMAIL.
 */
export const bootstrapFirstAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireAuth(ctx);

    const existingAdminCount = await countExistingAdmins(ctx);
    const decision = canBootstrapFirstAdmin({
      configuredEmail: BOOTSTRAP_ADMIN_EMAIL,
      callerEmail: user.email,
      existingAdminCount,
    });
    if (!decision.allowed) {
      throw new Error(decision.reason);
    }

    await ctx.db.patch(userId, {
      role: ROLES.SUPER_ADMIN,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx, {
      userId,
      action: "admin_bootstrapped",
      resource: "users",
      resourceId: userId,
      changes: {
        role: ROLES.SUPER_ADMIN,
        email: user.email,
        bootstrapEmailConfigured: true,
      },
    });

    return { success: true, role: ROLES.SUPER_ADMIN };
  },
});
