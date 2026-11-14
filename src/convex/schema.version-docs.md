# Schema Version Control — FarmBond Convex Backend

## Overview
The database schema is defined in `src/convex/schema.ts` using Convex's `defineSchema`. This file IS the schema version control — it lives in Git and all changes must go through it.

## Change Process

### 1. Make the change
Edit `src/convex/schema.ts` to add/rename/modify tables or fields. Follow these rules:

**Safe changes (no migration needed):**
- Add new `v.optional()` fields to existing tables
- Add new tables (they won't affect existing data)
- Add new validators/const enums (extend, don't replace)
- Change documentation comments

**Requires care:**
- Modify existing validators — ensure backward compatibility
- Change field types — verify no existing data is broken
- Remove fields — NOT allowed (data loss)

**Requires migration:**
- Change field from optional to required — migrate existing nulls first
- Rename fields — rename in schema AND migrate data
- Change validator from one union to another — ensure old values still validate or migrate

### 2. Run schema validation
```bash
npx convex codegen
```
This validates the schema and regenerates `src/convex/_generated/`.

### 3. Run all tests
```bash
bun test --run
```
Verify 100% pass — no regressions.

### 4. Commit the change
```bash
git add src/convex/schema.ts
git commit -m "feat: add field X to table Y — adds Z capability"
```

### 5. Deploy (operational, not CI)
```bash
npx convex deploy
```
This applies the schema change to the Convex deployment. 
- **Merlin dev**: `grateful-marlin-992`
- **Never** deploy to production Tapir: `affable-tapir-774`
- **Never** commit secrets or modify `.env` files as part of schema changes

## Rollback Limitations
- Convex does NOT support automatic schema rollback
- If a schema change corrupts data, restoration requires:
  1. Manual data recovery from backups (if available)
  2. Re-deploying to the previous schema version
  3. Data reconstruction from audit logs
- **Prevention**: Always run `bun test --run` after schema changes. If any test fails, revert the schema change immediately.
- **Safety**: Never make a schema change without first running the full test suite.

## Field Addition Pattern
```typescript
// SAFE: Add optional field to existing table
users: defineTable({
  // ... existing fields
  newField: v.optional(v.string()),  // ← adds new optional field
})
.index("by_new_field", ["newField"])  // ← optional index if queried
```

## Table Addition Pattern
```typescript
// SAFE: Add new table (doesn't affect existing data)
newTable: defineTable({
  userId: v.id("users"),
  name: v.string(),
  createdAt: v.number(),
})
.index("by_user", ["userId"])
```

## Never Do These Things
- ❌ Remove a table or field (data loss)
- ❌ Change a field from `v.string()` to `v.number()` (type mismatch)
- ❌ Make a field required without migrating existing data first
- ❌ Run `npx convex deploy` as part of CI (it's a manual operational step)
- ❌ Modify `.env.local` or `.env.production` in schema change commits
- ❌ Change `PAID_CHECKOUT_ENABLED`
</DOCS
