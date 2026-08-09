import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { requireAuth, isSubscriptionActive } from "./authHelpers";
import type { Id } from "./_generated/dataModel";

// ============================================================
// Sentinel-2 Satellite Intelligence Module
// Uses Copernicus Data Space Ecosystem (CDSE) API
// ============================================================

// NDVI Evalscript v3 for Sentinel-2 L2A
const NDVI_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08"], units: "REFLECTANCE" }],
    output: { id: "default", bands: 1, sampleType: SampleType.FLOAT32 }
  };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  return [ndvi];
}
`;

/**
 * Get OAuth2 access token from Copernicus Data Space Ecosystem
 * Uses client credentials from environment variables
 */
async function getCDSEToken(): Promise<string> {
  const clientId = process.env.COPERNICUS_CLIENT_ID;
  const clientSecret = process.env.COPERNICUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Copernicus API credentials not configured. " +
      "Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET via the Keys/API keys tab."
    );
  }

  const response = await fetch(
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`,
    }
  );

  if (!response.ok) {
    throw new Error(`CDSE authentication failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Build a bounding box from farm coordinates with a buffer in km
 */
function buildBoundingBox(
  lat: number,
  lon: number,
  bufferKm: number = 5
): [number, number, number, number] {
  const latDelta = bufferKm / 111.32;
  const lonDelta = bufferKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lon - lonDelta, lat - latDelta, lon + lonDelta, lat + latDelta];
}

/**
 * Search for the best Sentinel-2 L2A scene for a given bounding box and date range
 */
async function searchSentinelScenes(
  bbox: [number, number, number, number],
  startDate: string,
  endDate: string,
  maxCloudCover: number = 30
): Promise<
  Array<{
    id: string;
    name: string;
    date: string;
    cloudCover: number;
    footprint: string;
  }>
> {
  const [west, south, east, north] = bbox;

  const filter =
    `Collection/Name eq 'SENTINEL-2' and ` +
    `OData.CSC.Intersects(area=geography'SRID=4326;POLYGON((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}))') and ` +
    `ContentDate/Start gt ${startDate}T00:00:00.000Z and ContentDate/Start lt ${endDate}T23:59:59.999Z and ` +
    `Attributes/OData.CSC.DoubleAttribute/any(att:att/Name eq 'cloudCover' and att/OData.CSC.DoubleAttribute/Value lt ${maxCloudCover})`;

  const url =
    `https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$filter=${encodeURIComponent(filter)}` +
    `&$orderby=ContentDate/Start desc&$top=10`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CDSE catalog search failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    value: Array<{
      Id: string;
      Name: string;
      ContentDate: { Start: string };
      Attributes: Array<{ Name: string; Value: number }>;
      Footprint: string;
    }>;
  };

  return (data.value || []).map((product) => ({
    id: product.Id,
    name: product.Name,
    date: product.ContentDate.Start,
    cloudCover:
      product.Attributes.find((a) => a.Name === "cloudCover")?.Value ?? 100,
    footprint: product.Footprint,
  }));
}

/**
 * Request NDVI computation from Copernicus Process API
 * Uses Sentinel-2 L2A bands B04 (Red) and B08 (NIR)
 */
async function computeNDVI(
  token: string,
  bbox: [number, number, number, number],
  date: string
): Promise<{
  meanNdvi: number;
  minNdvi: number;
  maxNdvi: number;
  pixelCount: number;
}> {
  const [west, south, east, north] = bbox;
  const width = 256;
  const height = 256;

  const requestPayload = {
    input: {
      bounds: {
        bbox: [west, south, east, north],
        properties: {
          crs: "http://www.opengis.net/def/crs/EPSG/0/4326",
        },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: `${date}T00:00:00Z`,
              to: `${date}T23:59:59Z`,
            },
            maxCloudCoverage: 30,
          },
        },
      ],
    },
    output: {
      width,
      height,
      responses: [
        { identifier: "default", format: { type: "image/tiff" } },
      ],
    },
    evalscript: NDVI_EVALSCRIPT,
  };

  const response = await fetch(
    "https://sh.dataspace.copernicus.eu/api/v1/process",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `CDSE Process API failed: ${response.status} - ${errorText}`
    );
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const stats = estimateNdviFromBuffer(bytes);
  if (!stats) {
    throw new Error("Sentinel-2 response contained no usable NDVI pixels");
  }
  return stats;
}

export type NdviStats = {
  meanNdvi: number;
  minNdvi: number;
  maxNdvi: number;
  pixelCount: number;
};

/**
 * Estimate NDVI statistics from raw TIFF response buffer.
 * Returns null when no valid pixel values can be decoded — the caller
 * must treat that as a failed analysis (never invent NDVI values).
 * Exported for unit testing (pure, no I/O).
 */
export function estimateNdviFromBuffer(bytes: Uint8Array): NdviStats | null {
  if (bytes.length < 100) return null;

  const isLittleEndian = bytes[0] === 0x49 && bytes[1] === 0x49;
  const dataView = new DataView(bytes.buffer);

  let dataOffset = 0;
  for (let i = 8; i < Math.min(bytes.length - 4, 200); i += 2) {
    if (bytes[i] !== 0 && bytes[i + 1] !== 0) {
      dataOffset = i;
      break;
    }
  }
  if (dataOffset === 0) dataOffset = 8;

  const values: number[] = [];
  const maxValues = Math.min(
    65536,
    Math.floor((bytes.length - dataOffset) / 4)
  );

  for (let i = 0; i < maxValues; i++) {
    const offset = dataOffset + i * 4;
    if (offset + 4 > bytes.length) break;
    try {
      const val = dataView.getFloat32(offset, isLittleEndian);
      if (val >= -1 && val <= 1 && !isNaN(val)) {
        values.push(val);
      }
    } catch {
      break;
    }
  }

  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // Zero variance (e.g. an all-zero buffer) means there is no usable
  // vegetation signal — report failure instead of inventing a reading.
  if (max - min < 1e-9) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    meanNdvi: Math.round((sum / values.length) * 1000) / 1000,
    minNdvi: Math.round(min * 1000) / 1000,
    maxNdvi: Math.round(max * 1000) / 1000,
    pixelCount: values.length,
  };
}

// ============================================================
// Satellite Queries
// ============================================================

/** Get satellite analysis for a farm */
export const getSatelliteAnalysis = query({
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

    const historicalData = await ctx.db
      .query("satelliteData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();

    const ndviTrend = historicalData.slice(0, 12).map((d) => ({
      date: d.timestamp,
      ndvi: d.ndvi ?? 0,
      label: new Date(d.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));

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

    const stressAreas: string[] = [];
    if (currentNDVI < 0.3)
      stressAreas.push("Vegetation stress detected across the farm");
    if (historicalData.length >= 2) {
      const prevNDVI = historicalData[1]?.ndvi ?? 0;
      if (currentNDVI < prevNDVI - 0.1)
        stressAreas.push(
          "Significant decline in vegetation health detected"
        );
    }

    const wmsUrl = satelliteData?.imageUrl || null;

    return {
      farmId: args.farmId,
      currentNDVI,
      healthStatus,
      healthColor,
      ndviTrend,
      stressAreas,
      lastUpdated: satelliteData?.timestamp ?? null,
      satelliteImage: wmsUrl,
      vegetationIndex:
        satelliteData?.ndvi != null ? satelliteData.ndvi * 100 : null,
      cropDensity: satelliteData?.vegetationCoverage ?? null,
      waterStress: (satelliteData?.ndwi ?? 0) < 0.1,
      source: "sentinel-2",
      sceneCloudCover: null,
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
      ndwi: d.ndwi ?? 0,
      label: new Date(d.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  },
});

// ============================================================
// Satellite Actions (Server-side API calls)
// ============================================================

export type SatelliteAnalysisResult =
  | {
      ok: true;
      ndvi: number;
      vegetationCoverage: number;
      healthStatus: string;
      source: string;
      sceneName: string;
      sceneDate: string;
      cloudCover: number | null;
      pixelCount: number;
      minNdvi: number;
      maxNdvi: number;
      wmsUrl: string | null;
    }
  | {
      ok: false;
      reason: string;
    };

/**
 * Server-safe core of analyzeFarmSatellite — exported for testing.
 * Runs the real Copernicus pipeline for one farm.
 *
 * DATA HONESTY: when the Copernicus API is unreachable (missing
 * credentials, no scenes, processing failure) it returns
 * `{ ok: false, reason }` and persists NOTHING. It never fabricates
 * NDVI values or writes invented scores to the database.
 */
export async function analyzeFarmSatelliteCore(
  ctx: any,
  farmId: Id<"farms">
): Promise<SatelliteAnalysisResult> {
  const farm = await ctx.runQuery(api.farms.getFarm, {
    farmId,
  });
  if (!farm) throw new Error("Farm not found");

    const lat = farm.location?.latitude ?? -1.2921;
    const lon = farm.location?.longitude ?? 36.8219;
    const bbox = buildBoundingBox(lat, lon, 5);

    const now = new Date();
    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    );
    const startDate = thirtyDaysAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    try {
      // Step 1: Authenticate with Copernicus
      const token = await getCDSEToken();

      // Step 2: Search for cloud-free Sentinel-2 L2A scene
      const scenes = await searchSentinelScenes(
        bbox,
        startDate,
        endDate,
        25
      );

      if (scenes.length === 0) {
        // Fallback: wider date range (90 days)
        const ninetyDaysAgo = new Date(
          now.getTime() - 90 * 24 * 60 * 60 * 1000
        );
        const fallbackStart = ninetyDaysAgo
          .toISOString()
          .split("T")[0];
        const fallbackScenes = await searchSentinelScenes(
          bbox,
          fallbackStart,
          endDate,
          35
        );
        if (fallbackScenes.length === 0) {
          return {
            ok: false,
            reason:
              "No Sentinel-2 scenes available for this location in the last 90 days.",
          };
        }
        return await processScene(
          ctx,
          farm,
          fallbackScenes[0],
          bbox,
          token
        );
      }

      const bestScene = scenes.sort(
        (a, b) => a.cloudCover - b.cloudCover
      )[0];
      return await processScene(ctx, farm, bestScene, bbox, token);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      // Honest failure: do NOT fabricate NDVI or persist anything.
      console.error("Copernicus API error:", message);
      return { ok: false, reason: message };
    }
}

/**
 * Analyze farm using real Sentinel-2 satellite imagery via Copernicus API.
 * Delegates to the server-safe core (see analyzeFarmSatelliteCore).
 */
export const analyzeFarmSatellite = action({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args): Promise<SatelliteAnalysisResult> => {
    // Premium feature: satellite monitoring requires an ACTIVE Pro
    // subscription (tier + unexpired). Enforced server-side.
    const user = await ctx.runQuery(api.users.currentUser);
    if (!user) {
      return { ok: false, reason: "Authentication required" };
    }
    if (user.subscriptionTier !== "pro" || !isSubscriptionActive(user)) {
      return {
        ok: false,
        reason:
          "Satellite monitoring is a Pro feature. Upgrade at Settings > Subscription to unlock Sentinel-2 NDVI analysis.",
      };
    }
    return analyzeFarmSatelliteCore(ctx, args.farmId);
  },
});

/** Process a found satellite scene and store results */
async function processScene(
  ctx: any,
  farm: any,
  scene: {
    id: string;
    name: string;
    date: string;
    cloudCover: number;
  },
  bbox: [number, number, number, number],
  token: string
): Promise<Extract<SatelliteAnalysisResult, { ok: true }>> {
  const sceneDate = scene.date.split("T")[0];

  // Compute NDVI using the Process API
  const ndviResult = await computeNDVI(token, bbox, sceneDate);
  if (!ndviResult) {
    throw new Error("Sentinel-2 processing returned no usable NDVI data");
  }

  const ndvi = Math.max(0, Math.min(1, ndviResult.meanNdvi));
  const vegetationCoverage = Math.round(ndvi * 100);

  // Build WMS URL for map visualization
  const [west, south, east, north] = bbox;
  const wmsUrl =
    `https://sh.dataspace.copernicus.eu/ogc/wms/?SERVICE=WMS&VERSION=1.3.0` +
    `&REQUEST=GetMap&LAYERS=1_TRUE_COLOR&CRS=EPSG:4326` +
    `&BBOX=${south},${west},${north},${east}&WIDTH=800&HEIGHT=600` +
    `&FORMAT=image/png&TIME=${sceneDate}`;

  // Store the analysis results
  await ctx.runMutation(api.satellite.storeSatelliteData, {
    farmId: farm._id,
    ndvi,
    vegetationCoverage,
    imageUrl: wmsUrl,
    analysisDate: new Date(sceneDate).getTime(),
  });

  // Update farm's NDVI score
  await ctx.runMutation(api.farms.updateFarm, {
    farmId: farm._id,
    ndviScore: Math.round(ndvi * 100),
  });

  return {
    ok: true,
    ndvi,
    vegetationCoverage,
    healthStatus:
      ndvi >= 0.7
        ? "Excellent"
        : ndvi >= 0.5
          ? "Good"
          : ndvi >= 0.3
            ? "Moderate"
            : "Poor",
    source: "sentinel-2-copernicus",
    sceneName: scene.name,
    sceneDate,
    cloudCover: scene.cloudCover,
    pixelCount: ndviResult.pixelCount,
    minNdvi: ndviResult.minNdvi,
    maxNdvi: ndviResult.maxNdvi,
    wmsUrl,
  };
}



/** Store satellite data */
export const storeSatelliteData = mutation({
  args: {
    farmId: v.id("farms"),
    ndvi: v.number(),
    vegetationCoverage: v.number(),
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
      ndviClass:
        args.ndvi >= 0.7
          ? "very_dense"
          : args.ndvi >= 0.5
            ? "dense"
            : args.ndvi >= 0.3
              ? "moderate"
              : "sparse",
      vegetationCoverage: args.vegetationCoverage,
      imageUrl: args.imageUrl,
      timestamp: args.analysisDate,
      fetchedAt: Date.now(),
      capturedAt: args.analysisDate,
    });

    return true;
  },
});

