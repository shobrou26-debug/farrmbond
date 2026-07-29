import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile, useHaptic, useSwipeGesture } from "@/hooks/use-mobile";
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
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ============================================================
// Default farm images
// ============================================================

const defaultImages = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600",
  "https://images.unsplash.com/photo-1500076656116-558758c991c1?w=600",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600",
  "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600",
];

// ============================================================
// Farm Card Component
// ============================================================

function FarmCard({ farm, index }: { farm: any; index: number }) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [satelliteOpen, setSatelliteOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const crops = useQuery(api.crops.listFarmCrops, { farmId: farm._id }) ?? [];
  const livestock = useQuery(api.livestock.listFarmLivestock, { farmId: farm._id }) ?? [];

  useSwipeGesture(cardRef, {
    onSwipeLeft: () => haptic.light(),
    onSwipeRight: () => haptic.light(),
    enabled: isMobile,
  });

  const score = farm.ndviScore ?? 85;
  const getHealthColor = (s: number) => {
    if (s >= 90) return "text-green-600 bg-green-500/10 border-green-500/20";
    if (s >= 70) return "text-amber-600 bg-amber-500/10 border-amber-500/20";
    return "text-red-600 bg-red-500/10 border-red-500/20";
  };

  const activeCrops = crops.filter((c: { status: string }) => c.status !== "harvested" && c.status !== "failed").length;
  const totalLivestock = livestock.reduce((sum: number, l: { quantity: number }) => sum + l.quantity, 0);
  const locationStr = [farm.location.city, farm.location.state, farm.location.country].filter(Boolean).join(", ") || `${farm.location.latitude.toFixed(2)}°, ${farm.location.longitude.toFixed(2)}°`;

  return (
    <>
      <motion.div
        ref={cardRef}
        variants={itemVariants}
        whileTap={{ scale: 0.98 }}
        className="touch-feedback tap-highlight-none"
      >
        <Card className="overflow-hidden border-border/50 card-hover">
          {/* Cover Image */}
          <div className="relative h-36 sm:h-44 overflow-hidden">
            <ResponsiveImage
              src={farm.coverImage || defaultImages[index % defaultImages.length]}
              alt={farm.name}
              aspectRatio=""
              className="absolute inset-0"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs">
                {farm.size} {farm.sizeUnit === "hectares" ? "ha" : "ac"}
              </Badge>
            </div>

            <div className="absolute top-3 right-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="w-8 h-8 bg-background/80 backdrop-blur-sm touch-target"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => haptic.selection()}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => haptic.selection()}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Farm
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setSatelliteOpen(true); haptic.selection(); }}>
                    <Satellite className="w-4 h-4 mr-2" />
                    Satellite View
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={() => haptic.error()}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Farm
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="text-white font-semibold text-base sm:text-lg truncate">{farm.name}</h3>
              <div className="flex items-center gap-1 text-white/80 text-xs mt-1">
                <Map className="w-3 h-3" />
                <span className="truncate">{locationStr}</span>
              </div>
            </div>
          </div>

          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <Badge variant="outline" className={getHealthColor(score)}>
                <Activity className="w-3 h-3 mr-1" />
                {score}% Health
              </Badge>
              <span className="text-[10px] sm:text-xs text-muted-foreground capitalize">{farm.status}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <Leaf className="w-4 h-4 mx-auto text-green-500 mb-1" />
                <p className="text-xs font-semibold">{activeCrops}</p>
                <p className="text-[10px] text-muted-foreground">Crops</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <Navigation className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                <p className="text-xs font-semibold">{farm.size}</p>
                <p className="text-[10px] text-muted-foreground">{farm.sizeUnit === "hectares" ? "Ha" : "Ac"}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <Droplets className="w-4 h-4 mx-auto text-cyan-500 mb-1" />
                <p className="text-xs font-semibold">{totalLivestock}</p>
                <p className="text-[10px] text-muted-foreground">Livestock</p>
              </div>
            </div>

            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="text-muted-foreground">Farm Health</span>
                <span className="font-medium">{score}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${score}%`,
                    background: score >= 90
                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                      : score >= 70
                      ? "linear-gradient(90deg, #f59e0b, #d97706)"
                      : "linear-gradient(90deg, #ef4444, #dc2626)",
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Link to="/farms" className="flex-1" onClick={() => haptic.selection()}>
                <Button variant="outline" size="sm" className="w-full touch-target">
                  <Eye className="w-4 h-4 mr-1" />
                  <span className="text-xs">View</span>
                </Button>
              </Link>
              <Button
                variant="default"
                size="sm"
                className="flex-1 touch-target"
                onClick={() => { setSatelliteOpen(true); haptic.selection(); }}
              >
                <Satellite className="w-4 h-4 mr-1" />
                <span className="text-xs">Satellite</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <SatelliteViewer
        open={satelliteOpen}
        onOpenChange={setSatelliteOpen}
        farmName={farm.name}
        latitude={farm.location.latitude}
        longitude={farm.location.longitude}
        ndviScore={score}
      />
    </>
  );
}

// ============================================================
// Main Farms Component
// ============================================================

export default function Farms() {
  const { user } = useAuth();
  const haptic = useHaptic();
  const farms = useQuery(api.farms.listUserFarms) ?? undefined;
  const isLoading = farms === undefined;

  const totalSize = farms?.reduce((sum: number, f: { size: number }) => sum + f.size, 0) ?? 0;
  const avgHealth = farms && farms.length > 0
    ? Math.round(farms.reduce((sum: number, f: { ndviScore?: number }) => sum + (f.ndviScore ?? 85), 0) / farms.length)
    : 0;

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6"
        >
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">My Farms</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage and monitor your agricultural properties
            </p>
          </div>
          <Link to="/farms/new" onClick={() => haptic.medium()}>
            <Button className="gradient-primary touch-target w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add New Farm
            </Button>
          </Link>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5 sm:mb-6"
        >
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-3 sm:p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-6 w-12" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card className="border-border/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Map className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-lg sm:text-xl font-bold">{farms?.length ?? 0}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Total Farms</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Navigation className="w-5 h-5 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-lg sm:text-xl font-bold">{totalSize}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Total Size</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Activity className="w-5 h-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-lg sm:text-xl font-bold">{avgHealth}%</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Avg Health</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Leaf className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-lg sm:text-xl font-bold">{farms?.filter((f: { status: string }) => f.status === "active").length ?? 0}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Active Farms</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </motion.div>

        {/* Farms Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-96 rounded-lg" />
            ))}
          </div>
        ) : farms && farms.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {farms.map((farm: any, index: number) => (
              <FarmCard key={farm._id} farm={farm} index={index} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <Map className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No farms yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Get started by adding your first farm. You can track crops, livestock, weather, and more.
            </p>
            <Link to="/farms/new" onClick={() => haptic.medium()}>
              <Button className="gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Farm
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
