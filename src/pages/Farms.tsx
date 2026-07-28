import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile, useHaptic, useSwipeGesture } from "@/hooks/use-mobile";
import {
  Map,
  Plus,
  Leaf,
  Droplets,
  Satellite,
  MoreVertical,
  TrendingUp,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Navigation,
  Calendar,
  Activity,
} from "lucide-react";
import { Link } from "react-router";
import { SatelliteViewer } from "@/components/SatelliteViewer";
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
// Mock Data
// ============================================================

const farms = [
  {
    id: "1",
    name: "Green Valley Farm",
    location: "Nakuru County, Kenya",
    acres: 45,
    healthScore: 92,
    crops: 5,
    livestock: 12,
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600",
    coordinates: { lat: -0.3031, lng: 36.0800 },
    status: "active",
    lastActivity: "2 hours ago",
  },
  {
    id: "2",
    name: "Sunrise Ranch",
    location: "Nyeri County, Kenya",
    acres: 120,
    healthScore: 78,
    crops: 8,
    livestock: 36,
    image: "https://images.unsplash.com/photo-1500076656116-558758c991c1?w=600",
    coordinates: { lat: -0.4167, lng: 36.9500 },
    status: "active",
    lastActivity: "1 day ago",
  },
  {
    id: "3",
    name: "Riverside Fields",
    location: "Kiambu County, Kenya",
    acres: 30,
    healthScore: 85,
    crops: 3,
    livestock: 0,
    image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600",
    coordinates: { lat: -1.1667, lng: 36.9667 },
    status: "active",
    lastActivity: "3 days ago",
  },
  {
    id: "4",
    name: "Highland Orchards",
    location: "Meru County, Kenya",
    acres: 25,
    healthScore: 95,
    crops: 4,
    livestock: 5,
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600",
    coordinates: { lat: 0.0500, lng: 37.6500 },
    status: "active",
    lastActivity: "5 hours ago",
  },
];

// ============================================================
// Farm Card Component
// ============================================================

function FarmCard({ farm }: { farm: typeof farms[0] }) {
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const [satelliteOpen, setSatelliteOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Swipe to reveal actions on mobile
  useSwipeGesture(cardRef, {
    onSwipeLeft: () => haptic.light(),
    onSwipeRight: () => haptic.light(),
    enabled: isMobile,
  });

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-500/10 border-green-500/20";
    if (score >= 70) return "text-amber-600 bg-amber-500/10 border-amber-500/20";
    return "text-red-600 bg-red-500/10 border-red-500/20";
  };

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
            <img
              src={farm.image}
              alt={farm.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Top badges */}
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs">
                {farm.acres} acres
              </Badge>
            </div>

            {/* More menu */}
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

            {/* Bottom info */}
            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="text-white font-semibold text-base sm:text-lg truncate">{farm.name}</h3>
              <div className="flex items-center gap-1 text-white/80 text-xs mt-1">
                <Map className="w-3 h-3" />
                <span className="truncate">{farm.location}</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <CardContent className="p-3 sm:p-4">
            {/* Health Score */}
            <div className="flex items-center justify-between mb-3">
              <Badge variant="outline" className={getHealthColor(farm.healthScore)}>
                <Activity className="w-3 h-3 mr-1" />
                {farm.healthScore}% Health
              </Badge>
              <span className="text-[10px] sm:text-xs text-muted-foreground">{farm.lastActivity}</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <Leaf className="w-4 h-4 mx-auto text-green-500 mb-1" />
                <p className="text-xs font-semibold">{farm.crops}</p>
                <p className="text-[10px] text-muted-foreground">Crops</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <Navigation className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                <p className="text-xs font-semibold">{farm.acres}</p>
                <p className="text-[10px] text-muted-foreground">Acres</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <Droplets className="w-4 h-4 mx-auto text-cyan-500 mb-1" />
                <p className="text-xs font-semibold">{farm.livestock}</p>
                <p className="text-[10px] text-muted-foreground">Livestock</p>
              </div>
            </div>

            {/* Health Bar */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="text-muted-foreground">Farm Health</span>
                <span className="font-medium">{farm.healthScore}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${farm.healthScore}%`,
                    background: farm.healthScore >= 90
                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                      : farm.healthScore >= 70
                      ? "linear-gradient(90deg, #f59e0b, #d97706)"
                      : "linear-gradient(90deg, #ef4444, #dc2626)",
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Link to="/dashboard" className="flex-1" onClick={() => haptic.selection()}>
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

      {/* Satellite Viewer Modal */}
      <SatelliteViewer
        open={satelliteOpen}
        onOpenChange={setSatelliteOpen}
        farmName={farm.name}
        latitude={farm.coordinates.lat}
        longitude={farm.coordinates.lng}
        ndviScore={farm.healthScore}
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
  const isMobile = useIsMobile();

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
          {[
            { label: "Total Farms", value: "4", icon: Map, color: "text-emerald-500" },
            { label: "Total Acres", value: "220", icon: Navigation, color: "text-blue-500" },
            { label: "Avg Health", value: "87%", icon: Activity, color: "text-green-500" },
            { label: "Active Crops", value: "20", icon: Leaf, color: "text-amber-500" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-border/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Icon className={`w-5 h-5 ${stat.color} shrink-0`} />
                    <div>
                      <p className="text-lg sm:text-xl font-bold">{stat.value}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* Farms Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
        >
          {farms.map((farm) => (
            <FarmCard key={farm.id} farm={farm} />
          ))}
        </motion.div>
      </div>
    </AppLayout>
  );
}
