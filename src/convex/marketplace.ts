import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import {
  requireAuth,
  requireAdmin,
  createAuditLog,
  requireActiveSubscription,
  validateString,
  validateNumber,
  sanitizeInput,
  verifyConsultationAccess,
} from "./authHelpers";
import { ROLES } from "./schema";

// ============================================================
// Agronomist Marketplace Module
// ============================================================

/**
 * Pure: a profile is public only when it is EXPLICITLY approved.
 * Legacy/seed profiles without a status field are treated as approved
 * development data; real applications are strictly status === "approved".
 */
export function isApprovedAgronomist(profile: { status?: string } | null | undefined): boolean {
  if (!profile) return false;
  return (profile.status ?? "approved") === "approved";
}

/**
 * Demo/seed profiles (created by the admin seed tool) must never be
 * listed as verified professionals or receive bookings. Server-enforced
 * at every public read and at booking time.
 */
export function isSeededAgronomist(profile: { isSeeded?: boolean } | null | undefined): boolean {
  return profile?.isSeeded === true;
}

/** List all agronomist profiles with optional filtering */
export const listAgronomists = query({
  args: {
    specialization: v.optional(v.string()),
    available: v.optional(v.boolean()),
    includeSeeded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let profiles;

    if (args.specialization && args.specialization !== "all") {
      profiles = await ctx.db
        .query("agronomistProfiles")
        .withIndex("by_specializations", (qi) =>
          qi.eq("specializations", [args.specialization!])
        )
        .order("desc")
        .collect();
    } else {
      profiles = await ctx.db
        .query("agronomistProfiles")
        .fullTableScan()
        .order("desc")
        .collect();
    }

    // Only approved, non-seeded agronomists are ever listed publicly.
    profiles = profiles.filter(
      (p) => isApprovedAgronomist(p) && (args.includeSeeded || !isSeededAgronomist(p))
    );

    // Join with user data for name/avatar
    const results = await Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        return {
          ...profile,
          name: user?.name ?? "Unknown",
          image: user?.image ?? null,
          email: user?.email ?? null,
          location: user?.location ?? null,
        };
      })
    );

    // Filter by availability if requested
    if (args.available !== undefined) {
      return results.filter((r) => {
        const isAvailable = r.averageRating > 0 || r.totalConsultations > 0;
        return args.available ? isAvailable : !isAvailable;
      });
    }

    return results;
  },
});

/** Get a single agronomist profile by ID */
export const getAgronomist = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("agronomistProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // Pending/rejected applications and demo/seed profiles are never public.
    if (!profile || !isApprovedAgronomist(profile) || isSeededAgronomist(profile)) return null;

    const user = await ctx.db.get(profile.userId);
    return {
      ...profile,
      name: user?.name ?? "Unknown",
      image: user?.image ?? null,
      email: user?.email ?? null,
      location: user?.location ?? null,
      bio: user?.bio ?? null,
    };
  },
});

// ============================================================
// Agronomist Application Journey (Phase 4B)
// Farmer/Admin → apply → admin review → approved/rejected.
// Applications belong to the authenticated applicant; only admins review.
// ============================================================

const AGRO_SERVICE_TYPES = ["chat", "video", "field_visit"] as const;

function validateAgronomistInput(args: {
  title: string;
  specializations: string[];
  experience: number;
  services: Array<{ name: string; description: string; price: number; duration: number; type: string }>;
  availableDays: string[];
  availableHours: { start: string; end: string };
  timezone: string;
}) {
  const title = sanitizeInput(validateString(args.title, "Professional title", 100));
  const specializations = (args.specializations || [])
    .map((s) => sanitizeInput(s))
    .filter((s) => s.length > 0)
    .slice(0, 10);
  if (specializations.length === 0) {
    throw new Error("Validation error: At least one specialization is required");
  }
  validateNumber(args.experience, "Experience (years)", 0, 80);
  const services = (args.services || []).slice(0, 20).map((s) => ({
    name: sanitizeInput(validateString(s.name, "Service name", 100)),
    description: sanitizeInput(validateString(s.description, "Service description", 500)),
    price: validateNumber(s.price, "Service price", 0, 1000000),
    duration: validateNumber(s.duration, "Service duration (min)", 15, 480),
    type: AGRO_SERVICE_TYPES.includes(s.type as (typeof AGRO_SERVICE_TYPES)[number])
      ? (s.type as (typeof AGRO_SERVICE_TYPES)[number])
      : "chat",
  }));
  if (services.length === 0) {
    throw new Error("Validation error: At least one service is required");
  }
  const availableDays = (args.availableDays || []).slice(0, 7);
  const availableHours = {
    start: sanitizeInput(validateString(args.availableHours?.start ?? "", "Start hour", 10)),
    end: sanitizeInput(validateString(args.availableHours?.end ?? "", "End hour", 10)),
  };
  const timezone = sanitizeInput(validateString(args.timezone, "Timezone", 100));
  return { title, specializations, experience: args.experience, services, availableDays, availableHours, timezone };
}