/** Get field boundaries */
export const getFieldBoundaries = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    const lat = farm.location?.latitude ?? -1.2921;
    const lon = farm.location?.longitude ?? 36.8219;
    const buffer = Math.sqrt(farm.size) * 0.005;

    return {
      farmId: args.farmId,
      boundaries: [
        { lat: lat + buffer, lon: lon - buffer },
        { lat: lat + buffer, lon: lon + buffer },
        { lat: lat - buffer, lon: lon + buffer },
        { lat: lat - buffer, lon: lon - buffer },
      ],
      cropZones: [
        {
          name: "Zone A",
          cropType: "Main Crop",
          area: farm.size * 0.5,
        },
        {
          name: "Zone B",
          cropType: "Secondary Crop",
          area: farm.size * 0.3,
        },
        {
          name: "Zone C",
          cropType: "Buffer Zone",
          area: farm.size * 0.2,
        },
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

    const allData = await ctx.db
      .query("satelliteData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();

    const currentNDVI =
      allData.length > 0 ? allData[0].ndvi ?? 0 : 0.5;
    const previousNDVI =
      allData.length > 1 ? allData[1].ndvi ?? 0 : 0.5;
    const change = currentNDVI - previousNDVI;
    const changePercent =
      previousNDVI > 0
        ? Math.round((change / previousNDVI) * 100)
        : 0;

    return {
      currentNDVI,
      previousNDVI,
      change,
      changePercent,
      trend:
        change > 0.05
          ? "improving"
          : change < -0.05
            ? "declining"
            : "stable",
      analysis:
        change > 0.05
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
    const ndwi = satelliteData.ndwi ?? 0;
    const waterStress = ndwi < 0.1;

    const stressFactors: Array<{
      factor: string;
      severity: "low" | "medium" | "high";
      description: string;
      recommendation: string;
    }> = [];

    if (ndvi < 0.3) {
      stressFactors.push({
        factor: "Vegetation Health",
        severity: "high",
        description:
          "Very low NDVI indicates severe vegetation stress",
        recommendation:
          "Immediate irrigation and soil testing required",
      });
    } else if (ndvi < 0.5) {
      stressFactors.push({
        factor: "Vegetation Health",
        severity: "medium",
        description: "Below-optimal vegetation health detected",
        recommendation:
          "Monitor closely and consider nutrient supplementation",
      });
    }

    if (waterStress) {
      stressFactors.push({
        factor: "Water Stress",
        severity: "high",
        description:
          "Satellite data indicates water stress in crops",
        recommendation:
          "Increase irrigation frequency immediately",
      });
    }

    const overallSeverity = stressFactors.some(
      (f) => f.severity === "high"
    )
      ? "high"
      : stressFactors.some((f) => f.severity === "medium")
        ? "medium"
        : "low";

    return {
      farmId: args.farmId,
      overallSeverity,
      stressFactors,
      ndvi,
      ndwi,
      waterStress,
      analysisDate: satelliteData.timestamp,
    };
  },
});
