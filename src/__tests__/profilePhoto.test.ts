import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MAX_PROFILE_PHOTO_BYTES,
  isValidProfilePhotoType,
  isWithinProfilePhotoSize,
  shouldDeleteReplacedPhoto,
} from "../lib/profilePhoto";

// ============================================================
// Profile photo upload — Settings → Profile
//
// Completes the last "honest UI" gap: profile photo upload. These
// tests guard the shared validators (single source of truth for the
// client pre-check and the server-side blob-metadata check) and the
// wiring between Settings UI, users.ts mutations, and the schema.
// ============================================================

describe("profilePhoto validators", () => {
  test("size limit is 5 MB", () => {
    expect(MAX_PROFILE_PHOTO_BYTES).toBe(5 * 1024 * 1024);
  });

  test("accepts JPEG, PNG, and WebP content types only", () => {
    expect(isValidProfilePhotoType("image/jpeg")).toBe(true);
    expect(isValidProfilePhotoType("image/png")).toBe(true);
    expect(isValidProfilePhotoType("image/webp")).toBe(true);
  });

  test("rejects non-image and missing content types (server never trusts client)", () => {
    expect(isValidProfilePhotoType("application/pdf")).toBe(false);
    expect(isValidProfilePhotoType("text/html")).toBe(false);
    expect(isValidProfilePhotoType("image/gif")).toBe(false);
    expect(isValidProfilePhotoType("")).toBe(false);
    expect(isValidProfilePhotoType(null)).toBe(false);
    expect(isValidProfilePhotoType(undefined)).toBe(false);
  });

  test("size validator: 0 < bytes <= 5 MB", () => {
    expect(isWithinProfilePhotoSize(1)).toBe(true);
    expect(isWithinProfilePhotoSize(MAX_PROFILE_PHOTO_BYTES)).toBe(true);
    expect(isWithinProfilePhotoSize(MAX_PROFILE_PHOTO_BYTES + 1)).toBe(false);
    expect(isWithinProfilePhotoSize(0)).toBe(false);
    expect(isWithinProfilePhotoSize(-1)).toBe(false);
    expect(isWithinProfilePhotoSize(Number.NaN)).toBe(false);
    expect(isWithinProfilePhotoSize(Number.POSITIVE_INFINITY)).toBe(false);
  });

  test("replaced blob deleted only when it exists, differs, and is unreferenced", () => {
    expect(
      shouldDeleteReplacedPhoto({
        previousStorageId: "old",
        newStorageId: "new",
        referencedElsewhere: false,
      })
    ).toBe(true);

    expect(shouldDeleteReplacedPhoto({ previousStorageId: null })).toBe(false);
    expect(shouldDeleteReplacedPhoto({})).toBe(false);

    // Same blob re-set: no delete.
    expect(
      shouldDeleteReplacedPhoto({
        previousStorageId: "x",
        newStorageId: "x",
        referencedElsewhere: false,
      })
    ).toBe(false);

    // Shared blob must never be deleted out from under another row.
    expect(
      shouldDeleteReplacedPhoto({
        previousStorageId: "old",
        newStorageId: "new",
        referencedElsewhere: true,
      })
    ).toBe(false);
  });
});

describe("profile photo wiring (source guards)", () => {
  const read = (p: string): string =>
    readFileSync(new URL(p, import.meta.url), "utf8");

  const schema = read("../convex/schema.ts");
  const backend = read("../convex/users.ts");
  const settings = read("../pages/Settings.tsx");

  test("users table stores photo display URL + storage id owner, indexed", () => {
    expect(schema).toContain("imageStorageId: v.optional(v.id(\"_storage\"))");
    expect(schema).toContain('.index("by_image_storage", ["imageStorageId"])');
  });

  test("backend mutations are auth-gated and validate the stored blob metadata", () => {
    expect(backend).toContain(
      "export const generateProfilePhotoUploadUrl = mutation({"
    );
    expect(backend).toContain("export const setProfilePhoto = mutation({");
    expect(backend).toContain("export const removeProfilePhoto = mutation({");
    // Server-side enforcement: auth helper + blob metadata validation
    // (never client-supplied values).
    expect(backend).toContain("await requireAuth(ctx)");
    expect(backend).toContain("ctx.db.system.get(args.storageId)");
    expect(backend).toContain("isValidProfilePhotoType(metadata.contentType");
    expect(backend).toContain("isWithinProfilePhotoSize(metadata.size)");
  });

  test("backend audits photo set/remove and cleans up replaced blobs", () => {
    expect(backend).toContain('action: "profile_photo_set"');
    expect(backend).toContain('action: "profile_photo_removed"');
    expect(backend).toContain("shouldDeleteReplacedPhoto({");
    expect(backend).toContain("ctx.storage.delete(previousStorageId)");
  });

  test("Settings ProfileTab wires real upload/remove (no disabled placeholder left)", () => {
    expect(settings).toContain("api.users.generateProfilePhotoUploadUrl");
    expect(settings).toContain("api.users.setProfilePhoto");
    expect(settings).toContain("api.users.removeProfilePhoto");
    expect(settings).toContain("isValidProfilePhotoType(file.type)");
    expect(settings).toContain("isWithinProfilePhotoSize(file.size)");
    // The honest-but-disabled placeholder is gone.
    expect(settings).not.toContain("Profile photo upload coming soon");
    expect(settings).not.toContain("Photo upload is not available yet.");
  });

  test("client pre-validates exactly what the server enforces (shared module)", () => {
    // Both sides must import the same validators from src/lib/profilePhoto.
    expect(backend).toContain('from "../lib/profilePhoto"');
    expect(settings).toContain('from "@/lib/profilePhoto"');
  });
});
