import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ============================================================
// Transaction Queries
// ============================================================

/** Get all transactions for the current user */
export const listUserTransactions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Get transactions for a specific farm */
export const listFarmTransactions = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("transactions")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();
  },
});

/** Get financial summary for the current user */
export const getFinancialSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const thisMonth = transactions.filter((t) => t.date >= thirtyDaysAgo);
    const lastMonth = transactions.filter(
      (t) => t.date >= thirtyDaysAgo - 30 * 24 * 60 * 60 * 1000 && t.date < thirtyDaysAgo
    );

    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const thisMonthIncome = thisMonth
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const thisMonthExpenses = thisMonth
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const lastMonthIncome = lastMonth
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const lastMonthExpenses = lastMonth
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    return await ctx.db.insert("transactions", {
      userId,
      farmId: args.farmId,
      cropId: args.cropId,
      livestockId: args.livestockId,
      type: args.type,
      category: args.category,
      description: args.description,
      amount: args.amount,
      currency: args.currency,
      date: args.date,
      paymentMethod: args.paymentMethod,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Delete a transaction */
export const deleteTransaction = mutation({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction || transaction.userId !== userId) throw new Error("Transaction not found");

    await ctx.db.delete(args.transactionId);
    return true;
  },
});
