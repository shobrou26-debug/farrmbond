// ============================================================
// Profile photo validation (shared: Convex backend + Settings UI)
//
// Single source of truth so the client pre-validates exactly what
// the server will enforce (no surprises after upload) and the
// server never trusts the client (metadata is re-checked from the
// stored blob itself). Mirrors the shared-module pattern of
// src/lib/notificationPreferences.ts.
// ============================================================

export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_PROFILE_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * Pure: is this MIME type an accepted profile photo type?
 * Empty/missing types are rejected — the upload must declare
 * what it is.
 */
export function isValidProfilePhotoType(
  contentType: string | null | undefined
): boolean {
  if (!contentType) return false;
  return (ALLOWED_PROFILE_PHOTO_TYPES as readonly string[]).includes(contentType);
}

/**
 * Pure: is this byte size acceptable? Rejects empty files and
 * anything over MAX_PROFILE_PHOTO_BYTES.
 */
export function isWithinProfilePhotoSize(sizeBytes: number): boolean {
  return Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_PROFILE_PHOTO_BYTES;
}

/**
 * Pure: should the previously stored photo blob be deleted?
 * Only when (a) one exists, (b) it is not the id being stored now,
 * and (c) it is not referenced by any other user row (paranoia —
 * a shared blob must never be deleted out from under someone else).
 */
export function shouldDeleteReplacedPhoto(opts: {
  previousStorageId?: string | null;
  newStorageId?: string | null;
  referencedElsewhere?: boolean;
}): boolean {
  const prev = opts.previousStorageId ?? undefined;
  const next = opts.newStorageId ?? undefined;
  if (!prev) return false;
  if (next !== undefined && prev === next) return false;
  if (opts.referencedElsewhere) return false;
  return true;
}
