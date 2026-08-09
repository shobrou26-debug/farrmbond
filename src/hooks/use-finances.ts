import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// ============================================================
// Finances Data Hook
// ============================================================
// Page → Hook → Convex API → server auth/ownership → DB → reactive UI
//
// All queries are reactive subscriptions: any create/delete mutation
// instantly refreshes the transaction list and summary below.

export function useFinances() {
  const transactions = useQuery(api.transactions.listUserTransactions);
  const summary = useQuery(api.transactions.getFinancialSummary);
  const monthly = useQuery(api.transactions.getMonthlyFinancialSummary, { months: 7 });
  const farms = useQuery(api.farms.listUserFarms, {});

  const createTransaction = useMutation(api.transactions.createTransaction);
  const deleteTransaction = useMutation(api.transactions.deleteTransaction);

  // listUserFarms (no pagination args) resolves to { page, isDone, continueCursor }
  const farmOptions = farms?.page ?? [];

  const isLoading = transactions === undefined && summary === undefined && farms === undefined;

  return {
    transactions: transactions ?? [],
    summary,
    monthly: monthly ?? [],
    farms: farmOptions,
    isLoading,
    createTransaction,
    deleteTransaction,
  };
}
