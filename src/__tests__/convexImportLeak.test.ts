import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

// ============================================================
// Frontend ⇄ Convex import leak guard
// ============================================================
// Regression guard for the `ReferenceError: process is not defined`
// crash: the browser bundle must never execute server-only Convex code.
//
// `src/convex/_generated/server.js` evaluates `export const env = process.env`
// at module top level, and every Convex function module that imports it drags
// that line into the browser. The frontend must only import:
//   - `@/convex/_generated/api` (client-safe function references)
//   - `@/convex/_generated/dataModel` (types only)
//   - verified pure shared modules (e.g. `@/convex/communityShared`,
//     `@/convex/currency`)
//
// This test scans every frontend source file, resolves its imports into
// `src/convex`, and walks the transitive import graph looking for
//   - `src/convex/_generated/server` (the `process.env` offender), or
//   - any reachable module that touches `process.env`.
// Type-only imports are erased at build time and are therefore allowed.
// ============================================================

const SRC_DIR = "src";
const CONVEX_DIR = path.join(SRC_DIR, "convex");
const GENERATED_SERVER_FILES = new Set([
  "src/convex/_generated/server.ts",
  "src/convex/_generated/server.js",
]);

/** Normalize to forward slashes so comparisons work on every OS. */
function norm(p: string): string {
  return p.split(path.sep).join("/");
}

function walkTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      files.push(...walkTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

type ImportRef = {
  spec: string;
  /** True when the whole import clause carries no runtime bindings. */
  typeOnly: boolean;
};

// The clause is matched up to a `;` so an unrelated `export const ...`
// statement can never be paired with a later `from "..."`.
const IMPORT_FROM_RE =
  /\b(import|export)\s+(type\s+)?([^;]*?)\s*from\s*["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT_RE = /\bimport\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

/** `{ type A, type B }` or `type { A }` carries no runtime bindings. */
function isTypeOnlyClause(clause: string): boolean {
  const trimmed = clause.trim();
  if (/^type\s/.test(trimmed)) return true;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return true;
    return inner
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .every((s) => /^type\s+/.test(s));
  }
  return false;
}

function extractImports(source: string): ImportRef[] {
  const imports: ImportRef[] = [];

  for (const match of source.matchAll(IMPORT_FROM_RE)) {
    const [, , typeKeyword, clause, spec] = match;
    imports.push({
      spec,
      typeOnly: Boolean(typeKeyword) || isTypeOnlyClause(clause),
    });
  }

  for (const match of source.matchAll(SIDE_EFFECT_IMPORT_RE)) {
    imports.push({ spec: match[1], typeOnly: false });
  }

  for (const match of source.matchAll(DYNAMIC_IMPORT_RE)) {
    imports.push({ spec: match[1], typeOnly: false });
  }

  return imports;
}

const RESOLVE_SUFFIXES = [".ts", ".tsx", ".js", ".jsx"];

/** Resolve a relative or `@/` import specifier to an existing source file. */
function resolveLocalFile(fromFile: string, spec: string): string | null {
  let base: string | null = null;
  if (spec.startsWith("@/")) {
    base = path.join(SRC_DIR, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), spec);
  }
  if (!base) return null;

  const candidates = [
    base,
    ...RESOLVE_SUFFIXES.map((ext) => base + ext),
    ...RESOLVE_SUFFIXES.map((ext) => path.join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      // Return repo-relative forward-slash paths so both `@/` and relative
      // import styles compare identically against `src/convex/`.
      return norm(path.relative(process.cwd(), candidate));
    }
  }
  return null;
}

/** Remove comments so prose about `process.env` is never mistaken for code. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** A module is server-only if it is the generated server module or reads process.env. */
function isServerOnlyModule(file: string): boolean {
  const normalized = norm(file);
  if (GENERATED_SERVER_FILES.has(normalized)) return true;
  return /\bprocess\.env\b/.test(stripComments(readFileSync(file, "utf8")));
}

/**
 * Breadth-first walk of runtime imports starting at `entryFile`.
 * Returns the offending import chain, or null when the module is browser-safe.
 * Type-only edges are skipped because the bundler erases them.
 */
function findServerOnlyChain(entryFile: string): string[] | null {
  const queue: Array<{ file: string; chain: string[] }> = [
    { file: norm(entryFile), chain: [norm(entryFile)] },
  ];
  const visited = new Set<string>();
  const convexPrefix = norm(CONVEX_DIR) + "/";

  while (queue.length > 0) {
    const { file, chain } = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);

    if (isServerOnlyModule(file)) return chain;

    const source = readFileSync(file, "utf8");
    for (const imp of extractImports(source)) {
      if (imp.typeOnly) continue;
      const resolved = resolveLocalFile(file, imp.spec);
      if (!resolved || !resolved.startsWith(convexPrefix)) continue;
      if (visited.has(resolved)) continue;
      queue.push({ file: resolved, chain: [...chain, resolved] });
    }
  }

  return null;
}

const FRONTEND_FILES = walkTsFiles(SRC_DIR).filter((file) => {
  const normalized = norm(file);
  return (
    !normalized.startsWith("src/convex/") &&
    !normalized.startsWith("src/__tests__/")
  );
});

describe("browser bundle safety — no server-only Convex imports", () => {
  test("frontend never imports a server-only Convex module (direct or transitive)", () => {
    expect(FRONTEND_FILES.length).toBeGreaterThan(20);

    const leaks: string[] = [];
    for (const file of FRONTEND_FILES) {
      const source = readFileSync(file, "utf8");
      for (const imp of extractImports(source)) {
        if (imp.typeOnly) continue;
        const resolved = resolveLocalFile(file, imp.spec);
        if (!resolved || !resolved.startsWith(norm(CONVEX_DIR) + "/")) continue;

        const chain = findServerOnlyChain(resolved);
        if (chain) {
          leaks.push(`${norm(file)} -> ${chain.join(" -> ")}`);
        }
      }
    }

    expect(leaks).toEqual([]);
  });

  test("guard is meaningful — frontend really does import client-safe Convex modules", () => {
    let clientSafeConvexImports = 0;
    for (const file of FRONTEND_FILES) {
      const source = readFileSync(file, "utf8");
      for (const imp of extractImports(source)) {
        const resolved = resolveLocalFile(file, imp.spec);
        if (
          resolved &&
          resolved.startsWith(norm(CONVEX_DIR) + "/") &&
          findServerOnlyChain(resolved) === null
        ) {
          clientSafeConvexImports += 1;
        }
      }
    }
    // `_generated/api` + pure shared modules are expected to be imported.
    expect(clientSafeConvexImports).toBeGreaterThan(0);
  });

  test("detector catches the original regression (server module → _generated/server)", () => {
    // `community.ts` defines Convex functions and imports `_generated/server`
    // at runtime, so importing it from the browser must be rejected.
    const chain = findServerOnlyChain(path.join(CONVEX_DIR, "community.ts"));
    expect(chain).not.toBeNull();
    expect(chain![chain!.length - 1]).toBe("src/convex/_generated/server.js");
  });

  test("detector allows verified client-safe shared modules", () => {
    const safeModules = [
      path.join(CONVEX_DIR, "communityShared.ts"),
      path.join(CONVEX_DIR, "currency.ts"),
      path.join(CONVEX_DIR, "_generated", "api.js"),
    ];
    for (const mod of safeModules) {
      expect(findServerOnlyChain(mod)).toBeNull();
    }
  });
});
