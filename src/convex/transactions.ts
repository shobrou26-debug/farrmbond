import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  verifyTransactionOwnership,
  verifyFarmOwnership,
  createAuditLog,
  validateString,
  validateNumber,
  sanitizeInput,
} from "./authHelpers";
import { convertCurrency } from "./currency";

// ============================================================
// Transaction Queries
// ============================================================

/** Get all transactions for the current user */
export const listUserTransactions = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    return await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Paginated transaction list for the current user (P2-3).
 * Use for surfaces where the transaction history can grow large;
 * the legacy `listUserTransactions` keeps the array contract for
 * consumers that render the full list.
 */
export const listUserTransactionsPaginated = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    return await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** Get transactions for a specific farm */
export const listFarmTransactions = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    return await ctx.db
      .query("transactions")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();
  },
});

/**
 * Paginated transaction list for a specific farm (P2-3).
 * See `listUserTransactionsPaginated` for rationale.
 */
export const listFarmTransactionsPaginated = query({
  args: {
    farmId: v.id("farms"),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    return await ctx.db
      .query("transactions")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Get financial summary for the current user.
 *
 * Currency-safe aggregation: each transaction stores the currency it was
 * entered in (the user's currency at entry time, KES by default), so every
 * row is converted from its OWN stored currency into the user's configured
 * display currency before summing — the same per-row pattern the frontend
 * uses on the Dashboard and Finances pages (shared conversion module). This
 * prevents mixed-currency transactions from producing misleading totals.
 */
export const getFinancialSummary = query({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireAuth(ctx);
    const displayCurrency = user.currency ?? "KES";

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Convert each stored amount into the user's configured display currency.
    const amountOf = (t: { amount: number; currency?: string | null }) =>
      convertCurrency(t.amount, t.currency ?? "KES", displayCurrency);

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const thisMonth = transactions.filter((t) => t.date >= thirtyDaysAgo);
    const lastMonth = transactions.filter(
      (t) => t.date >= thirtyDaysAgo - 30 * 24 * 60 * 60 * 1000 && t.date < thirtyDaysAgo
    );

    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + amountOf(t), 0);
    const totalExpenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + amountOf(t), 0);

    const thisMonthIncome = thisMonth
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + amountOf(t), 0);
    const thisMonthExpenses = thisMonth
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + amountOf(t), 0);

    const lastMonthIncome = lastMonth
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + amountOf(t), 0);
    const lastMonthExpenses = lastMonth
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + amountOf(t), 0);

    return {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      thisMonthIncome,
      thisMonthExpenses,
      thisMonthProfit: thisMonthIncome - thisMonthExpenses,
      lastMonthIncome,
      lastMonthExpenses,
      lastMonthProfit: lastMonthIncome - lastMonthExpenses,
      incomeChange: lastMonthIncome > 0 
        ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 
        : 0,
      expenseChange: lastMonthExpenses > 0 
        ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 
        : 0,
    };
  },
});

/**
 * Monthly income/expense/profit breakdown for the last N months.
 * Used by the Analytics page chart and exports.
 *
 * Currency-safe: like `getFinancialSummary`, every row is converted from its
 * own stored currency into the user's configured display currency before the
 * monthly buckets are summed (shared conversion module with the frontend).
 */
export const getMonthlyFinancialSummary = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const displayCurrency = user.currency ?? "KES";

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const amountOf = (t: { amount: number; currency?: string | null }) =>
      convertCurrency(t.amount, t.currency ?? "KES", displayCurrency);

    const months = Math.min(12, Math.max(1, args.months ?? 7));
    const now = new Date();
    const result: { month: string; income: number; expenses: number; profit: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();

      const monthTx = transactions.filter((t) => t.date >= start && t.date < end);
      const income = monthTx
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + amountOf(t), 0);
      const expenses = monthTx
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + amountOf(t), 0);

      result.push({
        month: d.toLocaleString("en", { month: "short" }),
        income,
        expenses,
        profit: income - expenses,
      });
    }

    return result;
  },
});

// ============================================================
// Transaction Mutations
// ============================================================

/** Create a new transaction */
export const createTransaction = mutation({
  args: {
    farmId: v.id("farms"),
    cropId: v.optional(v.id("crops")),
    livestockId: v.optional(v.id("livestock")),
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(),
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    date: v.number(),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    // Verify user owns the farm
    await verifyFarmOwnership(ctx, args.farmId, userId);

    // Input validation
    const category = sanitizeInput(validateString(args.category, "Category", 50));
    const description = sanitizeInput(validateString(args.description, "Description", 500));
    validateNumber(args.amount, "Amount", 0.01, 100000000);

    const now = Date.now();

    const transactionId = await ctx.db.insert("transactions", {
      userId,
      farmId: args.farmId,
      cropId: args.cropId,
      livestockId: args.livestockId,
      type: args.type,
      category,
      description,
      amount: args.amount,
      currency: args.currency,
      date: args.date,
      paymentMethod: args.paymentMethod ? sanitizeInput(args.paymentMethod) : undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "transaction_created",
      resource: "transactions",
      resourceId: transactionId,
      changes: { type: args.type, category, amount: args.amount, farmId: args.farmId },
    });

    return transactionId;
  },
});

/** Delete a transaction */
export const deleteTransaction = mutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const transaction = await verifyTransactionOwnership(ctx, args.transactionId, userId);

    await ctx.db.delete(args.transactionId);

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "transaction_deleted",
      resource: "transactions",
      resourceId: args.transactionId,
      changes: { type: transaction.type, amount: transaction.amount, category: transaction.category } as Record<string, unknown>,
    });

    return true;
  },
});
