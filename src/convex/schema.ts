import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// ============================================================
// FarmBond - AI-Powered Smart Farming Platform
// Convex Database Schema
// ============================================================

// User roles
export const ROLES = {
  FARMER: "farmer",
  AGRONOMIST: "agronomist",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.FARMER),
  v.literal(ROLES.AGRONOMIST),
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.SUPER_ADMIN),
);
export type Role = Infer<typeof roleValidator>;

// Subscription tiers (single $5/month plan)
export const SUBSCRIPTION_TIERS = {
  FREE: "free",
  PRO: "pro",
} as const;

export const SUBSCRIPTION_PRICE = 5; // $5/month

export const subscriptionTierValidator = v.union(
  v.literal(SUBSCRIPTION_TIERS.FREE),
  v.literal(SUBSCRIPTION_TIERS.PRO),
);
export type SubscriptionTier = Infer<typeof subscriptionTierValidator>;

// Farm status
export const FARM_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  HARVESTING: "harvesting",
  PLANTING: "planting",
} as const;

export const farmStatusValidator = v.union(
  v.literal(FARM_STATUS.ACTIVE),
  v.literal(FARM_STATUS.INACTIVE),
  v.literal(FARM_STATUS.HARVESTING),
  v.literal(FARM_STATUS.PLANTING),
);

// Crop status
export const CROP_STATUS = {
  SEEDLING: "seedling",
  GROWING: "growing",
  FLOWERING: "flowering",
  FRUITING: "fruiting",
  HARVEST_READY: "harvest_ready",
  HARVESTED: "harvested",
  FAILED: "failed",
} as const;

export const cropStatusValidator = v.union(
  v.literal(CROP_STATUS.SEEDLING),
  v.literal(CROP_STATUS.GROWING),
  v.literal(CROP_STATUS.FLOWERING),
  v.literal(CROP_STATUS.FRUITING),
  v.literal(CROP_STATUS.HARVEST_READY),
  v.literal(CROP_STATUS.HARVESTED),
  v.literal(CROP_STATUS.FAILED),
);

// Livestock status
export const LIVESTOCK_STATUS = {
  HEALTHY: "healthy",
  SICK: "sick",
  PREGNANT: "pregnant",
  QUARANTINE: "quarantine",
} as const;

export const livestockStatusValidator = v.union(
  v.literal(LIVESTOCK_STATUS.HEALTHY),
  v.literal(LIVESTOCK_STATUS.SICK),
  v.literal(LIVESTOCK_STATUS.PREGNANT),
  v.literal(LIVESTOCK_STATUS.QUARANTINE),
);

// Transaction types
export const TRANSACTION_TYPE = {
  INCOME: "income",
  EXPENSE: "expense",
} as const;

export const transactionTypeValidator = v.union(
  v.literal(TRANSACTION_TYPE.INCOME),
  v.literal(TRANSACTION_TYPE.EXPENSE),
);

// Ticket status
export const TICKET_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
} as const;

export const ticketStatusValidator = v.union(
  v.literal(TICKET_STATUS.OPEN),
  v.literal(TICKET_STATUS.IN_PROGRESS),
  v.literal(TICKET_STATUS.RESOLVED),
  v.literal(TICKET_STATUS.CLOSED),
);

