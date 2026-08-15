import { useState, useRef } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHaptic, useSwipeGesture, useIsMobile } from "@/hooks/use-mobile";
import {
  Map,
  Plus,
  Leaf,
  Droplets,
  Satellite,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Navigation,
  Activity,
  LandPlot,
  Sprout,
} from "lucide-react";
import { Link } from "react-router";
import { SatelliteViewer } from "@/components/SatelliteViewer";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// Realistic agricultural imagery (same strategy as Landing/Auth/Dashboard)
// ============================================================

const DEFAULT_FARM_IMAGE =
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=1200&auto=format&fit=crop";

const cropImageMap: Record<string, string> = {
  tomato:
    "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=1200&auto=format&fit=crop",
  maize:
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=1200&auto=format&fit=crop",
  corn:
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=1200&auto=format&fit=crop",
  wheat:
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=1200&auto=format&fit=crop",
  rice:
    "https://images.unsplash.com/photo-1550317138-10000687a72b?q=80&w=1200&auto=format&fit=crop",
  potato:
    "https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=1200&auto=format&fit=crop",
  sunflower:
    "https://images.unsplash.com/photo-1470509037663-253afd7f0f51?q=80&w=1200&auto=format&fit=crop",
};

const defaultImages = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500076656116-558758c991c1?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=1200&auto=format&fit=crop",
];

// A real photo of a crop the farm actually grows (when determinable).
function getCropImage(name: string): string {
  const key = Object.keys(cropImageMap).find((k) => name.toLowerCase().includes(k));
  return key ? cropImageMap[key] : DEFAULT_FARM_IMAGE;
}

// ============================================================
// Animation (respects prefers-reduced-motion)
// ============================================================

function useEntranceVariants() {
  const shouldReduceMotion = useReducedMotion();
  const duration = shouldReduceMotion ? 0 : 0.4;
  const stagger = shouldReduceMotion ? 0 : 0.08;
  return {
    container: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: stagger } },
    },
    item: {
      hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
      visible: { opacity: 1, y: 0, transition: { duration } },
    },
  };
}

// ============================================================
// Farm Card Component
// ============================================================

