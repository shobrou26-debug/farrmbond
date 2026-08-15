import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/convex/_generated/api";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sprout,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Camera,
  CheckCircle2,
  MapPin,
  CalendarDays,
  CalendarClock,
  Coins,
  HeartPulse,
  Package,
  Loader2,
} from "lucide-react";

// ============================================================
// Realistic agricultural photography
// Same approach as Landing/Auth/Dashboard/Farms (Unsplash).
// A crop's real name maps to a real photo of that crop; anything
// unmapped falls back to a generic field photo. ResponsiveImage
// handles load failures with a clean error state.
// ============================================================

const CROP_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=900&auto=format&fit=crop";

const cropImageMap: Record<string, string> = {
  tomato:
    "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=900&auto=format&fit=crop",
  maize:
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=900&auto=format&fit=crop",
  corn:
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=900&auto=format&fit=crop",
  wheat:
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=900&auto=format&fit=crop",
  rice:
    "https://images.unsplash.com/photo-1550317138-10000687a72b?q=80&w=900&auto=format&fit=crop",
  potato:
    "https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=900&auto=format&fit=crop",
  sunflower:
    "https://images.unsplash.com/photo-1470509037663-253afd7f0f51?q=80&w=900&auto=format&fit=crop",
};

function getCropImage(name: string): string {
  const key = Object.keys(cropImageMap).find((k) => name.toLowerCase().includes(k));
  return key ? cropImageMap[key] : CROP_IMAGE_FALLBACK;
}

function typeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function healthBarColor(score: number): string {
  if (score >= 90) return "linear-gradient(90deg, #4ade80, #16a34a)";
  if (score >= 70) return "linear-gradient(90deg, #fbbf24, #d97706)";
  return "linear-gradient(90deg, #f87171, #dc2626)";
}

