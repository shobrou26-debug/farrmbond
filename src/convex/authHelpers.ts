import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { ROLES, Role, SubscriptionTier } from "./schema";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================
// FarmBond Authorization Layer
// Centralized RBAC, ownership checks, subscription gating,
// and audit logging for all Convex functions.
// ============================================================

// Role hierarchy: higher index = more privilege
const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.FARMER]: 0,
  [ROLES.AGRONOMIST]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3,
};

const SUBSCRIPTION_HIERARCHY: Record<SubscriptionTier, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3,
};

// ============================================================
// Core Auth Functions
// ============================================================

/**
 * Get the authenticated user or throw an error.
 * Every mutation/query that requires auth should start with this.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentication required: No valid session found");
  }
  const userDoc = await ctx.db.get(userId);
  if (!userDoc) {
    throw new Error("Authentication error: User record not found");
  }
  // Cast to users table type since getAuthUserId returns Id<"users">
  const user = userDoc as Doc<"users">;
  return { userId, user };
}

/**
 * Get the current user ID, returning null if not authenticated.
 * Use for optional auth (e.g., public queries with logged-in enhancements).
 */
export async function optionalAuth(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const userDoc = await ctx.db.get(userId);
  if (!userDoc) return null;
  const user = userDoc as Doc<"users">;
  return { userId, user };
}

// ============================================================
// Role-Based Access Control (RBAC)
// ============================================================

/**
 * Require that the current user has at least the specified role.
 * Enforces server-side role hierarchy — cannot be bypassed by the client.
 */
export async function requireRole(ctx: QueryCtx | MutationCtx, minimumRole: Role) {
  const { userId, user } = await requireAuth(ctx);
  const userRole = (user.role || ROLES.FARMER) as Role;
  const requiredLevel = ROLE_HIERARCHY[minimumRole];
  const userLevel = ROLE_HIERARCHY[userRole];

  if (userLevel < requiredLevel) {
    throw new Error(
      `Authorization denied: Requires "${minimumRole}" role or higher. Current role: "${userRole}"`
    );
  }

  return { userId, user, role: userRole };
}

/**
 * Require exactly one of the specified roles.
 */
export async function requireAnyRole(ctx: QueryCtx | MutationCtx, allowedRoles: Role[]) {
  const { userId, user } = await requireAuth(ctx);
  const userRole = (user.role || ROLES.FARMER) as Role;

  if (!allowedRoles.includes(userRole)) {
    throw new Error(
      `Authorization denied: Requires one of [${allowedRoles.join(", ")}] roles. Current role: "${userRole}"`
    );
  }

  return { userId, user, role: userRole };
}

/**
 * Check if a user has a specific role or higher.
 */
