import { describe, expect, test } from "bun:test";
import {
  hasDetectionImage,
  resolveDetectionImageUrl,
} from "../convex/detectionResults";

// ============================================================
// P2-2 — Detection images: Convex file storage migration helpers
//
// New detections upload the raw file to Convex file storage and store
// a storage reference (`imageStorageId`); legacy rows keep a base64
// data URL in `imageUrl`. These pure helpers drive the save guard and
// the display-URL resolution in the list queries.
// ============================================================

describe("hasDetectionImage — a detection must carry image data", () => {
  test("true when only a legacy imageUrl is present", () => {
    expect(hasDetectionImage("data:image/png;base64,AAAA", undefined)).toBe(true);
  });

  test("true when only a storage id is present", () => {
    expect(hasDetectionImage(undefined, "storage-abc")).toBe(true);
  });

  test("true when both are present", () => {
    expect(hasDetectionImage("data:image/png;base64,AAAA", "storage-abc")).toBe(true);
  });

  test("false when neither is present", () => {
    expect(hasDetectionImage(undefined, undefined)).toBe(false);
    expect(hasDetectionImage("", "")).toBe(false);
  });

  test("false for empty strings", () => {
    expect(hasDetectionImage("   ", undefined)).toBe(false);
  });
});

describe("resolveDetectionImageUrl — display URL resolution", () => {
  test("resolved storage URL wins over the legacy data URL", () => {
    expect(
      resolveDetectionImageUrl({
        legacyImageUrl: "data:image/png;base64,AAAA",
        storageUrl: "https://example.com/stored.jpg",
      })
    ).toBe("https://example.com/stored.jpg");
  });

  test("falls back to the legacy data URL when storage is missing", () => {
    expect(
      resolveDetectionImageUrl({
        legacyImageUrl: "data:image/png;base64,AAAA",
        storageUrl: null,
      })
    ).toBe("data:image/png;base64,AAAA");
  });

  test("falls back to the legacy data URL when storage is undefined", () => {
    expect(
      resolveDetectionImageUrl({
        legacyImageUrl: "data:image/png;base64,AAAA",
        storageUrl: undefined,
      })
    ).toBe("data:image/png;base64,AAAA");
  });

  test("returns null when no image exists", () => {
    expect(
      resolveDetectionImageUrl({ legacyImageUrl: undefined, storageUrl: null })
    ).toBeNull();
  });
});
