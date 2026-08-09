import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

// ============================================================
// Irrigation Data Hook
// ============================================================
// Page → Hook → Convex API → server auth/ownership → DB → reactive UI
//
// All queries are reactive subscriptions. When farmId is provided the
// queries are scoped to that farm (still ownership-checked server-side);
// when omitted they cover all of the user's farms.

export function useIrrigation(farmId?: Id<"farms">) {
  const schedules = useQuery(
    api.irrigation.listMySchedules,
    farmId ? { farmId } : {}
  );
  const history = useQuery(
    api.irrigation.getIrrigationHistory,
    farmId ? { farmId, limit: 50 } : { limit: 50 }
  );
  const alerts = useQuery(
    api.irrigation.getIrrigationAlerts,
    farmId ? { farmId } : {}
  );
  const soil = useQuery(api.soil.getSoilAnalysis, farmId ? { farmId } : "skip");
  const farms = useQuery(api.farms.listUserFarms, {});

  const createSchedule = useMutation(api.irrigation.createSchedule);
  const updateSchedule = useMutation(api.irrigation.updateSchedule);
  const deleteSchedule = useMutation(api.irrigation.deleteSchedule);
  const enableSchedule = useMutation(api.irrigation.enableSchedule);
  const disableSchedule = useMutation(api.irrigation.disableSchedule);
  const recordIrrigation = useMutation(api.irrigation.recordIrrigation);

  const isLoading =
    (farms === undefined || schedules === undefined) && farmId === undefined
      ? schedules === undefined && farms === undefined
      : schedules === undefined;

  return {
    schedules: schedules ?? [],
    history: history ?? [],
    alerts: alerts ?? [],
    soil,
    farms: farms?.page ?? [],
    isLoading,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    enableSchedule,
    disableSchedule,
    recordIrrigation,
  };
}