/**
 * Submit or re-submit the authenticated user's agronomist application.
 * The applicant's identity always comes from the session — a client can
 * never apply on behalf of someone else. Approvals happen ONLY via
 * reviewAgronomistApplication (admin).
 */
export const applyAsAgronomist = mutation({
  args: {
    title: v.string(),
    specializations: v.array(v.string()),
    experience: v.number(),
    services: v.array(v.object({
      name: v.string(),
      description: v.string(),
      price: v.number(),
      duration: v.number(),
      type: v.union(v.literal("chat"), v.literal("video"), v.literal("field_visit")),
    })),
    availableDays: v.array(v.string()),
    availableHours: v.object({ start: v.string(), end: v.string() }),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const data = validateAgronomistInput(args);
    const now = Date.now();

    const existing = await ctx.db
      .query("agronomistProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      if (existing.status === "approved") {
        throw new Error("Your agronomist profile is already approved");
      }
      await ctx.db.patch(existing._id, {
        ...data,
        status: "pending",
        appliedAt: now,
        rejectionReason: undefined,
        reviewedAt: undefined,
        reviewedBy: undefined,
        updatedAt: now,
      });
      await createAuditLog(ctx, {
        userId,
        action: "agronomist_applied",
        resource: "agronomistProfiles",
        resourceId: existing._id,
        changes: { title: data.title, resubmitted: true },
      });
      return { profileId: existing._id, status: "pending" };
    }

    const profileId = await ctx.db.insert("agronomistProfiles", {
      userId,
      ...data,
      status: "pending",
      appliedAt: now,
      averageRating: 0,
      totalReviews: 0,
      totalConsultations: 0,
      createdAt: now,
      updatedAt: now,
    });
    await createAuditLog(ctx, {
      userId,
      action: "agronomist_applied",
      resource: "agronomistProfiles",
      resourceId: profileId,
      changes: { title: data.title },
    });
    return { profileId, status: "pending" };
  },
});

/** The applicant's own application status (any state). */
export const getMyAgronomistApplication = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const profile = await ctx.db
      .query("agronomistProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;
    return {
      profileId: profile._id,
      status: profile.status ?? "approved",
      title: profile.title,
      rejectionReason: profile.rejectionReason,
      appliedAt: profile.appliedAt,
      reviewedAt: profile.reviewedAt,
    };
  },
});

/**
 * Admin: list agronomist applications (pending by default) with applicant
 * details. Pending/rejected profiles are NOT visible through the public
 * marketplace queries — only here (admin) or to the applicant themselves.
 */
export const listAgronomistApplications = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let profiles = args.status
      ? await ctx.db
          .query("agronomistProfiles")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .collect()
      : await ctx.db.query("agronomistProfiles").fullTableScan().collect();

    profiles = profiles.sort((a, b) => (b.appliedAt ?? b.createdAt) - (a.appliedAt ?? a.createdAt));

    return Promise.all(
      profiles.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        return {
          profileId: profile._id,
          userId: profile.userId,
          status: profile.status ?? "approved",
          title: profile.title,
          specializations: profile.specializations,
          experience: profile.experience,
          services: profile.services,
          appliedAt: profile.appliedAt ?? profile.createdAt,
          rejectionReason: profile.rejectionReason,
          applicantName: user?.name ?? "Unknown",
          applicantEmail: user?.email ?? "",
        };
      })
    );
  },
});

/**
 * Admin: approve or reject an agronomist application.
 * Approval is the ONLY path to an active agronomist profile, and it also
 * promotes the applicant's role. Rejection demotes back to farmer.
 */
