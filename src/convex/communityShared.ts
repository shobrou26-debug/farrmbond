// ============================================================
// Shared Community Helpers (single source of truth)
// ============================================================
// Pure module (no React, no Convex bindings) so the SAME rule is used by:
//   - the Community composer UI (client-side tag derivation)
//   - the Convex community backend / tests
// Importing this file from the frontend is safe: it never pulls in
// `_generated/server` (and therefore never touches `process.env`).
// ============================================================

/**
 * Pure: extract up to `max` hashtags from post content. A hashtag is '#'
 * followed by one or more non-space, non-'#' characters — so runs of '#'
 * act as delimiters and never become tags. Shared by the composer UI and
 * tests so tag derivation follows one rule.
 */
export function extractHashtags(content: string, max = 5): string[] {
  const out: string[] = [];
  for (const match of content.matchAll(/#([^\s#]+)/g)) {
    if (out.length >= max) break;
    out.push(match[1]);
  }
  return out;
}
