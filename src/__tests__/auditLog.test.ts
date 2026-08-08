import { describe, expect, test } from "bun:test";
import { canViewAllAuditLogs, enrichAuditLogs } from "../convex/admin";
import { ROLES } from "../convex/schema";
import {
  mapAction,
  mapEntity,
  mapRow,
  getActionLabel,
  getEntityLabel,
} from "../lib/audit-log";

// ============================================================
// Audit-log access control
// ============================================================
describe("canViewAllAuditLogs", () => {
  test("admin may view platform-wide audit logs", () => {
    expect(canViewAllAuditLogs(ROLES.ADMIN)).toBe(true);
  });

  test("super_admin may view platform-wide audit logs", () => {
    expect(canViewAllAuditLogs(ROLES.SUPER_ADMIN)).toBe(true);
  });

  test("farmer may NOT view platform-wide audit logs (own logs only)", () => {
    expect(canViewAllAuditLogs(ROLES.FARMER)).toBe(false);
  });

  test("agronomist may NOT view platform-wide audit logs", () => {
    expect(canViewAllAuditLogs(ROLES.AGRONOMIST)).toBe(false);
  });

  test("unauthenticated/undefined role is scoped to own logs", () => {
    expect(canViewAllAuditLogs(undefined)).toBe(false);
  });
});

// ============================================================
// Audit-log enrichment (actor name + role lookup)
// ============================================================
describe("enrichAuditLogs", () => {
  const row = {
    _id: "audit_1",
    _creationTime: 1,
    userId: "user_1" as string,
    action: "farm_created",
    resource: "farms",
    resourceId: "farm_1",
    changes: undefined,
    createdAt: Date.now(),
  };

  test("attaches actor name and role from the users table", async () => {
    const ctx = {
      db: {
        get: async (id: string) =>
          id === "user_1"
            ? { _id: "user_1", name: "John Kamau", role: "farmer" }
            : null,
      },
    } as never;

    const enriched = await enrichAuditLogs(ctx as never, [row as never]);
    expect(enriched[0].userName).toBe("John Kamau");
    expect(enriched[0].userRole).toBe("farmer");
  });

  test("falls back when the user record is missing", async () => {
    const ctx = { db: { get: async () => null } } as never;
    const enriched = await enrichAuditLogs(ctx as never, [row as never]);
    expect(enriched[0].userName).toBe("Unknown User");
    expect(enriched[0].userRole).toBe("farmer");
  });

  test("preserves the original audit fields", async () => {
    const ctx = { db: { get: async () => null } } as never;
    const enriched = await enrichAuditLogs(ctx as never, [row as never]);
    expect(enriched[0].action).toBe("farm_created");
    expect(enriched[0].resource).toBe("farms");
    expect(enriched[0].resourceId).toBe("farm_1");
    expect(String(enriched[0].userId)).toBe("user_1");
  });
});

// ============================================================
// DB row → entry mapping
// ============================================================
describe("mapAction", () => {
  test("maps _created suffixes to create", () => {
    expect(mapAction("crop_created")).toBe("create");
    expect(mapAction("farm_created")).toBe("create");
  });

  test("maps _updated suffixes to update", () => {
    expect(mapAction("crop_updated")).toBe("update");
  });

  test("maps _deleted suffixes to delete", () => {
    expect(mapAction("crop_deleted")).toBe("delete");
  });

  test("maps role_changed to role_change", () => {
    expect(mapAction("role_changed")).toBe("role_change");
  });

  test("maps subscription/trial actions to subscription", () => {
    expect(mapAction("subscription_activated")).toBe("subscription");
    expect(mapAction("trial_started")).toBe("subscription");
  });

  test("maps payment actions to payment", () => {
    expect(mapAction("payment_failed")).toBe("payment");
  });

  test("unknown actions default to view", () => {
    expect(mapAction("mystery_event")).toBe("view");
  });
});

describe("mapEntity", () => {
  test("maps resource names to entity types", () => {
    expect(mapEntity("farms")).toBe("farm");
    expect(mapEntity("crops")).toBe("crop");
    expect(mapEntity("livestock")).toBe("livestock");
    expect(mapEntity("transactions")).toBe("transaction");
    expect(mapEntity("users")).toBe("user");
    expect(mapEntity("consultations")).toBe("agronomist");
  });

  test("unknown resources default to system", () => {
    expect(mapEntity("widgets")).toBe("system");
  });
});

describe("mapRow", () => {
  test("converts a full DB row into an entry with failure status", () => {
    const entry = mapRow({
      _id: "a1",
      userId: "u1",
      userName: "John",
      userRole: "farmer",
      action: "payment_failed",
      resource: "transactions",
      resourceId: "t1",
      changes: { field: "status", oldValue: "pending", newValue: "failed" },
      createdAt: 1750000000000,
    });
    expect(entry.id).toBe("a1");
    expect(entry.status).toBe("failure");
    expect(entry.action).toBe("payment");
    expect(entry.entityType).toBe("transaction");
    expect(entry.entityId).toBe("t1");
    expect(entry.userName).toBe("John");
    expect(entry.timestamp.getTime()).toBe(1750000000000);
    expect(entry.description).toContain("Payment transaction");
  });

  test("defaults to success status for non-failed actions", () => {
    const entry = mapRow({
      _id: "a2",
      userId: "u1",
      userName: "John",
      action: "crop_created",
      resource: "crops",
      resourceId: "c1",
      createdAt: 1750000000000,
    });
    expect(entry.status).toBe("success");
    expect(entry.action).toBe("create");
    expect(entry.entityType).toBe("crop");
  });
});

// ============================================================
// Label helpers
// ============================================================
describe("label helpers", () => {
  test("action labels are human readable", () => {
    expect(getActionLabel("create")).toBe("Created");
    expect(getActionLabel("role_change")).toBe("Role Changed");
  });

  test("entity labels are human readable", () => {
    expect(getEntityLabel("farm")).toBe("Farm");
    expect(getEntityLabel("livestock")).toBe("Livestock");
  });
});