export const reviewAgronomistApplication = mutation({
  args: {
    profileId: v.id("agronomistProfiles"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Agronomist application not found");
    const now = Date.now();

    if (args.action === "approve") {
      await ctx.db.patch(profile._id, {
        status: "approved",
        rejectionReason: undefined,
        reviewedAt: now,
        reviewedBy: userId,
        updatedAt: now,
      });
      await ctx.db.patch(profile.userId, { role: ROLES.AGRONOMIST, updatedAt: now });
    } else {
      await ctx.db.patch(profile._id, {
        status: "rejected",
        rejectionReason: args.reason
          ? sanitizeInput(args.reason).slice(0, 500)
          : "Application not approved",
        reviewedAt: now,
        reviewedBy: userId,
        updatedAt: now,
      });
      await ctx.db.patch(profile.userId, { role: ROLES.FARMER, updatedAt: now });
    }

    await createAuditLog(ctx, {
      userId,
      action: "agronomist_reviewed",
      resource: "agronomistProfiles",
      resourceId: profile._id,
      changes: {
        action: args.action,
        reason: args.reason ?? undefined,
        applicantUserId: profile.userId,
        title: profile.title,
      },
    });

    return { success: true, status: args.action === "approve" ? "approved" : "rejected" };
  },
});

// ============================================================
// Agricultural Companies Module
// ============================================================

/** List all agricultural companies with optional filtering */
export const listCompanies = query({
  args: {
    category: v.optional(v.string()),
    country: v.optional(v.string()),
    includeSeeded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let companies;

    if (args.category && args.category !== "all") {
      companies = await ctx.db
        .query("agriculturalCompanies")
        .withIndex("by_category", (qi) =>
          qi.eq("category", args.category!)
        )
        .order("desc")
        .collect();
    } else {
      companies = await ctx.db
        .query("agriculturalCompanies")
        .fullTableScan()
        .order("desc")
        .collect();
    }

    // Demo/seed listings never appear in public catalogues.
    companies = companies.filter((c) => args.includeSeeded || c.isSeeded !== true);

    if (args.country && args.country !== "all") {
      return companies.filter((c) => c.country === args.country);
    }

    return companies;
  },
});

/** Get a single company by ID */
export const getCompany = query({
  args: { companyId: v.id("agriculturalCompanies") },
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId);
    if (!company || company.isSeeded === true) return null;
    return company;
  },
});

/** Create a new agricultural company (admin only) */
export const createCompany = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    description: v.string(),
    logoUrl: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    location: v.string(),
    country: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    products: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    const now = Date.now();
    const id = await ctx.db.insert("agriculturalCompanies", {
      ...args,
      rating: 0,
      reviewCount: 0,
      verified: false,
      featured: false,
      createdAt: now,
      updatedAt: now,
    });
    await createAuditLog(ctx, { userId, action: "create", resource: "agriculturalCompanies", resourceId: id, changes: { name: args.name, category: args.category } });
    return id;
  },
});

// ============================================================
// Seed Showcase Module
// ============================================================

/** List all seeds with optional filtering */
export const listSeeds = query({
  args: {
    cropType: v.optional(v.string()),
    inStock: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
    includeSeeded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let seeds;

    if (args.cropType && args.cropType !== "all") {
      seeds = await ctx.db
        .query("seeds")
        .withIndex("by_crop_type", (qi) =>
          qi.eq("cropType", args.cropType!)
        )
        .order("desc")
        .collect();
    } else {
      seeds = await ctx.db
        .query("seeds")
        .fullTableScan()
        .order("desc")
        .collect();
    }

    // Demo/seed listings never appear in public catalogues.
    let filtered = seeds.filter((s) => args.includeSeeded || s.isSeeded !== true);
    if (args.inStock !== undefined) {
      filtered = filtered.filter((s) => s.inStock === args.inStock);
    }
    if (args.featured !== undefined) {
      filtered = filtered.filter((s) => s.featured === args.featured);
    }

    return filtered;
  },
});

/** Get a single seed by ID */
export const getSeed = query({
  args: { seedId: v.id("seeds") },
  handler: async (ctx, args) => {
    const seed = await ctx.db.get(args.seedId);
    if (!seed || seed.isSeeded === true) return null;
    return seed;
  },
});