const schema = defineSchema(
  {
    // ============================================================
    // AUTH TABLES (do not remove)
    // ============================================================
    ...authTables,

    // ============================================================
    // USERS TABLE
    // ============================================================
    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      
      // FarmBond-specific user fields
      phone: v.optional(v.string()),
      country: v.optional(v.string()),
      language: v.optional(v.string()),
      currency: v.optional(v.string()),
      timezone: v.optional(v.string()),
      units: v.optional(v.union(v.literal("metric"), v.literal("imperial"))),
      theme: v.optional(v.string()),
      
      // Subscription
      subscriptionTier: v.optional(subscriptionTierValidator),
      subscriptionStartDate: v.optional(v.number()),
      subscriptionEndDate: v.optional(v.number()),
      trialEndDate: v.optional(v.number()), // 7-day free trial expiry
      paymentMethodVerified: v.optional(v.boolean()), // Payment method on file
      lastPaymentMethodReminder: v.optional(v.number()), // Last time we sent payment reminder
      
      // Stripe Integration
      stripeCustomerId: v.optional(v.string()), // Stripe customer ID
      stripeSubscriptionId: v.optional(v.string()), // Stripe subscription ID
      stripePriceId: v.optional(v.string()), // Stripe price ID
      stripeCurrentPeriodEnd: v.optional(v.number()), // Current billing period end
      paymentFailedAt: v.optional(v.number()), // Last payment failure timestamp
      paymentFailureCount: v.optional(v.number()), // Number of consecutive payment failures
      
      // Profile
      bio: v.optional(v.string()),
      location: v.optional(v.string()),
      farmSize: v.optional(v.number()), // hectares
      experience: v.optional(v.string()), // years of farming
      
      // Agronomist-specific fields
      specialties: v.optional(v.array(v.string())),
      certifications: v.optional(v.array(v.string())),
      hourlyRate: v.optional(v.number()),
      rating: v.optional(v.number()),
      totalConsultations: v.optional(v.number()),
      
      // Metadata
      lastActiveAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("email", ["email"])
      .index("role", ["role"])
      .index("country", ["country"])
      .index("subscription", ["subscriptionTier"]),

    // ============================================================
    // FARMS TABLE
    // ============================================================
    farms: defineTable({
      userId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      location: v.object({
        latitude: v.number(),
        longitude: v.number(),
        address: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        country: v.optional(v.string()),
      }),
      size: v.number(), // in hectares
      sizeUnit: v.union(v.literal("hectares"), v.literal("acres")),
      status: farmStatusValidator,
      
      // Soil information
      soilType: v.optional(v.string()),
      soilPh: v.optional(v.number()),
      
      // Water sources
      waterSources: v.optional(v.array(v.string())),
      irrigationType: v.optional(v.string()),
      
      // Images
      images: v.optional(v.array(v.string())),
      coverImage: v.optional(v.string()),
      
      // Satellite monitoring
      lastSatelliteScan: v.optional(v.number()),
      ndviScore: v.optional(v.number()), // 0-100 vegetation index
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_location", ["location.latitude", "location.longitude"]),

    // ============================================================
    // CROPS TABLE
    // ============================================================
    crops: defineTable({
      farmId: v.id("farms"),
      userId: v.id("users"),
      name: v.string(),
      variety: v.optional(v.string()),
      type: v.string(), // e.g., "vegetable", "fruit", "grain", "legume"
      
      // Planting details
      plantingDate: v.number(),
      expectedHarvestDate: v.optional(v.number()),
      actualHarvestDate: v.optional(v.number()),
      quantity: v.number(), // in kg or units
      unit: v.string(), // "kg", "tons", "bunches", etc.
      
      // Status
      status: cropStatusValidator,
      healthScore: v.optional(v.number()), // 0-100
      
      // Location on farm
      plotNumber: v.optional(v.string()),
      coordinates: v.optional(v.object({
        latitude: v.number(),
        longitude: v.number(),
      })),
      
      // Yield tracking
      expectedYield: v.optional(v.number()),
      actualYield: v.optional(v.number()),
      
      // Costs
      seedCost: v.optional(v.number()),
      fertilizerCost: v.optional(v.number()),
      laborCost: v.optional(v.number()),
      otherCosts: v.optional(v.number()),
      
      // Images
      images: v.optional(v.array(v.string())),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_farm", ["farmId"])
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_type", ["type"])
      .index("by_planting_date", ["plantingDate"]),

    // ============================================================
    // LIVESTOCK TABLE
    // ============================================================
    livestock: defineTable({
      farmId: v.id("farms"),
      userId: v.id("users"),
      name: v.string(),
      type: v.string(), // "cattle", "poultry", "goat", "sheep", "pig", etc.
      breed: v.optional(v.string()),
      
      // Quantity
      quantity: v.number(),
      unit: v.string(), // "head", "birds", etc.
      
      // Status
      status: livestockStatusValidator,
      healthScore: v.optional(v.number()), // 0-100
      
      // Birth/acquisition
      dateOfBirth: v.optional(v.number()),
      acquisitionDate: v.number(),
      acquisitionCost: v.optional(v.number()),
      
      // Production
      productionType: v.optional(v.string()), // "meat", "milk", "eggs", "wool"
      productionQuantity: v.optional(v.number()),
      productionUnit: v.optional(v.string()),
      
      // Feeding
      feedType: v.optional(v.string()),
      dailyFeedCost: v.optional(v.number()),
      
      // Health records
      lastVaccination: v.optional(v.number()),
      nextVaccination: v.optional(v.number()),
      lastCheckup: v.optional(v.number()),
      
      // Medical history
      medicalHistory: v.optional(v.array(v.object({
        date: v.number(),
        description: v.string(),
        treatment: v.string(),
        cost: v.optional(v.number()),
        vaccineType: v.optional(v.string()), // e.g. "FMD", "Anthrax", "Brucellosis"
      }))),
      
      // Images
      images: v.optional(v.array(v.string())),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_farm", ["farmId"])
      .index("by_user", ["userId"])
      .index("by_type", ["type"])
      .index("by_status", ["status"]),

    // ============================================================
    // WEATHER DATA TABLE (cached)
    // ============================================================
    weatherData: defineTable({
      farmId: v.id("farms"),
      latitude: v.number(),
      longitude: v.number(),
      
      // Current conditions
      temperature: v.number(),
      humidity: v.number(),
      windSpeed: v.number(),
      windDirection: v.optional(v.number()),
      precipitation: v.number(),
      cloudCover: v.optional(v.number()),
      uvIndex: v.optional(v.number()),
      pressure: v.optional(v.number()),
      
      // Forecast
      forecast: v.optional(v.array(v.object({
        date: v.number(),
        tempHigh: v.number(),
        tempLow: v.number(),
        precipitation: v.number(),
        humidity: v.number(),
        windSpeed: v.number(),
        condition: v.string(),
      }))),
      
      // Alerts
      alerts: v.optional(v.array(v.object({
        type: v.string(),
        severity: v.string(),
        message: v.string(),
        startTime: v.number(),
        endTime: v.number(),
      }))),
      
      // Soil data
      soil: v.optional(v.object({
        temperature0cm: v.number(),
        temperature6cm: v.number(),
        moisture0to1cm: v.number(),
        moisture1to3cm: v.number(),
        moisture3to9cm: v.number(),
        et0FaoEvapotranspiration: v.number(),
      })),
      
      // Metadata
      fetchedAt: v.number(),
      expiresAt: v.number(),
    })
      .index("by_farm", ["farmId"])
      .index("by_location", ["latitude", "longitude"])
      .index("by_expires", ["expiresAt"]),

    // ============================================================
    // AI CHAT HISTORY TABLE
    // ============================================================
    aiChats: defineTable({
      userId: v.id("users"),
      farmId: v.optional(v.id("farms")),
      
      // Chat metadata
      title: v.string(),
      context: v.optional(v.string()), // "crop_health", "weather", "general", etc.
      
      // Messages
      messages: v.array(v.object({
        id: v.string(),
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        timestamp: v.number(),
        metadata: v.optional(v.any()), // for AI response metadata
      })),
      
      // Token usage (for premium tracking)
      tokensUsed: v.number(),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_farm", ["farmId"])
      .index("by_context", ["context"]),

    // ============================================================
    // TRANSACTIONS TABLE (Income/Expenses)
    // ============================================================
    transactions: defineTable({
      userId: v.id("users"),
      farmId: v.id("farms"),
      cropId: v.optional(v.id("crops")),
      livestockId: v.optional(v.id("livestock")),
      
      // Transaction details
      type: transactionTypeValidator,
      category: v.string(), // "seeds", "fertilizer", "labor", "equipment", "harvest_sale", etc.
      description: v.string(),
      amount: v.number(),
      currency: v.string(),
      
      // Date
      date: v.number(),
      
      // Payment method
      paymentMethod: v.optional(v.string()), // "cash", "mobile_money", "bank_transfer", etc.
      
      // Receipt/invoice
      receiptUrl: v.optional(v.string()),
      invoiceNumber: v.optional(v.string()),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_farm", ["farmId"])
      .index("by_type", ["type"])
      .index("by_date", ["date"])
      .index("by_category", ["category"]),

    // ============================================================
    // MARKET PRICES TABLE
    // ============================================================
    marketPrices: defineTable({
      cropType: v.string(),
      variety: v.optional(v.string()),
      country: v.string(),
      region: v.optional(v.string()),
      
      // Price data
      price: v.number(),
      currency: v.string(),
      unit: v.string(), // "per kg", "per ton", etc.
      
      // Trend
      trend: v.union(v.literal("up"), v.literal("down"), v.literal("stable")),
      changePercent: v.optional(v.number()),
      
      // Source
      source: v.string(),
      
      // Date
      recordedAt: v.number(),
    })
      .index("by_crop", ["cropType"])
      .index("by_country", ["country"])
      .index("by_recorded", ["recordedAt"]),

    // ============================================================
    // AGRONOMIST PROFILES TABLE
    // ============================================================
    agronomistProfiles: defineTable({
      userId: v.id("users"),
      
      // Professional info
      title: v.string(), // "Agronomist", "Soil Scientist", etc.
      specializations: v.array(v.string()),
      experience: v.number(), // years
      education: v.optional(v.array(v.object({
        degree: v.string(),
        institution: v.string(),
        year: v.number(),
      }))),
      
      // Service offerings
      services: v.array(v.object({
        name: v.string(),
        description: v.string(),
        price: v.number(),
        duration: v.number(), // minutes
        type: v.union(v.literal("chat"), v.literal("video"), v.literal("field_visit")),
      })),
      
      // Availability
      availableDays: v.array(v.string()), // ["monday", "tuesday", etc.]
      availableHours: v.object({
        start: v.string(), // "09:00"
        end: v.string(), // "17:00"
      }),
      timezone: v.string(),
      
      // Ratings
      averageRating: v.number(),
      totalReviews: v.number(),
      totalConsultations: v.number(),
      
      // Portfolio
      portfolio: v.optional(v.array(v.object({
        title: v.string(),
        description: v.string(),
        imageUrl: v.optional(v.string()),
      }))),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_rating", ["averageRating"])
      .index("by_specializations", ["specializations"]),

    // ============================================================
    // CONSULTATIONS TABLE
    // ============================================================
    consultations: defineTable({
      farmerId: v.id("users"),
      agronomistId: v.id("users"),
      farmId: v.optional(v.id("farms")),
      
      // Booking details
      serviceType: v.string(),
      scheduledAt: v.number(),
      duration: v.number(), // minutes
      status: v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      
      // Communication
      meetingUrl: v.optional(v.string()),
      notes: v.optional(v.string()),
      
      // Payment
      amount: v.number(),
      currency: v.string(),
      paymentStatus: v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("refunded"),
      ),
      
      // Rating
      farmerRating: v.optional(v.number()),
      farmerReview: v.optional(v.string()),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_farmer", ["farmerId"])
      .index("by_agronomist", ["agronomistId"])
      .index("by_status", ["status"])
      .index("by_scheduled", ["scheduledAt"]),

    // ============================================================
    // COMMUNITY POSTS TABLE
    // ============================================================
    communityPosts: defineTable({
      userId: v.id("users"),
      
      // Content
      title: v.string(),
      content: v.string(),
      category: v.string(), // "general", "crop_health", "market", "tips", etc.
      tags: v.optional(v.array(v.string())),
      
      // Media
      images: v.optional(v.array(v.string())),
      
      // Engagement
      likes: v.number(),
      comments: v.number(),
      shares: v.number(),
      
      // Moderation
      isApproved: v.boolean(),
      isPinned: v.boolean(),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_category", ["category"])
      .index("by_created", ["createdAt"])
      .index("by_approved", ["isApproved"]),

    // ============================================================
    // COMMUNITY COMMENTS TABLE
    // ============================================================
    communityComments: defineTable({
      postId: v.id("communityPosts"),
      userId: v.id("users"),
      
      content: v.string(),
      likes: v.number(),
      
      // For nested comments
      parentCommentId: v.optional(v.id("communityComments")),
      
      // Moderation
      isApproved: v.boolean(),
      
      // Metadata
      createdAt: v.number(),
    })
      .index("by_post", ["postId"])
      .index("by_user", ["userId"])
      .index("by_parent", ["parentCommentId"]),

    // ============================================================
    // NOTIFICATIONS TABLE
    // ============================================================
    notifications: defineTable({
      userId: v.id("users"),
      
      // Content
      title: v.string(),
      message: v.string(),
      type: v.string(), // "weather_alert", "crop_update", "ai_suggestion", "system", etc.
      
      // Action
      actionUrl: v.optional(v.string()),
      actionLabel: v.optional(v.string()),
      
      // Status
      isRead: v.boolean(),
      
      // Metadata
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_read", ["isRead"])
      .index("by_created", ["createdAt"]),

    // ============================================================
    // SUPPORT TICKETS TABLE
    // ============================================================
    supportTickets: defineTable({
      userId: v.id("users"),
      
      // Ticket details
      subject: v.string(),
      description: v.string(),
      category: v.string(), // "technical", "billing", "feature_request", etc.
      priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
      status: ticketStatusValidator,
      
      // Assignment
      assignedTo: v.optional(v.id("users")),
      
      // Messages
      messages: v.array(v.object({
        senderId: v.id("users"),
        content: v.string(),
        timestamp: v.number(),
        attachments: v.optional(v.array(v.string())),
      })),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_priority", ["priority"])
      .index("by_created", ["createdAt"]),

    // ============================================================
    // ANNOUNCEMENTS TABLE (Admin)
    // ============================================================
    announcements: defineTable({
      title: v.string(),
      content: v.string(),
      type: v.string(), // "maintenance", "feature", "policy", etc.
      
      // Targeting
      targetRoles: v.array(v.string()), // roles to show to
      targetCountries: v.optional(v.array(v.string())),
      
      // Schedule
      startDate: v.number(),
      endDate: v.number(),
      
      // Metadata
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_dates", ["startDate", "endDate"])
      .index("by_type", ["type"]),

    // ============================================================
    // AUDIT LOGS TABLE (Admin)
    // ============================================================
    auditLogs: defineTable({
      userId: v.id("users"),
      
      // Action details
      action: v.string(), // "user_created", "subscription_changed", etc.
      resource: v.string(), // "users", "farms", etc.
      resourceId: v.string(),
      
      // Change details
      changes: v.optional(v.any()),
      
      // Metadata
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_action", ["action"])
      .index("by_resource", ["resource"])
      .index("by_created", ["createdAt"]),

    // ============================================================
    // KNOWLEDGE ARTICLES TABLE (Agronomist)
    // ============================================================
    knowledgeArticles: defineTable({
      authorId: v.id("users"),
      
      // Content
      title: v.string(),
      summary: v.string(),
      content: v.string(),
      category: v.string(),
      tags: v.array(v.string()),
      
      // Media
      coverImage: v.optional(v.string()),
      images: v.optional(v.array(v.string())),
      
      // Engagement
      views: v.number(),
      likes: v.number(),
      bookmarks: v.number(),
      
      // Status
      isPublished: v.boolean(),
      isFeatured: v.boolean(),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
      publishedAt: v.optional(v.number()),
    })
      .index("by_author", ["authorId"])
      .index("by_category", ["category"])
      .index("by_published", ["isPublished"])
      .index("by_featured", ["isFeatured"])
      .index("by_views", ["views"]),

    // ============================================================
    // IRRIGATION SCHEDULES TABLE
    // ============================================================
    irrigationSchedules: defineTable({
      farmId: v.id("farms"),
      userId: v.id("users"),
      cropId: v.optional(v.id("crops")),
      
      // Schedule details
      name: v.string(),
      frequency: v.string(), // "daily", "alternate_days", "weekly", "custom"
      customDays: v.optional(v.array(v.number())), // 0-6 for days of week
      
      // Timing
      startTime: v.string(), // "06:00"
      duration: v.number(), // minutes
      
      // Water
      waterAmount: v.number(), // liters per session
      waterSource: v.optional(v.string()),
      
      // Status
      isActive: v.boolean(),
      lastRunAt: v.optional(v.number()),
      nextRunAt: v.number(),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_farm", ["farmId"])
      .index("by_user", ["userId"])
      .index("by_crop", ["cropId"])
      .index("by_next_run", ["nextRunAt"]),

    // ============================================================
    // PLANTING/HARVEST CALENDARS TABLE
    // ============================================================
    farmCalendar: defineTable({
      userId: v.id("users"),
      farmId: v.id("farms"),
      cropId: v.optional(v.id("crops")),
      
      // Event details
      title: v.string(),
      description: v.optional(v.string()),
      eventType: v.union(
        v.literal("planting"),
        v.literal("harvesting"),
        v.literal("fertilizing"),
        v.literal("pest_control"),
        v.literal("irrigation"),
        v.literal("vaccination"),
        v.literal("other"),
      ),
      
      // Schedule
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isRecurring: v.boolean(),
      recurringPattern: v.optional(v.string()),
      
      // Status
      isCompleted: v.boolean(),
      
      // Reminders
      reminderDaysBefore: v.optional(v.number()),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_farm", ["farmId"])
      .index("by_event_type", ["eventType"])
      .index("by_start_date", ["startDate"]),

    // ============================================================
    // MESSAGES TABLE (Farmer-Agronomist)
    // ============================================================
    messages: defineTable({
      conversationId: v.string(),
      senderId: v.id("users"),
      receiverId: v.id("users"),
      
      content: v.string(),
      type: v.union(v.literal("text"), v.literal("image"), v.literal("file")),
      
      // For file/image messages
      fileUrl: v.optional(v.string()),
      fileName: v.optional(v.string()),
      
      // Status
      isRead: v.boolean(),
      readAt: v.optional(v.number()),
      
      // Metadata
      createdAt: v.number(),
    })
      .index("by_conversation", ["conversationId"])
      .index("by_sender", ["senderId"])
      .index("by_receiver", ["receiverId"])
      .index("by_created", ["createdAt"]),

    // ============================================================
    // YIELD PREDICTIONS TABLE (AI-generated)
    // ============================================================
    yieldPredictions: defineTable({
      cropId: v.id("crops"),
      userId: v.id("users"),
      farmId: v.id("farms"),
      
      // Prediction
      predictedYield: v.number(),
      unit: v.string(),
      confidence: v.number(), // 0-100
      
      // Factors
      factors: v.array(v.object({
        name: v.string(),
        impact: v.number(), // -100 to 100
        description: v.string(),
      })),
      
      // Weather impact
      weatherImpact: v.optional(v.number()),
      
      // Metadata
      generatedAt: v.number(),
      validUntil: v.number(),
    })
      .index("by_crop", ["cropId"])
      .index("by_user", ["userId"])
      .index("by_farm", ["farmId"]),

    // ============================================================
    // DISEASE/PEST DETECTION RESULTS TABLE
    // ============================================================
    detectionResults: defineTable({
      userId: v.id("users"),
      farmId: v.optional(v.id("farms")),
      cropId: v.optional(v.id("crops")),
      
      // Detection details
      type: v.union(v.literal("disease"), v.literal("pest")),
      name: v.string(),
      confidence: v.number(), // 0-100
      
      // Image
      imageUrl: v.string(),
      
      // Analysis
      description: v.string(),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
      
      // Recommendations
      recommendations: v.array(v.string()),
      
      // Metadata
      detectedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_farm", ["farmId"])
      .index("by_type", ["type"])
      .index("by_detected", ["detectedAt"]),

    // ============================================================
    // ADS & PROMOTIONS TABLE
    // ============================================================
    ads: defineTable({
      // Ad content
      title: v.string(),
      description: v.string(),
      imageUrl: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      
      // Ad type: "pro_upgrade" (internal), "sponsor" (third-party), "seasonal" (promo), "cross_sell" (other services)
      adType: v.union(
        v.literal("pro_upgrade"),
        v.literal("sponsor"),
        v.literal("seasonal"),
        v.literal("cross_sell"),
      ),
      
      // Display settings
      priority: v.number(), // Higher = shown more often
      maxImpressionsPerUser: v.number(), // Max times a user sees this ad
      impressionCooldownDays: v.number(), // Days between impressions for same user
      
      // Targeting
      targetRoles: v.array(v.string()), // Roles to show to, empty = all
      targetCountries: v.optional(v.array(v.string())), // Countries, empty = all
      targetSubscriptionTiers: v.array(v.string()), // Subscription tiers to target
      
      // Link
      ctaText: v.string(), // "Learn More", "Upgrade Now", "Visit Website", etc.
      ctaUrl: v.string(), // URL to navigate to
      
      // Sponsor details (for third-party ads)
      sponsorName: v.optional(v.string()),
      sponsorWebsite: v.optional(v.string()),
      
      // Status
      isActive: v.boolean(),
      
      // Schedule
      startDate: v.number(),
      endDate: v.number(),
      
      // Stats
      totalImpressions: v.number(),
      totalClicks: v.number(),
      
      // Metadata
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_active", ["isActive"])
      .index("by_type", ["adType"])
      .index("by_dates", ["startDate", "endDate"])
      .index("by_priority", ["priority"]),

    // ============================================================
    // AD IMPRESSIONS TABLE (Track per-user impressions)
    // ============================================================
    adImpressions: defineTable({
      adId: v.id("ads"),
      userId: v.id("users"),
      
      // Impression details
      impressionCount: v.number(),
      lastImpressionAt: v.number(),
      clickCount: v.number(),
      lastClickAt: v.optional(v.number()),
      
      // Metadata
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_ad_user", ["adId", "userId"])
      .index("by_user", ["userId"]),

    // ============================================================
    // MOBILE MONEY TRANSACTIONS TABLE (MTN MoMo & Airtel Money)
    // ============================================================
    mobileMoneyTransactions: defineTable({
      userId: v.id("users"),
      
      // Provider info
      provider: v.string(), // "mtn_momo" or "airtel_money"
      referenceId: v.string(), // Provider reference ID
      externalId: v.string(), // Internal reference
      
      // Transaction details
      amount: v.number(),
      currency: v.string(),
      phoneNumber: v.string(),
      countryCode: v.optional(v.string()),
      
      // Status
      status: v.string(), // "pending", "completed", "failed", "expired"
      
      // Provider response
      providerResponse: v.optional(v.any()),
      
      // Description
      description: v.optional(v.string()),
      
      // Timestamps
      completedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_reference", ["referenceId"])
      .index("by_status", ["status"])
      .index("by_provider", ["provider"])
      .index("by_created", ["createdAt"]),
    // ============================================================

    // ============================================================
    // AGRICULTURAL COMPANIES TABLE
    // ============================================================
    agriculturalCompanies: defineTable({
      name: v.string(),
      category: v.string(), // "seeds", "fertilizer", "equipment", "services"
      description: v.string(),
      logoUrl: v.optional(v.string()),
      coverImage: v.optional(v.string()),
      location: v.string(),
      country: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      website: v.optional(v.string()),
      products: v.array(v.string()),
      rating: v.number(),
      reviewCount: v.number(),
      verified: v.boolean(),
      featured: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_category", ["category"])
      .index("by_country", ["country"])
      .index("by_rating", ["rating"])
      .index("by_verified", ["verified"]),

    // ============================================================
    // SEED SHOWCASE TABLE
    // ============================================================
    seeds: defineTable({
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
      rating: v.number(),
      reviewCount: v.number(),
      germinationRate: v.number(), // percentage
      maturityDays: v.number(),
      yieldPerHectare: v.string(),
      waterNeeds: v.string(),
      climate: v.array(v.string()),
      season: v.array(v.string()),
      inStock: v.boolean(),
      featured: v.boolean(),
      tags: v.array(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_crop_type", ["cropType"])
      .index("by_company", ["company"])
      .index("by_price", ["price"])
      .index("by_featured", ["featured"])
      .index("by_in_stock", ["inStock"]),

    // ============================================================
    // USER BOOKMARKS TABLE
    // ============================================================
    userBookmarks: defineTable({
      userId: v.id("users"),
      articleId: v.id("knowledgeArticles"),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_article", ["articleId"])
      .index("by_user_article", ["userId", "articleId"]),

    // ============================================================
    // COMMUNITY LIKES TABLE (per-user like tracking)
    // ============================================================
    communityLikes: defineTable({
      postId: v.id("communityPosts"),
      userId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_post", ["postId"])
      .index("by_user", ["userId"])
      .index("by_post_user", ["postId", "userId"]),

    // ============================================================
    // FARMING EVENTS TABLE (public events, trainings, expos)
    // ============================================================
    farmingEvents: defineTable({
      title: v.string(),
      type: v.union(
        v.literal("training"),
        v.literal("expo"),
        v.literal("workshop"),
        v.literal("sponsored"),
      ),
      description: v.string(),
      location: v.string(),
      startDate: v.number(),
      endDate: v.number(),
      time: v.string(),
      organizer: v.string(),
      attendees: v.number(),
      maxCapacity: v.number(),
      ticketPrice: v.string(),
      sponsored: v.boolean(),
      sponsorName: v.optional(v.string()),
      tags: v.array(v.string()),
      imageUrl: v.optional(v.string()),
      isActive: v.boolean(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_type", ["type"])
      .index("by_start_date", ["startDate"])
      .index("by_active", ["isActive"]),

    // ============================================================
    // EVENT REGISTRATIONS TABLE
    // ============================================================
    eventRegistrations: defineTable({
      eventId: v.id("farmingEvents"),
      userId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_event", ["eventId"])
      .index("by_user", ["userId"])
      .index("by_event_user", ["eventId", "userId"]),

    // INTELLIGENCE ENGINE TABLES
    // ============================================================

    // Satellite imagery data cache
    satelliteData: defineTable({
      farmId: v.id("farms"),
      userId: v.id("users"),

      // NDVI data
      ndvi: v.optional(v.number()), // 0-1 NDVI value
      ndviClass: v.optional(v.string()), // "bare_soil", "sparse", "moderate", "dense", "very_dense"

      // Vegetation indices
      evi: v.optional(v.number()), // Enhanced Vegetation Index
      savi: v.optional(v.number()), // Soil Adjusted Vegetation Index
      ndwi: v.optional(v.number()), // Normalized Difference Water Index

      // Field analysis
      vegetationCoverage: v.optional(v.number()), // percentage
      stressAreas: v.optional(v.array(v.object({
        latitude: v.number(),
        longitude: v.number(),
        severity: v.string(),
        type: v.string(),
      }))),

      // Water bodies
      waterBodies: v.optional(v.number()), // detected water bodies count

      // Growth stage estimation
      growthStage: v.optional(v.string()),
      growthConfidence: v.optional(v.number()),

      // Image references
      imageUrl: v.optional(v.string()),
      thumbnailUrl: v.optional(v.string()),

      // Metadata
      capturedAt: v.number(),
      timestamp: v.number(),
      fetchedAt: v.number(),
    })
      .index("by_farm", ["farmId"])
      .index("by_user", ["userId"])
      .index("by_farm_time", ["farmId", "timestamp"]),

    // Soil intelligence data cache (from SoilGrids)
    soilData: defineTable({
      farmId: v.id("farms"),
      userId: v.id("users"),

      // Basic properties
      ph: v.number(),
      organicMatter: v.number(), // percentage
      nitrogen: v.number(), // percentage
      phosphorus: v.number(), // mg/kg
      potassium: v.number(), // mg/kg

      // Physical properties
      soilMoisture: v.number(), // percentage
      drainage: v.string(),
      texture: v.string(),
      fertility: v.string(),

      // Depth profiles
      phDepth15cm: v.optional(v.number()),
      phDepth30cm: v.optional(v.number()),
      organicMatterDepth15cm: v.optional(v.number()),

      // Carbon
      organicCarbon: v.optional(v.number()),

      // CEC (Cation Exchange Capacity)
      cec: v.optional(v.number()),

      // Recommendations generated from soil data
      recommendations: v.optional(v.array(v.object({
        issue: v.string(),
        action: v.string(),
        priority: v.string(),
      }))),

      // Metadata
      source: v.string(), // "soilgrids", "lab_test", "estimated"
      fetchedAt: v.number(),
    })
      .index("by_farm", ["farmId"])
      .index("by_user", ["userId"]),

    // Intelligence data entries (central intelligence log)
    intelligenceData: defineTable({
      userId: v.id("users"),
      farmId: v.id("farms"),

      // Source classification
      source: v.string(), // "weather", "satellite", "soil", "market", "crop", "livestock", "financial"
      dataType: v.string(),

      // Content
      title: v.string(),
      summary: v.string(),
      details: v.optional(v.any()),

      // Scoring
      confidence: v.number(), // 0-100
      impact: v.string(), // "positive", "negative", "neutral"
      severity: v.string(), // "low", "medium", "high", "critical"

      // Actions triggered
      actionsTriggered: v.optional(v.array(v.string())),

      // Expiry
      expiresAt: v.number(),

      // Metadata
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_farm", ["farmId"])
      .index("by_source", ["source"])
      .index("by_farm_source", ["farmId", "source"]),

    // Market intelligence cache
    marketInsights: defineTable({
      cropType: v.string(),
      region: v.optional(v.string()),

      // Price data
      currentPrice: v.number(),
      minPrice: v.number(),
      maxPrice: v.number(),
      unit: v.string(),
      currency: v.string(),

      // Trend analysis
      trend: v.union(v.literal("up"), v.literal("down"), v.literal("stable")),
      changePercent: v.number(),

      // Insights
      insight: v.string(),
      recommendation: v.string(),

      // Source
      source: v.string(),

      // Metadata
      fetchedAt: v.number(),
    })
      .index("by_crop", ["cropType"])
      .index("by_fetched", ["fetchedAt"]),

    // Farm health scores (computed by intelligence engine)
    farmHealthScores: defineTable({
      farmId: v.id("farms"),
      userId: v.id("users"),

      // Component scores (0-100)
      overall: v.number(),
      cropHealth: v.number(),
      livestockHealth: v.number(),
      soilHealth: v.number(),
      weatherRisk: v.number(),
      financialHealth: v.number(),
      satelliteHealth: v.number(),

      // Risk assessment
      riskLevel: v.string(), // "low", "medium", "high", "critical"
      riskFactors: v.optional(v.array(v.string())),

      // Trend
      trend: v.string(), // "improving", "stable", "declining"
      previousScore: v.optional(v.number()),

      // Metadata
      computedAt: v.number(),
    })
      .index("by_farm", ["farmId"])
      .index("by_user", ["userId"]),

    // Weekly AI reports
    weeklyReports: defineTable({
      userId: v.id("users"),
      farmId: v.id("farms"),

      // Report period
      weekStart: v.number(),
      weekEnd: v.number(),

      // Sections
      farmHealthSummary: v.string(),
      cropProgress: v.string(),
      livestockStatus: v.string(),
      weatherSummary: v.string(),
      soilInsights: v.optional(v.string()),
      satelliteObservations: v.optional(v.string()),
      marketTrends: v.optional(v.string()),
      financialPerformance: v.string(),

      // Tasks
      tasksCompleted: v.number(),
      tasksUpcoming: v.number(),

      // AI Recommendations
      recommendations: v.array(v.object({
        category: v.string(),
        title: v.string(),
        description: v.string(),
        priority: v.string(),
        confidence: v.number(),
      })),

      // Risk analysis
      riskAnalysis: v.string(),
      riskScore: v.number(), // 0-100

      // Overall score
      healthScore: v.number(),

      // PDF export
      pdfUrl: v.optional(v.string()),

      // Metadata
      generatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_farm", ["farmId"])
      .index("by_week", ["weekStart"]),

  },
  {
    schemaValidation: false,
  },
);

export default schema;
