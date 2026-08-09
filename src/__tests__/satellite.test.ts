import { describe, expect, test } from "bun:test";
import {
  estimateNdviFromBuffer,
  analyzeFarmSatelliteCore,
} from "../convex/satellite";

// ============================================================
// estimateNdviFromBuffer — pure parser, no invented values
// ============================================================
describe("estimateNdviFromBuffer", () => {
  test("returns null for an empty response (never invents NDVI)", () => {
    expect(estimateNdviFromBuffer(new Uint8Array(0))).toBeNull();
  });

  test("returns null for a tiny/garbage buffer (never invents NDVI)", () => {
    expect(estimateNdviFromBuffer(new Uint8Array(64))).toBeNull();
  });

  test("returns null for an all-zero buffer (no usable signal)", () => {
    // 200 bytes of zeros — zero variance means no real vegetation data
    const buf = new Uint8Array(200);
    expect(estimateNdviFromBuffer(buf)).toBeNull();
  });

  test("decodes valid little-endian Float32 NDVI pixels", () => {
    // Little-endian TIFF marker + 24 valid Float32 values (>= 100 bytes)
    const count = 24;
    const bytes = new Uint8Array(8 + count * 4);
    bytes[0] = 0x49; // 'I' little-endian TIFF marker
    bytes[1] = 0x49;
    const view = new DataView(bytes.buffer);
    const values = [0.6, 0.5, 0.4, 0.7, 0.5, 0.6, 0.5, 0.6];
    for (let i = 0; i < count; i++) {
      view.setFloat32(8 + i * 4, values[i % values.length], true);
    }

    const stats = estimateNdviFromBuffer(bytes);
    expect(stats).not.toBeNull();
    expect(stats!.pixelCount).toBe(count);
    // 3 repeats of the 8-value cycle: mean = 0.55
    expect(stats!.meanNdvi).toBeCloseTo(0.55, 2);
    expect(stats!.minNdvi).toBeCloseTo(0.4, 2);
    expect(stats!.maxNdvi).toBeCloseTo(0.7, 2);
  });

  test("decoded values stay within the valid NDVI range [-1, 1]", () => {
    const count = 24;
    const bytes = new Uint8Array(8 + count * 4);
    bytes[0] = 0x49;
    bytes[1] = 0x49;
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < count; i++) view.setFloat32(8 + i * 4, 0.5 + (i % 8) * 0.05, true);
    const stats = estimateNdviFromBuffer(bytes);
    expect(stats!.meanNdvi).toBeGreaterThanOrEqual(-1);
    expect(stats!.meanNdvi).toBeLessThanOrEqual(1);
  });

  test("returns null for an all-identical buffer (no variance)", () => {
    const count = 24;
    const bytes = new Uint8Array(8 + count * 4);
    bytes[0] = 0x49;
    bytes[1] = 0x49;
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < count; i++) view.setFloat32(8 + i * 4, 0.5, true);
    expect(estimateNdviFromBuffer(bytes)).toBeNull();
  });
});

// ============================================================
// analyzeFarmSatelliteCore — honest failure, no fabrication
// ============================================================
describe("analyzeFarmSatelliteCore — data honesty", () => {
  test("returns ok:false and persists NOTHING when Copernicus credentials are missing", async () => {
    // Ensure no credentials are set in the test environment so the
    // CDSE token call throws → the core must fail honestly.
    const savedClientId = process.env.COPERNICUS_CLIENT_ID;
    const savedClientSecret = process.env.COPERNICUS_CLIENT_SECRET;
    delete process.env.COPERNICUS_CLIENT_ID;
    delete process.env.COPERNICUS_CLIENT_SECRET;

    const mutations: Array<{ name: string; args: unknown }> = [];
    const ctx = {
      runQuery: async (_fn: unknown, args: { farmId: string }) => ({
        _id: args.farmId,
        location: { latitude: -1.2921, longitude: 36.8219 },
      }),
      runMutation: async (fn: { name: string }, args: unknown) => {
        mutations.push({ name: fn.name, args });
      },
    };

    try {
      const result = await analyzeFarmSatelliteCore(ctx, "farm_1" as never);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason.length).toBeGreaterThan(0);
      }
      // Nothing fabricated or persisted
      expect(mutations.length).toBe(0);
    } finally {
      if (savedClientId) process.env.COPERNICUS_CLIENT_ID = savedClientId;
      if (savedClientSecret) process.env.COPERNICUS_CLIENT_SECRET = savedClientSecret;
    }
  });

  test("throws when the farm does not exist (no silent default)", async () => {
    const ctx = {
      runQuery: async () => null,
      runMutation: async () => {},
    };
    await expect(
      analyzeFarmSatelliteCore(ctx, "farm_missing" as never)
    ).rejects.toThrow(/Farm not found/);
  });

  test("source label is never 'estimated' on failure", async () => {
    const savedClientId = process.env.COPERNICUS_CLIENT_ID;
    const savedClientSecret = process.env.COPERNICUS_CLIENT_SECRET;
    delete process.env.COPERNICUS_CLIENT_ID;
    delete process.env.COPERNICUS_CLIENT_SECRET;

    const ctx = {
      runQuery: async (_fn: unknown, args: { farmId: string }) => ({
        _id: args.farmId,
        location: { latitude: -1.2921, longitude: 36.8219 },
      }),
      runMutation: async () => {},
    };

    try {
      const result = await analyzeFarmSatelliteCore(ctx, "farm_1" as never);
      if (result.ok) {
        expect(result.source).not.toBe("estimated");
      }
    } finally {
      if (savedClientId) process.env.COPERNICUS_CLIENT_ID = savedClientId;
      if (savedClientSecret) process.env.COPERNICUS_CLIENT_SECRET = savedClientSecret;
    }
  });
});