/** Create a new seed listing (admin/agronomist) */
export const createSeed = mutation({
  args: {
    name: v.string(),
    cropType: v.string(),
    variety: v.string(),
    description: v.string(),
    companyId: v.optional(v.id("agriculturalCompanies")),
    company: v.string(),
    imageUrl: v.optional(v.string()),
    price: v.number(),
    currency: v.string(),
    unit: v.string(),
    germinationRate: v.number(),
    maturityDays: v.number(),
    yieldPerHectare: v.string(),
    waterNeeds: v.string(),
    climate: v.array(v.string()),
    season: v.array(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    const now = Date.now();
    const id = await ctx.db.insert("seeds", {
      ...args,
      rating: 0,
      reviewCount: 0,
      inStock: true,
      featured: false,
      createdAt: now,
      updatedAt: now,
    });
    await createAuditLog(ctx, { userId, action: "create", resource: "seeds", resourceId: id, changes: { name: args.name, cropType: args.cropType } });
    return id;
  },
});

// ============================================================
// Update & Delete Mutations (Admin CRUD)
// ============================================================

/** Update an agronomist profile */
export const updateAgronomist = mutation({
  args: {
    profileId: v.id("agronomistProfiles"),
    title: v.optional(v.string()),
    specializations: v.optional(v.array(v.string())),
    experience: v.optional(v.number()),
    services: v.optional(v.array(v.object({
      name: v.string(),
      description: v.string(),
      price: v.number(),
      duration: v.number(),
      type: v.union(v.literal("chat"), v.literal("video"), v.literal("field_visit")),
    }))),
    availableDays: v.optional(v.array(v.string())),
    availableHours: v.optional(v.object({ start: v.string(), end: v.string() })),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const { profileId, ...updates } = args;
    await ctx.db.patch(profileId, { ...updates, updatedAt: Date.now() });
    await createAuditLog(ctx, { userId, action: "update", resource: "agronomistProfiles", resourceId: profileId, changes: updates });
    return { success: true };
  },
});

/** Delete an agronomist profile */
export const deleteAgronomist = mutation({
  args: { profileId: v.id("agronomistProfiles") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const doc = await ctx.db.get(args.profileId);
    await ctx.db.delete(args.profileId);
    await createAuditLog(ctx, { userId, action: "delete", resource: "agronomistProfiles", resourceId: args.profileId, changes: { deletedName: doc?.title } });
    return { success: true };
  },
});

/** Update an agricultural company */
export const updateCompany = mutation({
  args: {
    companyId: v.id("agriculturalCompanies"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    location: v.optional(v.string()),
    country: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    products: v.optional(v.array(v.string())),
    verified: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const { companyId, ...updates } = args;
    await ctx.db.patch(companyId, { ...updates, updatedAt: Date.now() });
    await createAuditLog(ctx, { userId, action: "update", resource: "agriculturalCompanies", resourceId: companyId, changes: updates });
    return { success: true };
  },
});

/** Delete an agricultural company */
export const deleteCompany = mutation({
  args: { companyId: v.id("agriculturalCompanies") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const doc = await ctx.db.get(args.companyId);
    await ctx.db.delete(args.companyId);
    await createAuditLog(ctx, { userId, action: "delete", resource: "agriculturalCompanies", resourceId: args.companyId, changes: { deletedName: doc?.name } });
    return { success: true };
  },
});

/** Update a seed listing */
export const updateSeed = mutation({
  args: {
    seedId: v.id("seeds"),
    name: v.optional(v.string()),
    cropType: v.optional(v.string()),
    variety: v.optional(v.string()),
    description: v.optional(v.string()),
    company: v.optional(v.string()),
    price: v.optional(v.number()),
    currency: v.optional(v.string()),
    unit: v.optional(v.string()),
    germinationRate: v.optional(v.number()),
    maturityDays: v.optional(v.number()),
    yieldPerHectare: v.optional(v.string()),
    waterNeeds: v.optional(v.string()),
    climate: v.optional(v.array(v.string())),
    season: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    inStock: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const { seedId, ...updates } = args;
    await ctx.db.patch(seedId, { ...updates, updatedAt: Date.now() });
    await createAuditLog(ctx, { userId, action: "update", resource: "seeds", resourceId: seedId, changes: updates });
    return { success: true };
  },
});

/** Delete a seed listing */
export const deleteSeed = mutation({
  args: { seedId: v.id("seeds") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const doc = await ctx.db.get(args.seedId);
    await ctx.db.delete(args.seedId);
    await createAuditLog(ctx, { userId, action: "delete", resource: "seeds", resourceId: args.seedId, changes: { deletedName: doc?.name } });
    return { success: true };
  },
});

// ============================================================
// Consultation Booking Module
// ============================================================

const CONSULTATION_CURRENCY = "KES";

/**
 * Pure: find the service on an agronomist profile by exact name and return
 * its server-authoritative price and duration. Returns null when the
 * service does not exist — the booking must then be rejected, because a
 * client can never pick an arbitrary consultation amount.
 */
export function findAgronomistService(
  profile: { services?: Array<{ name: string; price: number; duration: number }> } | null | undefined,
  serviceName: string
): { price: number; duration: number } | null {
  const service = (profile?.services ?? []).find((s) => s.name === serviceName);
  if (!service) return null;
  if (typeof service.price !== "number" || !Number.isFinite(service.price) || service.price <= 0) return null;
  const duration = typeof service.duration === "number" && service.duration > 0 ? service.duration : 30;
  return { price: service.price, duration };
}

/** Book a consultation with an agronomist */
export const bookConsultation = mutation({
  args: {
    agronomistId: v.id("users"),
    farmId: v.optional(v.id("farms")),
    serviceType: v.string(),
    scheduledAt: v.number(),
    duration: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Expert consultations are a Pro feature — requires an ACTIVE subscription
    const { userId } = await requireActiveSubscription(ctx);

    // Only APPROVED agronomists can receive bookings.
    const agronomistProfile = await ctx.db
      .query("agronomistProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.agronomistId))
      .first();
    // Demo/seed profiles can never receive a booking — a farmer cannot
    // bypass this through a direct backend call.
    if (
      !agronomistProfile ||
      !isApprovedAgronomist(agronomistProfile) ||
      isSeededAgronomist(agronomistProfile)
    ) {
      throw new Error("This agronomist is not available for bookings");
    }

    // The consultation price is ALWAYS the agronomist's published service
    // price, resolved server-side. The client cannot choose an amount; a
    // bogus serviceType is rejected rather than stored at amount 0.
    const service = findAgronomistService(agronomistProfile, args.serviceType);
    if (!service) {
      throw new Error("The selected service is not available on this agronomist's profile");
    }

    if (args.scheduledAt <= Date.now()) {
      throw new Error("Consultations must be scheduled in the future");
    }

    const now = Date.now();
    const id = await ctx.db.insert("consultations", {
      farmerId: userId,
      agronomistId: args.agronomistId,
      farmId: args.farmId,
      serviceType: args.serviceType,
      scheduledAt: args.scheduledAt,
      // Duration is derived from the service definition, not the client.
      duration: service.duration,
      status: "pending",
      notes: args.notes ? sanitizeInput(args.notes).slice(0, 1000) : undefined,
      amount: service.price,
      currency: CONSULTATION_CURRENCY,
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await createAuditLog(ctx, { userId, action: "create", resource: "consultations", resourceId: id, changes: { agronomistId: args.agronomistId, serviceType: args.serviceType, amount: service.price } });
    return id;
  },
});

/**
 * Internal: fetch a consultation row for the payment actions.
 * No auth — the caller (authenticated action) verifies ownership.
 */
export const getConsultationByIdInternal = internalQuery({
  args: { consultationId: v.id("consultations") },
  handler: async (ctx, args) => {
    const consultation = await ctx.db.get(args.consultationId);
    if (!consultation) return null;
    return {
      farmerId: consultation.farmerId,
      agronomistId: consultation.agronomistId,
      serviceType: consultation.serviceType,
      scheduledAt: consultation.scheduledAt,
      status: consultation.status,
      amount: consultation.amount,
      currency: consultation.currency,
      paymentStatus: consultation.paymentStatus,
    };
  },
});

/** List user's consultations (farmer view) with payment status */
export const listUserConsultations = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const consultations = await ctx.db
      .query("consultations")
      .withIndex("by_farmer", (q) => q.eq("farmerId", userId))
      .order("desc")
      .collect();

    // The user's own payment transactions (bounded per user) — used to
    // surface the most recent pending payment reference per consultation
    // so the UI can resume/poll a payment after a page refresh.
    const payments = await ctx.db
      .query("mobileMoneyTransactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);

    const results = await Promise.all(
      consultations.map(async (c) => {
        const agronomist = await ctx.db.get(c.agronomistId);
        const pendingPayment = payments.find(
          (p) => p.consultationId === c._id && p.status !== "completed" && p.status !== "failed" && p.status !== "expired"
        );
        return {
          ...c,
          agronomistName: agronomist?.name ?? "Unknown",
          agronomistImage: agronomist?.image ?? null,
          pendingPayment: pendingPayment
            ? {
                referenceId: pendingPayment.referenceId,
                provider: pendingPayment.provider,
                status: pendingPayment.status,
                countryCode: pendingPayment.countryCode ?? undefined,
              }
            : null,
        };
      })
    );

    return results;
  },
});

/** List consultations booked with the authenticated agronomist. */
export const listAgronomistConsultations = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const consultations = await ctx.db
      .query("consultations")
      .withIndex("by_agronomist", (q) => q.eq("agronomistId", userId))
      .order("desc")
      .collect();

    return Promise.all(
      consultations.map(async (c) => {
        const farmer = await ctx.db.get(c.farmerId);
        return {
          ...c,
          farmerName: farmer?.name ?? "Unknown",
          farmerImage: farmer?.image ?? null,
        };
      })
    );
  },
});

