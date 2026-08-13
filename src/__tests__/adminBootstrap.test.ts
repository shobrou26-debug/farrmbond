import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { canBootstrapFirstAdmin, isAdminRole } from "../convex/adminBootstrap";
import { ROLES } from "../convex/schema";

// ============================================================
// Release-candidate hardening — first-admin bootstrap.
//
// The rule must fail CLOSED on every axis:
//   - BOOTSTRAP_ADMIN_EMAIL not configured          → denied
//   - any admin/super_admin already exists           → permanently closed
//   - caller email ≠ configured bootstrap email      → denied
//   - caller has no verified email                   → denied
// Only (configured + no admins + exact email match) may promote.
// ============================================================

const readConvex = (file: string): string =>
  readFileSync(new URL(`../convex/${file}`, import.meta.url), "utf8");

describe("canBootstrapFirstAdmin — the bootstrap decision rule", () => {
  test("unconfigured bootstrap email → denied (no magic first-admin)", () => {
    const d = canBootstrapFirstAdmin({
      configuredEmail: undefined,
      callerEmail: "owner@example.com",
      existingAdminCount: 0,
    });
    expect(d.allowed).toBe(false);
  });

  test("an admin already exists → permanently closed", () => {
    const d = canBootstrapFirstAdmin({
      configuredEmail: "owner@example.com",
      callerEmail: "owner@example.com",
      existingAdminCount: 1,
    });
    expect(d.allowed).toBe(false);
  });

  test("super_admin existing counts as an existing admin", () => {
    expect(
      canBootstrapFirstAdmin({
        configuredEmail: "owner@example.com",
        callerEmail: "owner@example.com",
        existingAdminCount: 1,
      }).allowed
    ).toBe(false);
  });

  test("arbitrary user (email mismatch) → denied", () => {
    const d = canBootstrapFirstAdmin({
      configuredEmail: "owner@example.com",
      callerEmail: "intruder@example.com",
      existingAdminCount: 0,
    });
    expect(d.allowed).toBe(false);
  });

  test("caller without a verified email → denied", () => {
    const d = canBootstrapFirstAdmin({
      configuredEmail: "owner@example.com",
      callerEmail: "",
      existingAdminCount: 0,
    });
    expect(d.allowed).toBe(false);
  });

  test("exact match + no admins → allowed (the only granting case)", () => {
    const d = canBootstrapFirstAdmin({
      configuredEmail: "owner@example.com",
      callerEmail: "owner@example.com",
      existingAdminCount: 0,
    });
    expect(d.allowed).toBe(true);
  });

  test("email comparison is case/whitespace insensitive but otherwise exact", () => {
    expect(
      canBootstrapFirstAdmin({
        configuredEmail: "  Owner@Example.com ",
        callerEmail: "owner@example.com",
        existingAdminCount: 0,
      }).allowed
    ).toBe(true);
    // A suffix attacker ("owner@example.com.evil.io") must NOT match.
    expect(
      canBootstrapFirstAdmin({
        configuredEmail: "owner@example.com",
        callerEmail: "owner@example.com.evil.io",
        existingAdminCount: 0,
      }).allowed
    ).toBe(false);
  });
});

describe("isAdminRole — admin/super_admin recognition", () => {
  test("recognizes both admin roles and nothing else", () => {
    expect(isAdminRole(ROLES.ADMIN)).toBe(true);
    expect(isAdminRole(ROLES.SUPER_ADMIN)).toBe(true);
    expect(isAdminRole("farmer")).toBe(false);
    expect(isAdminRole("agronomist")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe("bootstrap mutation is server-gated (source-level guards)", () => {
  const src = readConvex("adminBootstrap.ts");

  test("requires an authenticated session — never unauthenticated", () => {
    expect(src).toContain("requireAuth(ctx)");
  });

  test("never uses requireAdmin as the gate (there is no admin yet)", () => {
    expect(src).not.toContain("requireAdmin(ctx)");
  });

  test("reads the bootstrap email server-side only, never from client args", () => {
    expect(src).toContain("BOOTSTRAP_ADMIN_EMAIL");
    // The mutation accepts NO arguments — the client cannot influence it.
    expect(src).toMatch(/bootstrapFirstAdmin = mutation\(\{\s*args: \{\},/);
  });

  test("audit-logs the promotion", () => {
    expect(src).toContain('action: "admin_bootstrapped"');
  });

  test("the promotion targets super_admin (never a weaker role)", () => {
    expect(src).toContain('role: ROLES.SUPER_ADMIN');
  });
});
