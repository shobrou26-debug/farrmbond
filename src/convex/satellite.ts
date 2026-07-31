import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { requireAuth } from "./authHelpers";

// ============================================================
// Satellite Intelligence Module
// ============================================================

/** Get satellite analysis for a farm */
export const getSatelliteAnalysis = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    // Get latest satellite data
    const satelliteData = await ctx.db
      .query("satelliteData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    // Get historical data for trends
    const historicalData = await ctx.db
      .query("satelliteData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .take(12);

    // Calculate NDVI trend
    const ndviTrend = historicalData.map((d: any) => ({
      date: d.timestamp,
      ndvi: d.ndvi ?? 0,
      label: new Date(d.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));

    // Get current vegetation health status
    const currentNDVI = satelliteData?.ndvi ?? 0;
    let healthStatus: string;
    let healthColor: string;

    if (currentNDVI >= 0.7) {
      healthStatus = "Excellent";
      healthColor = "text-green-600";
    } else if (currentNDVI >= 0.5) {
      healthStatus = "Good";
      healthColor = "text-blue-600";
    } else if (currentNDVI >= 0.3) {
      healthStatus = "Moderate";
      healthColor = "text-amber-600";
    } else {
      healthStatus = "Poor";
      healthColor = "text-red-600";
    }

    // Detect stress areas
    const stressAreas = [];
    if (currentNDVI < 0.3) {
      stressAreas.push("Vegetation stress detected across the farm");
    }
    if (historicalData.length >= 2) {
      const prevNDVI = historicalData[1]?.ndvi ?? 0;
      if (currentNDVI < prevNDVI - 0.1) {
        stressAreas.push("Significant decline in vegetation health detected");
      }
    }

    return {
      farmId: args.farmId,
      currentNDVI,
      healthStatus,
      healthColor,
      ndviTrend,
      stressAreas,
      lastUpdated: satelliteData?.timestamp ?? null,
      satelliteImage: satelliteData?.imageUrl ?? null,
      vegetationIndex: satelliteData?.ndvi ?? null,
      cropDensity: satelliteData?.vegetationCoverage ?? null,
      waterStress: (satelliteData?.ndwi ?? 0) < 0.1,
    };
  },
});

/** Get NDVI history for a farm */
export const getNDVIHistory = query({
  args: {
    farmId: v.id("farms"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return [];

    const days = args.days ?? 90;
    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

    const history = await ctx.db
      .query("satelliteData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .filter((q) => q.gte(q.field("timestamp"), cutoffDate))
      .order("asc")
      .collect();

    return history.map((d) => ({
      date: d.timestamp,
      ndvi: d.ndvi ?? 0,
      label: new Date(d.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  },
});

/** Analyze farm from satellite imagery (simulated for demo) */
export const analyzeFarmSatellite = action({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const farm = await ctx.runQuery(api.farms.getFarm, { farmId: args.farmId });
    if (!farm) throw new Error("Farm not found");

    // Simulate satellite analysis based on farm location
    // In production, this would call Sentinel-2 API
    const lat = farm.location?.latitude ?? -1.2921;
    const lon = farm.location?.longitude ?? 36.8219;

    // Generate realistic NDVI based on location and season
    const month = new Date().getMonth();
    const isRainySeason = month >= 3 && month <= 5 || month >= 10 && month <= 12;
    const baseNDVI = isRainySeason ? 0.65 : 0.45;
    const variation = (Math.random() - 0.5) * 0.2;
    const ndvi = Math.max(0.1, Math.min(0.9, baseNDVI + variation));

    // Calculate derived metrics
    const vegetationIndex = ndvi * 100;
    const cropDensity = Math.round(40 + ndvi * 40);
    const waterStress = ndvi < 0.3;
    const soilMoisture = Math.round(30 + ndvi * 40);

    // Store the analysis
    await ctx.runMutation(api.satellite.storeSatelliteData, {
      farmId: args.farmId,
      ndvi,
      vegetationIndex,
      cropDensity,
      waterStress,
      soilMoisture,
      imageUrl: `https://sentinel-2.example.com/tile/${lat}/${lon}/${Date.now()}`,
      analysisDate: Date.now(),
    });

    return {
      ndvi,
      vegetationIndex,
      cropDensity,
      waterStress,
      soilMoisture,
      healthStatus: ndvi >= 0.7 ? "Excellent" : ndvi >= 0.5 ? "Good" : ndvi >= 0.3 ? "Moderate" : "Poor",
    };
  },
});

/** Store satellite data */
export const storeSatelliteData = mutation({
  args: {
    farmId: v.id("farms"),
    ndvi: v.number(),
    vegetationIndex: v.number(),
    cropDensity: v.number(),
    waterStress: v.boolean(),
    soilMoisture: v.number(),
    imageUrl: v.string(),
    analysisDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) throw new Error("Unauthorized");

    await ctx.db.insert("satelliteData", {
      farmId: args.farmId,
      userId,
      ndvi: args.ndvi,
      vegetationCoverage: args.vegetationIndex ?? args.cropDensity,
      imageUrl: args.imageUrl,
      timestamp: args.analysisDate,
      fetchedAt: Date.now(),
      capturedAt: args.analysisDate ?? Date.now(),
    });

    return true;
  },
});

/** Get field boundaries and crop zones */
export const getFieldBoundaries = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    // In production, this would come from GIS data
    // For now, return farm boundaries based on GPS coordinates
    const lat = farm.location?.latitude ?? -1.2921;
    const lon = farm.location?.longitude ?? 36.8219;

    return {
      farmId: args.farmId,
      boundaries: [
        { lat: lat + 0.01, lon: lon - 0.01 },
        { lat: lat + 0.01, lon: lon + 0.01 },
        { lat: lat - 0.01, lon: lon + 0.01 },
        { lat: lat - 0.01, lon: lon - 0.01 },
      ],
      cropZones: [
        { name: "Zone A", cropType: "Maize", area: 2.5 },
        { name: "Zone B", cropType: "Beans", area: 1.5 },
        { name: "Zone C", cropType: "Tomatoes", area: 1.0 },
      ],
    };
  },
});

/** Compare seasonal vegetation */
export const compareSeasonalVegetation = query({
  args: {
    farmId: v.id("farms"),
    currentSeason: v.string(),
    previousSeason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    // Get data for both seasons
    const allData = await ctx.db
      .query("satelliteData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    // Simple season comparison (in production, filter by actual season dates)
    const currentNDVI = allData.length > 0 ? allData[0].ndvi ?? 0 : 0.5;
    const previousNDVI = allData.length > 1 ? allData[1].ndvi ?? 0 : 0.5;

    const change = currentNDVI - previousNDVI;
    const changePercent = previousNDVI > 0 ? Math.round((change / previousNDVI) * 100) : 0;

    return {
      currentNDVI,
      previousNDVI,
      change,
      changePercent,
      trend: change > 0.05 ? "improving" : change < -0.05 ? "declining" : "stable",
      analysis: change > 0.05
        ? "Vegetation health has improved significantly compared to previous season."
        : change < -0.05
        ? "Vegetation health has declined. Consider soil testing and nutrient management."
        : "Vegetation health is stable compared to previous season.",
    };
  },
});

/** Detect crop stress from satellite data */
export const detectCropStress = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    const satelliteData = await ctx.db
      .query("satelliteData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    if (!satelliteData) return null;

    const ndvi = satelliteData.ndvi ?? 0;
    const waterStress = (satelliteData.ndwi ?? 0) < 0.1;
    const soilMoisture = 50; // Derived from weather data in production

    const stressFactors: Array<{
      factor: string;
      severity: "low" | "medium" | "high";
      description: string;
      recommendation: string;
    }> = [];

    // NDVI-based stress
    if (ndvi < 0.3) {
      stressFactors.push({
        factor: "Vegetation Health",
        severity: "high",
        description: "Very low NDVI indicates severe vegetation stress",
        recommendation: "Immediate irrigation and soil testing required",
      });
    } else if (ndvi < 0.5) {
      stressFactors.push({
        factor: "Vegetation Health",
        severity: "medium",
        description: "Below-optimal vegetation health detected",
        recommendation: "Monitor closely and consider nutrient supplementation",
      });
    }

    // Water stress
    if (waterStress) {
      stressFactors.push({
        factor: "Water Stress",
        severity: "high",
        description: "Satellite data indicates water stress in crops",
        recommendation: "Increase irrigation frequency immediately",
      });
    }

    // Soil moisture
    if (soilMoisture < 30) {
      stressFactors.push({
        factor: "Soil Moisture",
        severity: "medium",
        description: "Low soil moisture detected",
        recommendation: "Schedule irrigation and consider mulching",
      });
    }

    const overallSeverity = stressFactors.some((f) => f.severity === "high")
      ? "high"
      : stressFactors.some((f) => f.severity === "medium")
      ? "medium"
      : "low";

    return {
      farmId: args.farmId,
      overallSeverity,
      stressFactors,
      ndvi,
      waterStress,
      soilMoisture,
      analysisDate: satelliteData.timestamp,
    };
  },
});