/**
 * Agronomist (participant): confirm a booked consultation.
 * Only the farmer or the agronomist on the consultation can act.
 */
export const confirmConsultation = mutation({
  args: { consultationId: v.id("consultations") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const consultation = await verifyConsultationAccess(ctx, args.consultationId, userId);
    if (consultation.status !== "pending") {
      throw new Error("Only pending consultations can be confirmed");
    }
    await ctx.db.patch(args.consultationId, { status: "confirmed", updatedAt: Date.now() });
    await createAuditLog(ctx, { userId, action: "confirm", resource: "consultations", resourceId: args.consultationId, changes: { status: "confirmed" } });
    return { success: true };
  },
});

/**
 * Participant: cancel a consultation. Allowed only while unpaid — a paid
 * consultation must go through support for a refund (never auto-refunded
 * or silently flipped to refunded).
 */
export const cancelConsultation = mutation({
  args: { consultationId: v.id("consultations") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const consultation = await verifyConsultationAccess(ctx, args.consultationId, userId);
    if (consultation.status === "cancelled" || consultation.status === "completed") {
      throw new Error("This consultation can no longer be cancelled");
    }
    if (consultation.paymentStatus === "paid") {
      throw new Error(
        "This consultation has already been paid. Contact support for a refund."
      );
    }
    await ctx.db.patch(args.consultationId, { status: "cancelled", updatedAt: Date.now() });
    await createAuditLog(ctx, { userId, action: "cancel", resource: "consultations", resourceId: args.consultationId, changes: { status: "cancelled" } });
    return { success: true };
  },
});