export function hasRole(userRole: Role | undefined, requiredRole: Role): boolean {
  const role = (userRole || ROLES.FARMER) as Role;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if a user has exactly one of the specified roles.
 */
export function hasAnyRole(userRole: Role | undefined, allowedRoles: Role[]): boolean {
  const role = (userRole || ROLES.FARMER) as Role;
  return allowedRoles.includes(role);
}

// ============================================================
// Subscription Access Control
// ============================================================

/**
 * Require a minimum subscription tier for premium features.
 */
export async function requireSubscription(
  ctx: QueryCtx | MutationCtx,
  minimumTier: SubscriptionTier
) {
  const { userId, user } = await requireAuth(ctx);
  const userTier = (user.subscriptionTier || "free") as SubscriptionTier;

  if (SUBSCRIPTION_HIERARCHY[userTier] < SUBSCRIPTION_HIERARCHY[minimumTier]) {
    throw new Error(
      `Subscription required: "${minimumTier}" tier or higher needed. Current tier: "${userTier}". Upgrade at Settings > Subscription.`
    );
  }

  return { userId, user, subscriptionTier: userTier };
}

/**
 * Check if a user's subscription meets the minimum tier.
 */
export function hasSubscriptionTier(
  userTier: SubscriptionTier | undefined,
  minimumTier: SubscriptionTier
): boolean {
  const tier = (userTier || "free") as SubscriptionTier;
  return SUBSCRIPTION_HIERARCHY[tier] >= SUBSCRIPTION_HIERARCHY[minimumTier];
}

/**
 * Check if a subscription is still active (not expired).
 */
export function isSubscriptionActive(user: { subscriptionEndDate?: number; subscriptionTier?: SubscriptionTier }): boolean {
  if (!user.subscriptionTier || user.subscriptionTier === "free") return true;
  if (!user.subscriptionEndDate) return false;
  return Date.now() < user.subscriptionEndDate;
}

// ============================================================
// Resource Ownership Verification
// ============================================================

/**
 * Verify that the current user owns a specific farm.
 * Returns the farm document if authorized, throws otherwise.
 */
export async function verifyFarmOwnership(
  ctx: QueryCtx | MutationCtx,
  farmId: Id<"farms"> | string,
  userId: string
) {
  const farmDoc = await ctx.db.get(farmId as Id<"farms">);
  if (!farmDoc) {
    throw new Error("Resource not found: Farm does not exist");
  }
  const farm = farmDoc as Doc<"farms">;
  if (farm.userId !== userId) {
    throw new Error("Access denied: You do not own this farm");
  }
  return farm;
}

/**
 * Verify that the current user owns a specific crop.
 */
export async function verifyCropOwnership(
  ctx: QueryCtx | MutationCtx,
  cropId: Id<"crops"> | string,
  userId: string
) {
  const cropDoc = await ctx.db.get(cropId as Id<"crops">);
  if (!cropDoc) {
    throw new Error("Resource not found: Crop does not exist");
  }
  const crop = cropDoc as Doc<"crops">;
  if (crop.userId !== userId) {
    throw new Error("Access denied: You do not own this crop");
  }
  return crop;
}

/**
 * Verify that the current user owns specific livestock.
 */
export async function verifyLivestockOwnership(
  ctx: QueryCtx | MutationCtx,
  livestockId: Id<"livestock"> | string,
  userId: string
) {
  const livestockDoc = await ctx.db.get(livestockId as Id<"livestock">);
  if (!livestockDoc) {
    throw new Error("Resource not found: Livestock does not exist");
  }
  const livestock = livestockDoc as Doc<"livestock">;
  if (livestock.userId !== userId) {
    throw new Error("Access denied: You do not own this livestock record");
  }
  return livestock;
}

/**
 * Verify that the current user owns a specific transaction.
 */
export async function verifyTransactionOwnership(
  ctx: QueryCtx | MutationCtx,
  transactionId: Id<"transactions"> | string,
  userId: string
) {
  const transactionDoc = await ctx.db.get(transactionId as Id<"transactions">);
  if (!transactionDoc) {
    throw new Error("Resource not found: Transaction does not exist");
  }
  const transaction = transactionDoc as Doc<"transactions">;
  if (transaction.userId !== userId) {
    throw new Error("Access denied: You do not own this transaction");
  }
  return transaction;
}

/**
 * Verify that the current user owns a specific calendar event.
 */
export async function verifyCalendarOwnership(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"farmCalendar"> | string,
  userId: string
) {
  const eventDoc = await ctx.db.get(eventId as Id<"farmCalendar">);
  if (!eventDoc) {
    throw new Error("Resource not found: Calendar event does not exist");
  }
  const event = eventDoc as Doc<"farmCalendar">;
  if (event.userId !== userId) {
    throw new Error("Access denied: You do not own this calendar event");
  }
  return event;
}

/**
 * Verify that the current user owns a specific irrigation schedule.
 */
export async function verifyIrrigationOwnership(
  ctx: QueryCtx | MutationCtx,
  scheduleId: Id<"irrigationSchedules"> | string,
  userId: string
) {
  const scheduleDoc = await ctx.db.get(scheduleId as Id<"irrigationSchedules">);
  if (!scheduleDoc) {
    throw new Error("Resource not found: Irrigation schedule does not exist");
  }
  const schedule = scheduleDoc as Doc<"irrigationSchedules">;
  if (schedule.userId !== userId) {
    throw new Error("Access denied: You do not own this irrigation schedule");
  }
  return schedule;
}

/**
 * Verify that the current user owns a specific AI chat.
 */
export async function verifyChatOwnership(
  ctx: QueryCtx | MutationCtx,
  chatId: Id<"aiChats"> | string,
  userId: string
) {
  const chatDoc = await ctx.db.get(chatId as Id<"aiChats">);
  if (!chatDoc) {
    throw new Error("Resource not found: AI chat does not exist");
  }
  const chat = chatDoc as Doc<"aiChats">;
  if (chat.userId !== userId) {
    throw new Error("Access denied: You do not own this AI chat");
  }
  return chat;
}

/**
 * Verify consultation participation (farmer or agronomist in the consultation).
 */
export async function verifyConsultationAccess(
  ctx: QueryCtx | MutationCtx,
  consultationId: Id<"consultations"> | string,
  userId: string
) {
  const consultationDoc = await ctx.db.get(consultationId as Id<"consultations">);
  if (!consultationDoc) {
    throw new Error("Resource not found: Consultation does not exist");
  }
  const consultation = consultationDoc as Doc<"consultations">;
  if (consultation.farmerId !== userId && consultation.agronomistId !== userId) {
    // Admins can access any consultation
    const { user } = await requireAuth(ctx);
    if (!hasRole(user.role as Role, ROLES.ADMIN)) {
      throw new Error("Access denied: You are not part of this consultation");
    }
  }
  return consultation;
}

// ============================================================
// Audit Logging
// ============================================================

/**
 * Create an audit log entry for any action.
 * Should be called after successful mutations.
 */
export async function createAuditLog(
  ctx: MutationCtx,
  params: {
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  await ctx.db.insert("auditLogs", {
    userId: params.userId as Id<"users">,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId,
    changes: params.changes,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    createdAt: Date.now(),
  });
}

// ============================================================
// Rate Limiting (In-Memory via Audit Logs)
// ============================================================

/**
 * Simple rate limiter using audit log counts.
 * Checks if a user has exceeded the allowed number of actions
 * within a time window.
 */
export async function checkRateLimit(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  action: string,
  maxActions: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const cutoff = Date.now() - windowMs;
  const recentActions = await ctx.db
    .query("auditLogs")
    .withIndex("by_user", (q) => q.eq("userId", userId as Id<"users">))
    .filter((q) => q.and(q.gte(q.field("createdAt"), cutoff), q.eq(q.field("action"), action)))
    .collect();

  const count = recentActions.length;
  const remaining = Math.max(0, maxActions - count);

  return {
    allowed: count < maxActions,
    remaining,
  };
}

// ============================================================
// Input Validation Helpers
// ============================================================

/**
 * Validate that a string is not empty and doesn't exceed max length.
 */
export function validateString(value: string, fieldName: string, maxLength = 500): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Validation error: ${fieldName} cannot be empty`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`Validation error: ${fieldName} cannot exceed ${maxLength} characters`);
  }
  return trimmed;
}

/**
 * Validate that a number is within a range.
 */
export function validateNumber(
  value: number,
  fieldName: string,
  min?: number,
  max?: number
): number {
  if (typeof value !== "number" || isNaN(value)) {
    throw new Error(`Validation error: ${fieldName} must be a valid number`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`Validation error: ${fieldName} must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`Validation error: ${fieldName} must be at most ${max}`);
  }
  return value;
}

