import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAdmin, createAuditLog, requireActiveSubscription } from "./authHelpers";

// ============================================================
// Agronomist Marketplace Module
// ============================================================

/** List all agronomist profiles with optional filtering */
export const listAgronomists = query({
  args: {
    specialization: v.optional(v.string()),
    available: v.optional(v.boolean()),
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

    if (!profile) return null;

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
// Agricultural Companies Module
// ============================================================

/** List all agricultural companies with optional filtering */
export const listCompanies = query({
  args: {
    category: v.optional(v.string()),
    country: v.optional(v.string()),
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
    return await ctx.db.get(args.companyId);
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

    let filtered = seeds;
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
    return await ctx.db.get(args.seedId);
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

    const now = Date.now();
    const id = await ctx.db.insert("consultations", {
      farmerId: userId,
      agronomistId: args.agronomistId,
      farmId: args.farmId,
      serviceType: args.serviceType,
      scheduledAt: args.scheduledAt,
      duration: args.duration,
      status: "pending",
      notes: args.notes,
      amount: 0,
      currency: "KES",
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await createAuditLog(ctx, { userId, action: "create", resource: "consultations", resourceId: id, changes: { agronomistId: args.agronomistId, serviceType: args.serviceType } });
    return id;
  },
});

/** List user's consultations */
export const listUserConsultations = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const consultations = await ctx.db
      .query("consultations")
      .withIndex("by_farmer", (q) => q.eq("farmerId", userId))
      .order("desc")
      .collect();

    // Join with agronomist user data for display
    const results = await Promise.all(
      consultations.map(async (c) => {
        const agronomist = await ctx.db.get(c.agronomistId);
        return {
          ...c,
          agronomistName: agronomist?.name ?? "Unknown",
          agronomistImage: agronomist?.image ?? null,
        };
      })
    );

    return results;
  },
});