/** Participant: mark a consultation completed. */
export const completeConsultation = mutation({
  args: { consultationId: v.id("consultations") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const consultation = await verifyConsultationAccess(ctx, args.consultationId, userId);
    if (consultation.status === "cancelled") {
      throw new Error("A cancelled consultation cannot be completed");
    }
    await ctx.db.patch(args.consultationId, { status: "completed", updatedAt: Date.now() });
    await createAuditLog(ctx, { userId, action: "complete", resource: "consultations", resourceId: args.consultationId, changes: { status: "completed" } });
    return { success: true };
  },
});

/** Farmer only: rate a completed consultation. */
export const rateConsultation = mutation({
  args: {
    consultationId: v.id("consultations"),
    rating: v.number(),
    review: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }
    const consultation = await verifyConsultationAccess(ctx, args.consultationId, userId);
    if (consultation.farmerId !== userId) {
      throw new Error("Only the booking farmer can rate this consultation");
    }
    if (consultation.status !== "completed") {
      throw new Error("Only completed consultations can be rated");
    }
    await ctx.db.patch(args.consultationId, {
      farmerRating: args.rating,
      farmerReview: args.review ? sanitizeInput(args.review).slice(0, 1000) : undefined,
      updatedAt: Date.now(),
    });
    await createAuditLog(ctx, { userId, action: "rate", resource: "consultations", resourceId: args.consultationId, changes: { rating: args.rating } });
    return { success: true };
  },
});