/**
 * Validate that a coordinate pair is valid (lat/lng).
 */
export function validateCoordinates(latitude: number, longitude: number): void {
  validateNumber(latitude, "latitude", -90, 90);
  validateNumber(longitude, "longitude", -180, 180);
}

/**
 * Sanitize user input by removing potentially dangerous characters.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove HTML tags
    .trim();
}

// ============================================================
// Composite Authorization Helpers
// ============================================================

/**
 * Require auth + ownership for user-scoped resources.
 * Combines authentication check with resource ownership verification.
 */
export async function requireOwnerOfResource(
  ctx: QueryCtx | MutationCtx,
  resourceId: string,
  table: "farms" | "crops" | "livestock" | "transactions" | "aiChats" | "farmCalendar" | "irrigationSchedules"
) {
  const { userId } = await requireAuth(ctx);
  const resourceDoc = await ctx.db.get(resourceId as any);

  if (!resourceDoc) {
    throw new Error(`Resource not found: ${table} entry does not exist`);
  }

  const resource = resourceDoc as Record<string, unknown>;

  if (resource.userId !== userId) {
    throw new Error(`Access denied: You do not own this ${table} entry`);
  }

  return { userId, resource: resourceDoc };
}

/**
 * Admin-only operation guard with super_admin escalation check.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, ROLES.ADMIN);
}

/**
 * Super admin-only operation guard.
 */
export async function requireSuperAdmin(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, ROLES.SUPER_ADMIN);
}

/**
 * Agronomist or higher access guard.
 */
export async function requireAgronomistOrHigher(ctx: QueryCtx | MutationCtx) {
  return requireRole(ctx, ROLES.AGRONOMIST);
}
