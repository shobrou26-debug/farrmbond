import { describe, expect, test } from "bun:test";
import {
  verifyTransactionOwnership,
  verifyFarmOwnership,
  verifyCropOwnership,
} from "../convex/authHelpers";

// ============================================================
// Fake Convex ctx: only the `db.get` surface used by the
// ownership verifiers is mocked.
// ============================================================
function makeCtx(docs: Record<string, unknown>) {
  return {
    db: {
      get: async (id: string) => docs[id] ?? null,
    },
  } as never;
}

const userId = "user_owner";

// ============================================================
// Transaction ownership
// ============================================================
describe("verifyTransactionOwnership", () => {
  test("returns the transaction when the user owns it", async () => {
    const ctx = makeCtx({ txn_1: { _id: "txn_1", userId, amount: 500 } });
    const txn = await verifyTransactionOwnership(ctx, "txn_1", userId);
    expect(String(txn._id)).toBe("txn_1");
    expect(String(txn.userId)).toBe(userId);
  });

  test("throws when the transaction does not exist", async () => {
    const ctx = makeCtx({});
    await expect(
      verifyTransactionOwnership(ctx, "missing", userId)
    ).rejects.toThrow(/not found/);
  });

  test("throws when another user owns the transaction", async () => {
    const ctx = makeCtx({ txn_1: { _id: "txn_1", userId: "user_intruder" } });
    await expect(
      verifyTransactionOwnership(ctx, "txn_1", userId)
    ).rejects.toThrow(/do not own/);
  });
});

// ============================================================
// Farm ownership
// ============================================================
describe("verifyFarmOwnership", () => {
  test("returns the farm when the user owns it", async () => {
    const ctx = makeCtx({ farm_1: { _id: "farm_1", userId, name: "Sunrise Ranch" } });
    const farm = await verifyFarmOwnership(ctx, "farm_1", userId);
    expect(farm.name).toBe("Sunrise Ranch");
    expect(String(farm._id)).toBe("farm_1");
  });

  test("throws when the farm does not exist", async () => {
    const ctx = makeCtx({});
    await expect(verifyFarmOwnership(ctx, "missing", userId)).rejects.toThrow(
      /not found/
    );
  });

  test("throws when another user owns the farm", async () => {
    const ctx = makeCtx({ farm_1: { _id: "farm_1", userId: "user_intruder" } });
    await expect(verifyFarmOwnership(ctx, "farm_1", userId)).rejects.toThrow(
      /do not own/
    );
  });
});

// ============================================================
// Crop ownership
// ============================================================
describe("verifyCropOwnership", () => {
  test("returns the crop when the user owns it", async () => {
    const ctx = makeCtx({ crop_1: { _id: "crop_1", userId, name: "Maize" } });
    const crop = await verifyCropOwnership(ctx, "crop_1", userId);
    expect(crop.name).toBe("Maize");
    expect(String(crop._id)).toBe("crop_1");
  });

  test("throws when another user owns the crop", async () => {
    const ctx = makeCtx({ crop_1: { _id: "crop_1", userId: "user_intruder" } });
    await expect(verifyCropOwnership(ctx, "crop_1", userId)).rejects.toThrow(
      /do not own/
    );
  });

  test("throws when the crop does not exist", async () => {
    const ctx = makeCtx({});
    await expect(verifyCropOwnership(ctx, "missing", userId)).rejects.toThrow(
      /not found/
    );
  });
});

// ============================================================
// createAuditLog — important mutation helper
// ============================================================
describe("createAuditLog", () => {
  test("persists an audit entry with the correct fields", async () => {
    let inserted: Record<string, unknown> | null = null;
    const ctx = {
      db: {
        insert: async (_table: string, doc: Record<string, unknown>) => {
          inserted = doc;
          return "audit_1";
        },
      },
    } as never;

    const { createAuditLog } = await import("../convex/authHelpers");
    await createAuditLog(ctx as never, {
      userId,
      action: "transaction_created",
      resource: "transactions",
      resourceId: "txn_1",
      changes: { amount: 100 },
    });

    expect(inserted).not.toBeNull();
    expect(inserted!.userId).toBe(userId);
    expect(inserted!.action).toBe("transaction_created");
    expect(inserted!.resource).toBe("transactions");
    expect(inserted!.resourceId).toBe("txn_1");
    expect(inserted!.changes).toEqual({ amount: 100 });
    expect(typeof inserted!.createdAt).toBe("number");
  });
});