function FarmCard({
  farm,
  index,
  variants,
}: {
  farm: any;
  index: number;
  variants: Variants;
}) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [satelliteOpen, setSatelliteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const deleteFarm = useMutation(api.farms.deleteFarm);
  const cropsResult = useQuery(api.crops.listFarmCrops, { farmId: farm._id });
  const livestockResult = useQuery(api.livestock.listFarmLivestock, { farmId: farm._id });
  const crops = cropsResult?.page ?? [];
  const livestock = livestockResult?.page ?? [];

  useSwipeGesture(cardRef, {
    onSwipeLeft: () => haptic.light(),
    onSwipeRight: () => haptic.light(),
    enabled: isMobile,
  });

  // Real satellite-derived health score when available; honest "—" otherwise.
  const score: number | null =
    typeof farm.ndviScore === "number" && Number.isFinite(farm.ndviScore)
      ? Math.max(0, Math.min(100, farm.ndviScore))
      : null;
  const getHealthColor = (s: number) => {
    if (s >= 90) return "text-green-700 bg-green-500/10 border-green-500/20 dark:text-green-400";
    if (s >= 70) return "text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-400";
    return "text-red-700 bg-red-500/10 border-red-500/20 dark:text-red-400";
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete farm "${farm.name}"? This also removes its crops and livestock. This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteFarm({ farmId: farm._id });
      toast.success(`Farm "${farm.name}" deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete farm");
    } finally {
      setDeleting(false);
    }
  };

  const activeCrops = crops.filter((c: { status: string }) => c.status !== "harvested" && c.status !== "failed").length;
  const totalLivestock = livestock.reduce((sum: number, l: { quantity: number }) => sum + l.quantity, 0);
  const locationStr = [farm.location.city, farm.location.state, farm.location.country].filter(Boolean).join(", ") || `${farm.location.latitude.toFixed(2)}°, ${farm.location.longitude.toFixed(2)}°`;

  // Cover: explicit cover image > real photo of a crop this farm grows > default.
  const firstActiveCrop = crops.find(
    (c: { status: string }) => c.status !== "harvested" && c.status !== "failed",
  ) as { name?: string } | undefined;
  const coverSrc = farm.coverImage
    ? farm.coverImage
    : firstActiveCrop?.name
    ? getCropImage(firstActiveCrop.name)
    : defaultImages[index % defaultImages.length];

  // Real crop names this farm is actively growing (up to 3).
  const cropChips = crops
    .filter((c: { status: string }) => c.status !== "harvested" && c.status !== "failed")
    .map((c: { name: string }) => c.name)
    .slice(0, 3);

  return (
    <>
      <motion.div
        ref={cardRef}
        variants={variants}
        whileTap={{ scale: 0.98 }}
        className="touch-feedback tap-highlight-none"
      >
        <Card className="group overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/5">
          {/* Cover Image */}
          <div className="relative h-44 overflow-hidden sm:h-48">
            <ResponsiveImage
              src={coverSrc}
              alt={`${farm.name} farm`}
              aspectRatio=""
              className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

            <div className="absolute left-3 top-3 flex gap-2">
              <Badge className="bg-black/40 text-[11px] text-white backdrop-blur-sm">
                {farm.size} {farm.sizeUnit === "hectares" ? "ha" : "ac"}
              </Badge>
            </div>

            <div className="absolute right-3 top-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 touch-target"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Actions for ${farm.name}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => { setSatelliteOpen(true); haptic.selection(); }}>
                    <Satellite className="mr-2 h-4 w-4" />
                    Satellite View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { haptic.selection(); window.location.href = `/farms/new?farmId=${farm._id}`; }}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Farm
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" disabled={deleting} onClick={() => { haptic.error(); handleDelete(); }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deleting ? "Deleting..." : "Delete Farm"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <h3 className="truncate text-base font-semibold text-white sm:text-lg">{farm.name}</h3>
              <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                <Map className="h-3 w-3 shrink-0" />
                <span className="truncate">{locationStr}</span>
              </div>
            </div>
          </div>

          <CardContent className="p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              {score !== null ? (
                <Badge variant="outline" className={getHealthColor(score)}>
                  <Activity className="mr-1 h-3 w-3" />
                  {score}% Health
                </Badge>
              ) : (
                <Badge variant="secondary">No health data yet</Badge>
              )}
              <span className="text-[10px] capitalize text-muted-foreground sm:text-xs">{farm.status}</span>
            </div>

            {/* Crop chips — real active crops this farm grows */}
            {cropChips.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {cropChips.map((name: string) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[10px] font-medium text-brand-foreground dark:text-brand sm:text-xs"
                  >
                    <Sprout className="h-3 w-3" />
                    {name}
                  </span>
                ))}
                {activeCrops > cropChips.length && (
                  <span className="text-[10px] text-muted-foreground">
                    +{activeCrops - cropChips.length} more
                  </span>
                )}
              </div>
            )}

            <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl bg-muted/30 p-2 text-center">
                <Leaf className="mx-auto mb-1 h-4 w-4 text-brand-foreground dark:text-brand" />
                <p className="text-xs font-semibold">{activeCrops}</p>
                <p className="text-[10px] text-muted-foreground">Crops</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-2 text-center">
                <Navigation className="mx-auto mb-1 h-4 w-4 text-blue-500" />
                <p className="text-xs font-semibold">{farm.size}</p>
                <p className="text-[10px] text-muted-foreground">{farm.sizeUnit === "hectares" ? "Ha" : "Ac"}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-2 text-center">
                <Droplets className="mx-auto mb-1 h-4 w-4 text-cyan-500" />
                <p className="text-xs font-semibold">{totalLivestock}</p>
                <p className="text-[10px] text-muted-foreground">Livestock</p>
              </div>
            </div>

            <div className="mb-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="text-muted-foreground">Farm Health</span>
                <span className="font-medium">{score !== null ? `${score}%` : "—"}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${score ?? 0}%`,
                    background:
                      score !== null
                        ? score >= 90
                          ? "linear-gradient(90deg, #4ade80, #16a34a)"
                          : score >= 70
                          ? "linear-gradient(90deg, #fbbf24, #d97706)"
                          : "linear-gradient(90deg, #f87171, #dc2626)"
                        : "var(--muted)",
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Link to="/farms" className="flex-1" onClick={() => haptic.selection()}>
                <Button variant="outline" size="sm" className="w-full touch-target">
                  <Eye className="mr-1 h-4 w-4" />
                  <span className="text-xs">View</span>
                </Button>
              </Link>
              <Button
                variant="default"
                size="sm"
                className="flex-1 touch-target bg-brand text-brand-foreground hover:bg-brand/90"
                onClick={() => { setSatelliteOpen(true); haptic.selection(); }}
              >
                <Satellite className="mr-1 h-4 w-4" />
                <span className="text-xs">Satellite</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <SatelliteViewer
        open={satelliteOpen}
        onOpenChange={setSatelliteOpen}
        farmId={farm._id as Id<"farms">}
        farmName={farm.name}
        latitude={farm.location.latitude}
        longitude={farm.location.longitude}
      />
    </>
  );
}

// ============================================================
// Main Farms Component
// ============================================================

export default function Farms() {
  const haptic = useHaptic();
  const variants = useEntranceVariants();
  const { results: farms, isLoading, sentinelRef, canLoadMore, isLoadingMore } = usePaginatedQuery<{ _id: string; name: string; description?: string; location: { latitude: number; longitude: number; address?: string; city?: string; state?: string; country?: string }; size: number; sizeUnit: string; status: string; soilType?: string; soilPh?: number; ndviScore?: number; coverImage?: string; createdAt: number; updatedAt: number }>(api.farms.listUserFarms);

  const totalSize = farms?.reduce((sum: number, f: { size: number }) => sum + f.size, 0) ?? 0;
  const allAcres = farms && farms.length > 0 && farms.every((f) => f.sizeUnit === "acres");
  const areaUnit = allAcres ? "ac" : "ha";
  // Average health derived ONLY from farms that have a real satellite score.
  const avgHealth = farms && farms.length > 0
    ? (() => {
        const scored: number[] = (farms as Array<{ ndviScore?: number }>)
          .map((f) => f.ndviScore)
          .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
        if (scored.length === 0) return null;
        return Math.round(scored.reduce((sum: number, s: number) => sum + s, 0) / scored.length);
      })()
    : null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center sm:mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Farms</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your farms, fields, crops and agricultural operations from one place.
            </p>
          </div>
          <Link to="/farms/new" onClick={() => haptic.medium()}>
            <Button className="h-12 w-full rounded-full bg-brand px-6 text-brand-foreground hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25 sm:w-auto touch-target">
              <Plus className="mr-2 h-4 w-4" />
              Add Farm
            </Button>
          </Link>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
        >
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/60">
                <CardContent className="p-4 sm:p-5">
                  <Skeleton className="mb-2 h-4 w-20" />
                  <Skeleton className="h-6 w-12" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card className="border-border/60">
                <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                    <Map className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold sm:text-2xl">{farms?.length ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">Total Farms</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                    <LandPlot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold sm:text-2xl">
                      {totalSize} {areaUnit}
                    </p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">Total Area</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold sm:text-2xl">{avgHealth !== null ? `${avgHealth}%` : "—"}</p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">Avg Health</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                    <Leaf className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold sm:text-2xl">
                      {farms?.filter((f: { status: string }) => f.status === "active").length ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">Active Farms</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </motion.div>

        {/* Farms Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[26rem] rounded-2xl" />
            ))}
          </div>
        ) : farms && farms.length > 0 ? (
          <motion.div
            variants={variants.container}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          >
            {farms.map((farm: any, index: number) => (
              <FarmCard key={farm._id} farm={farm} index={index} variants={variants.item} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-20 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand-foreground dark:text-brand">
              <LandPlot className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight">Your farm journey starts here.</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Add your first farm to start tracking crops, livestock, weather and farm performance.
            </p>
            <Link to="/farms/new" onClick={() => haptic.medium()}>
              <Button className="mt-6 h-12 rounded-full bg-brand px-7 text-brand-foreground hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Farm
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Infinite-scroll sentinel (preserved pagination) */}
        {canLoadMore && <div ref={sentinelRef} className="h-4" />}
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <Activity className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