const statusConfig: Record<string, { label: string; badge: string }> = {
  seedling: {
    label: "Seedling",
    badge: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  growing: {
    label: "Growing",
    badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  flowering: {
    label: "Flowering",
    badge: "border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  },
  fruiting: {
    label: "Fruiting",
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  harvest_ready: {
    label: "Harvest Ready",
    badge: "border-lime-600/25 bg-lime-500/10 text-lime-700 dark:text-lime-300",
  },
  harvested: {
    label: "Harvested",
    badge: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  failed: {
    label: "Failed",
    badge: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

const cropTypes = ["vegetable", "grain", "legume", "tuber", "fruit", "herb", "other"];

type Crop = {
  _id: string;
  name: string;
  variety?: string;
  type: string;
  farmId: string;
  status: string;
  healthScore: number;
  plantingDate: number;
  expectedHarvestDate?: number;
  quantity: number;
  unit: string;
  expectedYield?: number;
  seedCost?: number;
  fertilizerCost?: number;
  laborCost?: number;
  otherCosts?: number;
};

const emptyForm = {
  name: "",
  variety: "",
  type: "vegetable",
  farmId: "",
  plantingDate: "",
  quantity: "",
  unit: "kg",
  expectedYield: "",
  seedCost: "",
  fertilizerCost: "",
  laborCost: "",
  otherCosts: "",
};

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

export default function Crops() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editCrop, setEditCrop] = useState<Crop | null>(null);
  const [detailCrop, setDetailCrop] = useState<Crop | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const createCrop = useMutation(api.crops.createCrop);
  const updateCrop = useMutation(api.crops.updateCrop);
  const deleteCrop = useMutation(api.crops.deleteCrop);

  const { results: crops, isLoading, sentinelRef, canLoadMore, loadMore } =
    usePaginatedQuery<Crop>(api.crops.listUserCrops);
  const farmsResult = useQuery(api.farms.listUserFarms, {
    paginationOpts: { numItems: 200, cursor: null },
  });
  const { format } = useCurrency();

  const farmList = useMemo<{ _id: string; name: string }[]>(
    () =>
      (farmsResult?.page ?? []).map((f: { _id: string; name: string }) => ({
        _id: f._id,
        name: f.name,
      })),
    [farmsResult]
  );

  const farmMap = useMemo(() => {
    const map = new Map<string, { _id: string; name: string }>();
    farmList.forEach((f) => map.set(f._id, f));
    return map;
  }, [farmList]);

  const filteredCrops = crops.filter(
    (crop) =>
      crop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (crop.variety || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = crops.filter((c) => c.status !== "harvested" && c.status !== "failed").length;
  const harvestReady = crops.filter((c) => c.status === "harvest_ready").length;
  // Average of RECORDED health scores only; null when none are scored.
  const scoredCrops = crops.filter((c) => typeof c.healthScore === "number");
  const avgHealth =
    scoredCrops.length > 0
      ? Math.round(
          scoredCrops.reduce((sum, c) => sum + (c.healthScore as number), 0) / scoredCrops.length
        )
      : null;
  const totalInvested = crops.reduce((sum, c) => sum + totalCost(c), 0);

  const containerVariants = useMemo(
    () =>
      shouldReduceMotion
        ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
        : { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } },
    [shouldReduceMotion]
  );
  const itemVariants = useMemo(
    () =>
      shouldReduceMotion
        ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
        : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } },
    [shouldReduceMotion]
  );

  const resetForm = () => setForm(emptyForm);

  const openAdd = () => {
    resetForm();
    setForm((f) => ({ ...f, farmId: farmMap.size > 0 ? farmMap.keys().next().value as string : "" }));
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a crop name");
      return;
    }
    if (!form.farmId) {
      toast.error("Please select a farm");
      return;
    }
    const quantity = parseFloat(form.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    const plantingDate = new Date(form.plantingDate).getTime();
    if (isNaN(plantingDate)) {
      toast.error("Please select a planting date");
      return;
    }

    setSaving(true);
    try {
      await createCrop({
        farmId: form.farmId as any,
        name: form.name,
        variety: form.variety || undefined,
        type: form.type,
        plantingDate,
        quantity,
        unit: form.unit,
        expectedYield: form.expectedYield ? parseFloat(form.expectedYield) : undefined,
        seedCost: form.seedCost ? parseFloat(form.seedCost) : undefined,
        fertilizerCost: form.fertilizerCost ? parseFloat(form.fertilizerCost) : undefined,
        laborCost: form.laborCost ? parseFloat(form.laborCost) : undefined,
        otherCosts: form.otherCosts ? parseFloat(form.otherCosts) : undefined,
      });
      toast.success("Crop added successfully");
      setAddOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add crop");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!editCrop) return;
    setSaving(true);
    try {
      await updateCrop({ cropId: editCrop._id as any, status: status as any });
      toast.success("Crop updated");
      setEditCrop(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update crop");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (crop: Crop) => {
    if (!window.confirm(`Delete "${crop.name}"? This cannot be undone.`)) return;
    try {
      await deleteCrop({ cropId: crop._id as any });
      toast.success("Crop deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete crop");
    }
  };

  function totalCost(crop: Crop) {
    return (crop.seedCost || 0) + (crop.fertilizerCost || 0) + (crop.laborCost || 0) + (crop.otherCosts || 0);
  }

  function daysToHarvest(crop: Crop): number | null {
    if (!crop.expectedHarvestDate) return null;
    const days = Math.ceil((crop.expectedHarvestDate - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] p-3 sm:p-4 md:p-6 lg:p-8">
        {/* ============ Page header ============ */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your Crops</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Monitor and manage every crop across your farms — growth, health and harvest in one place.
              </p>
            </div>
            <Button
              onClick={openAdd}
              className="h-12 w-full touch-target rounded-full bg-brand px-6 text-brand-foreground hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Crop
            </Button>
          </div>
        </motion.div>

        {/* ============ Summary stats (real data only) ============ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
        >
          <Card className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                <Sprout className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">Active Crops</p>
                <p className="text-xl font-bold sm:text-2xl">{activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">Ready to Harvest</p>
                <p className="text-xl font-bold sm:text-2xl">{harvestReady}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">Avg Health</p>
                <p className="truncate text-xl font-bold sm:text-2xl">{avgHealth !== null ? `${avgHealth}%` : "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                <Coins className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">Cost Invested</p>
                <p className="truncate text-xl font-bold sm:text-2xl">{totalInvested > 0 ? format(totalInvested) : "—"}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ============ Search toolbar ============ */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search crops or varieties..."
                className="h-11 rounded-xl pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search crops"
              />
            </div>
            {searchQuery && filteredCrops.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {filteredCrops.length} of {crops.length} crops
              </p>
            )}
          </div>
        </motion.div>

        {/* ============ Crops grid ============ */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                <div className="aspect-[16/10] animate-pulse bg-muted/50" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted/60" />
                  <div className="h-3 w-1/3 animate-pulse rounded-full bg-muted/40" />
                  <div className="h-8 animate-pulse rounded-xl bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCrops.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border/80 bg-card/50 px-6 py-16 text-center">
            {searchQuery ? (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                  <Search className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-xl font-bold tracking-tight">No crops match your search</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Try a different crop name or variety.
                </p>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand-foreground dark:text-brand">
                  <Sprout className="h-8 w-8" />
                </div>
                <h2 className="mt-5 text-xl font-bold tracking-tight">You haven't added any crops yet</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Add your first crop to start tracking growth, health, costs and harvest across your farms.
                </p>
                <Button
                  onClick={openAdd}
                  className="mt-6 h-12 touch-target rounded-full bg-brand px-7 text-brand-foreground hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Crop
                </Button>
              </>
            )}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {filteredCrops.map((crop) => {
              const status = statusConfig[crop.status] || statusConfig.growing;
              const farmName = farmMap.get(crop.farmId)?.name || "Unknown Farm";
              const cost = totalCost(crop);
              const harvestIn = daysToHarvest(crop);
              const health = typeof crop.healthScore === "number" ? (crop.healthScore as number) : null;
              return (
                <motion.div key={crop._id} variants={itemVariants}>
                  <Card className="group h-full overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5">
                    {/* Cover image */}
                    <div className="relative">
                      <ResponsiveImage
                        src={getCropImage(crop.name)}
                        alt={`${crop.name} crop`}
                        aspectRatio="aspect-[16/10]"
                        className="transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/10" />
                      <div className="absolute left-3 top-3">
                        <Badge className={`border backdrop-blur-sm ${status.badge}`}>{status.label}</Badge>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold tracking-tight text-white drop-shadow-sm">
                            {crop.name}
                          </h3>
                          <p className="truncate text-xs text-white/85">
                            {crop.variety || typeLabel(crop.type)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                          {typeLabel(crop.type)}
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-5">
                      {/* Farm */}
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-foreground dark:text-brand" />
                        <span className="truncate">{farmName}</span>
                      </div>

                      {/* Key info */}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <InfoTile
                          icon={<CalendarDays className="h-3.5 w-3.5" />}
                          label="Planted"
                          value={new Date(crop.plantingDate).toLocaleDateString()}
                        />
                        <InfoTile
                          icon={<CalendarClock className="h-3.5 w-3.5" />}
                          label="Harvest"
                          value={
                            harvestIn !== null
                              ? `In ${harvestIn} days`
                              : crop.expectedHarvestDate
                                ? new Date(crop.expectedHarvestDate).toLocaleDateString()
                                : "—"
                          }
                        />
                        <InfoTile
                          icon={<Package className="h-3.5 w-3.5" />}
                          label="Quantity"
                          value={`${crop.quantity} ${crop.unit}`}
                        />
                        <InfoTile
                          icon={<HeartPulse className="h-3.5 w-3.5" />}
                          label="Health"
                          value={health !== null ? `${health}%` : "No data"}
                        />
                      </div>

                      {/* Health bar */}
                      <div className="mt-4">
                        {health !== null ? (
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${health}%`, background: healthBarColor(health) }}
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No health data yet</p>
                        )}
                      </div>

                      {/* Cost */}
                      {cost > 0 && (
                        <div className="mt-3 flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                          <span className="text-muted-foreground">Total cost</span>
                          <span className="font-semibold">{format(cost)}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-4 flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="h-10 flex-1 touch-target rounded-xl"
                          onClick={() => setDetailCrop(crop)}
                        >
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          className="h-10 w-10 touch-target rounded-xl px-0"
                          onClick={() => navigate("/disease-detection")}
                          aria-label={`Check ${crop.name} for disease`}
                          title="Disease Check"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 touch-target rounded-xl"
                              aria-label={`Actions for ${crop.name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailCrop(crop)}>
                              <Eye className="h-4 w-4 mr-2" />View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditCrop(crop)}>
                              <Edit className="h-4 w-4 mr-2" />Edit Status
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate("/disease-detection")}>
                              <Camera className="h-4 w-4 mr-2" />Disease Check
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(crop)}>
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* ============ Infinite scroll sentinel ============ */}
        {canLoadMore && (
          <div ref={sentinelRef} className="mt-6 flex h-12 items-center justify-center">
            <Button variant="outline" size="sm" className="rounded-full px-6" onClick={loadMore}>
              Load more crops
            </Button>
          </div>
        )}

        {/* ============ Add Crop Dialog ============ */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Add Crop</DialogTitle>
              <DialogDescription>Record a new crop for one of your farms.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Crop details */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-foreground dark:text-brand">
                  Crop details
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Crop name *</Label>
                    <Input placeholder="e.g. Tomatoes" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Variety</Label>
                    <Input placeholder="e.g. Roma VF" value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cropTypes.map((t) => (
                          <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Farm *</Label>
                    <Select value={form.farmId} onValueChange={(v) => setForm({ ...form, farmId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select farm" /></SelectTrigger>
                      <SelectContent>
                        {farmList.map((f) => (
                          <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Planting & quantity */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-foreground dark:text-brand">
                  Planting &amp; quantity
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Planting date *</Label>
                    <Input type="date" value={form.plantingDate} onChange={(e) => setForm({ ...form, plantingDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity *</Label>
                    <Input type="number" min="0" placeholder="e.g. 500" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Input placeholder="e.g. plants, kg, acres" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected yield</Label>
                    <Input type="number" min="0" placeholder="e.g. 2400 (kg)" value={form.expectedYield} onChange={(e) => setForm({ ...form, expectedYield: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Costs */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-foreground dark:text-brand">
                  Costs
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Seed cost</Label>
                    <Input type="number" min="0" placeholder="0" value={form.seedCost} onChange={(e) => setForm({ ...form, seedCost: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fertilizer cost</Label>
                    <Input type="number" min="0" placeholder="0" value={form.fertilizerCost} onChange={(e) => setForm({ ...form, fertilizerCost: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Labor cost</Label>
                    <Input type="number" min="0" placeholder="0" value={form.laborCost} onChange={(e) => setForm({ ...form, laborCost: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Other costs</Label>
                    <Input type="number" min="0" placeholder="0" value={form.otherCosts} onChange={(e) => setForm({ ...form, otherCosts: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Crop
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ Edit Status Dialog ============ */}
        <Dialog open={!!editCrop} onOpenChange={(o) => !o && setEditCrop(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Update {editCrop?.name}</DialogTitle>
              <DialogDescription>Change the crop status to reflect its current stage.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editCrop?.status}
                onValueChange={(v) => handleUpdateStatus(v)}
                disabled={saving}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditCrop(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ============ Detail Dialog ============ */}
        <Dialog open={!!detailCrop} onOpenChange={(o) => !o && setDetailCrop(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">{detailCrop?.name}</DialogTitle>
              <DialogDescription>{detailCrop?.variety || (detailCrop ? typeLabel(detailCrop.type) : "")}</DialogDescription>
            </DialogHeader>
            {detailCrop && (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl">
                  <ResponsiveImage
                    src={getCropImage(detailCrop.name)}
                    alt={`${detailCrop.name} crop`}
                    aspectRatio="aspect-video"
                  />
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Farm</span><span className="font-medium">{farmMap.get(detailCrop.farmId)?.name || "Unknown"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{statusConfig[detailCrop.status]?.label || detailCrop.status}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Health</span><span className="font-medium">{detailCrop.healthScore != null ? `${detailCrop.healthScore}%` : "No score yet"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Planted</span><span>{new Date(detailCrop.plantingDate).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Expected harvest</span><span>{detailCrop.expectedHarvestDate ? new Date(detailCrop.expectedHarvestDate).toLocaleDateString() : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span className="font-medium">{detailCrop.quantity} {detailCrop.unit}</span></div>
                  {detailCrop.expectedYield !== undefined && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Expected yield</span><span className="font-medium">{detailCrop.expectedYield} {detailCrop.unit}</span></div>
                  )}
                  {totalCost(detailCrop) > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Total cost</span><span className="font-medium">{format(totalCost(detailCrop))}</span></div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailCrop(null)}>Close</Button>
              {detailCrop && (
                <Button className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90" onClick={() => navigate("/disease-detection")}>
                  <Camera className="h-4 w-4" />Disease Check
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
