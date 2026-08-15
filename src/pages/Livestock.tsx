import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import {
  Beef,
  Plus,
  Search,
  Heart,
  Stethoscope,
  Syringe,
  TrendingUp,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Activity,
  FileText,
  X,
  ChevronRight,
  Bell,
  Shield,
  AlertCircle,
  Info,
  MapPin,
  Package,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { VaccinationScheduleTab } from "@/components/VaccinationSchedule";
import { AddLivestockModal } from "@/components/livestock/AddLivestockModal";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

// ============================================================
// Types
// ============================================================
interface HealthRecord {
  date: number;
  description: string;
  treatment: string;
  cost?: number;
}

interface LivestockDoc {
  _id: string;
  farmId: string;
  userId: string;
  name: string;
  type: string;
  breed?: string;
  quantity: number;
  unit: string;
  status: "healthy" | "sick" | "pregnant" | "quarantine";
  healthScore?: number;
  acquisitionDate: number;
  acquisitionCost?: number;
  productionType?: string;
  productionQuantity?: number;
  productionUnit?: string;
  feedType?: string;
  dailyFeedCost?: number;
  lastVaccination?: number;
  nextVaccination?: number;
  lastCheckup?: number;
  medicalHistory?: HealthRecord[];
  images?: string[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================
// Animation Variants
// ============================================================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

// ============================================================
// Status Config
// ============================================================
const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  healthy: {
    label: "Healthy",
    color: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: Heart,
  },
  sick: {
    label: "Sick",
    color: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
    icon: Stethoscope,
  },
  pregnant: {
    label: "Pregnant",
    color: "border-pink-500/25 bg-pink-500/10 text-pink-700 dark:text-pink-300",
    icon: Heart,
  },
  quarantine: {
    label: "Quarantine",
    color: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: AlertTriangle,
  },
};

const severityConfig: Record<string, { color: string; icon: React.ComponentType<{className?: string}> }> = {
  critical: { color: "bg-red-500 text-white", icon: AlertTriangle },
  high: { color: "bg-orange-500 text-white", icon: AlertCircle },
  medium: { color: "bg-amber-500 text-white", icon: Info },
  low: { color: "bg-blue-500 text-white", icon: Info },
};

// ============================================================
// Helper Functions
// ============================================================
const formatDate = (timestamp?: number) => {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const getDaysUntilDate = (timestamp?: number) => {
  if (!timestamp) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(timestamp);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

// ============================================================
// Real livestock photography — verified Unsplash CDN images.
// The animal's name/type maps to a real photo of that animal;
// unmapped types get a subject-neutral farm-animal photo
// (never a crop/field image). ResponsiveImage handles failures
// with a clean error state.
// ============================================================

const LIVESTOCK_IMAGE_FALLBACKS = [
  "https://images.unsplash.com/photo-1516356565541-c3d3c55c97d6?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1442340743774-556731ec65b2?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1453368432345-73725718b7ae?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1462027076063-1ceabb252dbd?q=80&w=900&auto=format&fit=crop",
];

const livestockImageMap: Record<string, string> = {
  cattle:
    "https://images.unsplash.com/photo-1516356565541-c3d3c55c97d6?q=80&w=900&auto=format&fit=crop",
  cow:
    "https://images.unsplash.com/photo-1516356565541-c3d3c55c97d6?q=80&w=900&auto=format&fit=crop",
  cows:
    "https://images.unsplash.com/photo-1502734559478-912ab58bda39?q=80&w=900&auto=format&fit=crop",
  bull:
    "https://images.unsplash.com/photo-1584038180163-707e1eeeab6f?q=80&w=900&auto=format&fit=crop",
  goat:
    "https://images.unsplash.com/photo-1573578160998-4f4c7b023aec?q=80&w=900&auto=format&fit=crop",
  sheep:
    "https://images.unsplash.com/photo-1453368432345-73725718b7ae?q=80&w=900&auto=format&fit=crop",
  chicken:
    "https://images.unsplash.com/photo-1476916713558-2842194a8e49?q=80&w=900&auto=format&fit=crop",
  poultry:
    "https://images.unsplash.com/photo-1476916713558-2842194a8e49?q=80&w=900&auto=format&fit=crop",
  hen:
    "https://images.unsplash.com/photo-1472430023262-9a743f7570cb?q=80&w=900&auto=format&fit=crop",
  rooster:
    "https://images.unsplash.com/photo-1462027076063-1ceabb252dbd?q=80&w=900&auto=format&fit=crop",
  // Turkey: no verified dedicated photo; poultry-category image is the relevant fallback.
  turkey:
    "https://images.unsplash.com/photo-1476916713558-2842194a8e49?q=80&w=900&auto=format&fit=crop",
  pig:
    "https://images.unsplash.com/photo-1589922585994-e9ac4fe0f71d?q=80&w=900&auto=format&fit=crop",
  piglet:
    "https://images.unsplash.com/photo-1589922585994-e9ac4fe0f71d?q=80&w=900&auto=format&fit=crop",
  duck:
    "https://images.unsplash.com/photo-1428572509712-cb9a529e81d7?q=80&w=900&auto=format&fit=crop",
  rabbit:
    "https://images.unsplash.com/photo-1433769747000-441481877caf?q=80&w=900&auto=format&fit=crop",
  fish:
    "https://images.unsplash.com/photo-1592339269936-fe8eafdc7fd5?q=80&w=900&auto=format&fit=crop",
};

function getLivestockImage(name: string, type: string): string {
  const haystack = `${name} ${type}`.toLowerCase();
  const key = Object.keys(livestockImageMap).find((k) => haystack.includes(k));
  if (key) return livestockImageMap[key];
  // Deterministic pick so the same type always maps to the same photo.
  let hash = 0;
  for (let i = 0; i < haystack.length; i++) {
    hash = (hash * 31 + haystack.charCodeAt(i)) >>> 0;
  }
  return LIVESTOCK_IMAGE_FALLBACKS[hash % LIVESTOCK_IMAGE_FALLBACKS.length];
}

function typeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function healthColor(score: number): string {
  if (score >= 80) return "linear-gradient(90deg, #4ade80, #16a34a)";
  if (score >= 60) return "linear-gradient(90deg, #fbbf24, #d97706)";
  return "linear-gradient(90deg, #f87171, #dc2626)";
}

function InfoTile({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-1 truncate text-sm font-semibold text-foreground ${valueClassName ?? ""}`} title={value}>
        {value}
      </p>
    </div>
  );
}

// ============================================================
// ============================================================
// Quick Add Health Record Modal
// ============================================================
function AddHealthRecordModal({
  animal,
  isOpen,
  onClose,
  onSubmit,
}: {
  animal: LivestockDoc | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (livestockId: string, data: { description: string; treatment: string; cost?: number }) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [treatment, setTreatment] = useState("");
  const [cost, setCost] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !description.trim() || !treatment.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(animal._id, {
        description: description.trim(),
        treatment: treatment.trim(),
        cost: cost ? parseFloat(cost) : undefined,
      });
      setDescription("");
      setTreatment("");
      setCost("");
      onClose();
    } catch (error) {
      console.error("Failed to add health record:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !animal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-foreground dark:text-brand" />
            Add Health Record — {animal.name}
          </DialogTitle>
          <DialogDescription>
            Record a new health event, treatment, or checkup for this animal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="hr-desc">Description *</Label>
            <Input
              id="hr-desc"
              placeholder="e.g. Routine checkup, Lameness, Deworming"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={200}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="hr-treatment">Treatment *</Label>
            <Textarea
              id="hr-treatment"
              placeholder="Describe the treatment given, medications, dosage..."
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              required
              maxLength={500}
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="hr-cost">Cost (optional)</Label>
            <Input
              id="hr-cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !description.trim() || !treatment.trim()}
              className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Add Record
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
// ============================================================
// Animal Detail Modal
// ============================================================
function AnimalDetailModal({
  animal,
  farmName,
  onClose,
}: {
  animal: LivestockDoc;
  farmName: string;
  onClose: () => void;
}) {
  const [detailTab, setDetailTab] = useState<"records" | "info">("records");
  const records = animal.medicalHistory || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative p-6 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-background/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
              <Beef className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground">{animal.name}</h2>
              <p className="text-muted-foreground">{animal.breed || animal.type} • {farmName}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={statusConfig[animal.status]?.color || "bg-gray-100 text-gray-600"}>
                  {statusConfig[animal.status]?.label || animal.status}
                </Badge>
                <Badge variant="secondary">{animal.quantity} {animal.unit}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-border">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Health Score</p>
            <p
              className="text-2xl font-bold"
              style={animal.healthScore != null ? { color: animal.healthScore >= 80 ? "#22c55e" : animal.healthScore >= 60 ? "#f59e0b" : "#ef4444" } : undefined}
            >
              {animal.healthScore != null ? `${animal.healthScore}%` : "No score yet"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="text-lg font-bold">{animal.type}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Production</p>
            <p className="text-lg font-bold capitalize">{animal.productionType || "N/A"}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Last Checkup</p>
            <p className="text-lg font-semibold">{formatDate(animal.lastCheckup)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { id: "records" as const, label: "Medical History", icon: FileText },
            { id: "info" as const, label: "Details", icon: Info },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDetailTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                detailTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[40vh] overflow-y-auto">
          {detailTab === "records" && (
            <div className="space-y-4">
              {records.length > 0 ? (
                records.map((record, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-xl bg-muted/30">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{record.description}</h4>
                        <span className="text-sm text-muted-foreground">{formatDate(record.date)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {record.treatment}
                        {record.cost && ` • Cost: KES ${record.cost.toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No medical records yet</p>
                </div>
              )}
            </div>
          )}

          {detailTab === "info" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-muted/30">
                  <p className="text-sm text-muted-foreground">Acquisition Date</p>
                  <p className="font-medium">{formatDate(animal.acquisitionDate)}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30">
                  <p className="text-sm text-muted-foreground">Acquisition Cost</p>
                  <p className="font-medium">{animal.acquisitionCost ? `KES ${animal.acquisitionCost.toLocaleString()}` : "N/A"}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30">
                  <p className="text-sm text-muted-foreground">Feed Type</p>
                  <p className="font-medium capitalize">{animal.feedType || "N/A"}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30">
                  <p className="text-sm text-muted-foreground">Daily Feed Cost</p>
                  <p className="font-medium">{animal.dailyFeedCost ? `KES ${animal.dailyFeedCost.toLocaleString()}` : "N/A"}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30">
                  <p className="text-sm text-muted-foreground">Last Vaccination</p>
                  <p className="font-medium">{formatDate(animal.lastVaccination)}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/30">
                  <p className="text-sm text-muted-foreground">Next Vaccination</p>
                  <p className="font-medium">{formatDate(animal.nextVaccination)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// Main Component
// ============================================================
export default function Livestock() {
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [coverageFarmFilter, setCoverageFarmFilter] = useState<string>("all");
  const [coverageTimeRange, setCoverageTimeRange] = useState<number>(90);
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [comparisonVaccine, setComparisonVaccine] = useState<string>("FMD");
  const [selectedAnimal, setSelectedAnimal] = useState<LivestockDoc | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "health" | "vaccinations" | "coverage" | "alerts">("overview");
  const [showAlerts, setShowAlerts] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [animalForHealthRecord, setAnimalForHealthRecord] = useState<LivestockDoc | null>(null);
  // Convex data
  const { results: livestock, isLoading, sentinelRef, canLoadMore, loadMore } =
    usePaginatedQuery(api.livestock.listUserLivestock);
  const farms = useQuery(api.farms.listUserFarms, {});
  const createLivestock = useMutation(api.livestock.createLivestock);
  const deleteLivestock = useMutation(api.livestock.deleteLivestock);
  const updateLivestock = useMutation(api.livestock.updateLivestock);
  const addHealthRecord = useMutation(api.livestock.addHealthRecord);
  const scheduleVaccination = useMutation(api.livestock.scheduleVaccination);
  const vaccineCoverage = useQuery(api.livestock.getVaccineCoverage, { farmId: coverageFarmFilter === "all" ? undefined : coverageFarmFilter, daysBack: coverageTimeRange });
  const coverageAlerts = useQuery(api.livestock.getCoverageAlerts, { farmId: coverageFarmFilter === "all" ? undefined : coverageFarmFilter });
  const coverageTrends = useQuery(api.livestock.getCoverageTrends, { farmId: coverageFarmFilter === "all" ? undefined : coverageFarmFilter });
  const farmTrends = useQuery(api.livestock.getCoverageTrendsByFarm, {});
  const completeVaccination = useMutation(api.livestock.completeVaccination);
  const diseaseAlerts = useQuery(api.livestock.getDiseaseAlerts);

  // Derived from real livestock health records via the backend query
  const criticalAlertCount = (diseaseAlerts ?? []).filter(
    (a) => a.severity === "critical" || a.severity === "high"
  ).length;

  // Map farmId to farm name
  const farmMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (farms?.page) {
      for (const farm of farms.page) {
        map[farm._id] = farm.name;
      }
    }
    return map;
  }, [farms]);

  // Get first farm ID for creating new livestock
  const firstFarmId = farms?.page?.[0]?._id || null;

  // Filter livestock by search and status
  const filtered = useMemo(() => {
    return livestock.filter((animal: LivestockDoc) => {
      const farmName = farmMap[animal.farmId] || "";
      const matchesSearch =
        searchQuery === "" ||
        animal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        animal.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (animal.breed || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === "all" || animal.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [livestock, searchQuery, selectedStatus, farmMap]);

  // Statistics
  const stats = useMemo(() => {
    const totalHead = livestock.reduce((sum: number, l: LivestockDoc) => sum + l.quantity, 0);
    const healthyCount = livestock.filter((l: LivestockDoc) => l.status === "healthy").length;
    const sickCount = livestock.filter((l: LivestockDoc) => l.status === "sick" || l.status === "quarantine").length;
    const vaccinationsDue = livestock.filter((l: LivestockDoc) => {
      if (!l.nextVaccination) return false;
      return getDaysUntilDate(l.nextVaccination) !== null && getDaysUntilDate(l.nextVaccination)! <= 30;
    }).length;
    const overdueVaccinations = livestock.filter((l: LivestockDoc) => {
      if (!l.nextVaccination) return false;
      return getDaysUntilDate(l.nextVaccination) !== null && getDaysUntilDate(l.nextVaccination)! < 0;
    }).length;
    const scoredLivestock = livestock.filter((l: LivestockDoc) => typeof l.healthScore === "number");
    const avgHealth = scoredLivestock.length > 0
      ? Math.round(scoredLivestock.reduce((sum: number, l: LivestockDoc) => sum + (l.healthScore as number), 0) / scoredLivestock.length)
      : null;
    return { totalHead, healthyCount, sickCount, vaccinationsDue, overdueVaccinations, avgHealth };
  }, [livestock]);

  // Status filter options
  const statusFilters = [
    { id: "all", label: "All", count: livestock.length },
    { id: "healthy", label: "Healthy", count: livestock.filter((l: LivestockDoc) => l.status === "healthy").length },
    { id: "sick", label: "Sick", count: livestock.filter((l: LivestockDoc) => l.status === "sick").length },
    { id: "pregnant", label: "Pregnant", count: livestock.filter((l: LivestockDoc) => l.status === "pregnant").length },
    { id: "quarantine", label: "Quarantine", count: livestock.filter((l: LivestockDoc) => l.status === "quarantine").length },
  ];

  // Handlers
  const handleCreateLivestock = async (data: { farmId: string; name: string; type: string; breed?: string; quantity: number; unit: string; acquisitionDate: number; productionType?: string; acquisitionCost?: number; feedType?: string; dailyFeedCost?: number; lastVaccination?: number; nextVaccination?: number; lastCheckup?: number; initialHealthRecord?: { description: string; treatment: string; cost?: number }; }) => {
    try {
      await createLivestock({ ...data, farmId: data.farmId as any });
    } catch (error) {
      console.error("Failed to create livestock:", error);
    }
  };

  const handleDeleteLivestock = async (livestockId: string) => {
    try {
      await deleteLivestock({ livestockId: livestockId as any });
      setSelectedAnimal(null);
    } catch (error) {
      console.error("Failed to delete livestock:", error);
    }
  };

  const handleUpdateStatus = async (livestockId: string, status: "healthy" | "sick" | "pregnant" | "quarantine") => {
    try {
      await updateLivestock({ livestockId: livestockId as any, status });
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleAddHealthRecord = async (livestockId: string, data: { description: string; treatment: string; cost?: number }) => {
    try {
      await addHealthRecord({ livestockId: livestockId as any, ...data });
    } catch (error) {
      console.error("Failed to add health record:", error);
    }
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Beef },
    { id: "health" as const, label: "Health Records", icon: Heart },
    { id: "vaccinations" as const, label: "Vaccinations", icon: Syringe },
    { id: "coverage" as const, label: "Coverage", icon: TrendingUp },
    { id: "alerts" as const, label: "Disease Alerts", icon: AlertTriangle },
  ];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* ============ Page header ============ */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Livestock</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Monitor and manage the animals across your farms.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAlerts(true)}
                className="relative h-12 touch-target rounded-full px-5"
              >
                <Bell className="h-4 w-4" />
                Disease Alerts
                {criticalAlertCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
                    {criticalAlertCount}
                  </span>
                )}
              </Button>
              <Button
                onClick={() => setShowAddModal(true)}
                disabled={!firstFarmId}
                className="h-12 w-full touch-target rounded-full bg-brand px-6 text-brand-foreground hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Add Livestock
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ============ Loading State ============ */}
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
        ) : (
          <>
            {/* Stats Cards */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
            >
              <motion.div variants={itemVariants}>
                <Card className="border-border/60">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                      <Beef className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">Total Livestock</p>
                      <p className="text-xl font-bold sm:text-2xl">{stats.totalHead}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="border-border/60">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">Healthy Groups</p>
                      <p className="text-xl font-bold sm:text-2xl">{stats.healthyCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="border-border/60">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">Need Attention</p>
                      <p className="text-xl font-bold sm:text-2xl">{stats.sickCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="border-border/60">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stats.overdueVaccinations > 0 ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                      <Syringe className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">Vaccinations Due</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-xl font-bold sm:text-2xl">{stats.vaccinationsDue}</p>
                        {stats.overdueVaccinations > 0 && (
                          <span className="text-xs font-medium text-red-500 sm:text-sm">({stats.overdueVaccinations} overdue)</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Overdue Vaccination Alert */}
            {stats.overdueVaccinations > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/5 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-red-700 dark:text-red-400">Overdue Vaccinations</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You have {stats.overdueVaccinations} overdue vaccination(s) that require immediate attention.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <div
                className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-muted/40 p-1"
                role="tablist"
                aria-label="Livestock sections"
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? "text-brand-foreground dark:text-brand" : ""}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Overview Tab */}
            {activeTab === "overview" && (
              <>
                {/* Search and Filters */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="mb-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="relative w-full max-w-md">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search livestock by name, type, breed, or farm..."
                        className="h-11 rounded-xl pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search livestock"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {statusFilters.map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => setSelectedStatus(filter.id)}
                        className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                          selectedStatus === filter.id
                            ? "bg-brand text-brand-foreground"
                            : "border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        }`}
                      >
                        {filter.label}
                        <span className={`rounded-full px-1.5 py-0.5 text-xs ${selectedStatus === filter.id ? "bg-white/20" : "bg-background"}`}>
                          {filter.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Livestock Grid */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  {filtered.map((animal: LivestockDoc) => {
                    const status = statusConfig[animal.status] || { label: animal.status, color: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300", icon: Beef };
                    const StatusIcon = status.icon;
                    const daysUntilVaccination = getDaysUntilDate(animal.nextVaccination);
                    const health = animal.healthScore;
                    const farmName = farmMap[animal.farmId] || "Unknown Farm";
                    const overdue = daysUntilVaccination !== null && daysUntilVaccination < 0;

                    return (
                      <motion.div key={animal._id} variants={itemVariants}>
                        <Card className={`group h-full overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5 ${overdue ? "border-red-500/40" : ""}`}>
                          {/* Photo */}
                          <div
                            className="relative cursor-pointer"
                            onClick={() => setSelectedAnimal(animal)}
                            role="button"
                            tabIndex={0}
                            aria-label={`View details for ${animal.name}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedAnimal(animal);
                              }
                            }}
                          >
                            <ResponsiveImage
                              src={getLivestockImage(animal.name, animal.type)}
                              alt={`${animal.type} — ${animal.name}`}
                              aspectRatio="aspect-[16/10]"
                              className="transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/10" />
                            <div className="absolute left-3 top-3">
                              <Badge className={`border backdrop-blur-sm ${status.color}`}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {status.label}
                              </Badge>
                            </div>
                            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="truncate text-lg font-bold tracking-tight text-white drop-shadow-sm">
                                  {animal.name}
                                </h3>
                                <p className="truncate text-xs text-white/85">
                                  {animal.breed || typeLabel(animal.type)}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white capitalize backdrop-blur-sm">
                                {animal.type}
                              </span>
                            </div>
                          </div>

                          <CardContent className="p-5">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-foreground dark:text-brand" />
                              <span className="truncate">{farmName}</span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                              <InfoTile
                                icon={<Package className="h-3.5 w-3.5" />}
                                label="Quantity"
                                value={`${animal.quantity} ${animal.unit}`}
                              />
                              <InfoTile
                                icon={<Activity className="h-3.5 w-3.5" />}
                                label="Production"
                                value={animal.productionType ? typeLabel(animal.productionType) : "—"}
                              />
                              <InfoTile
                                icon={<Syringe className="h-3.5 w-3.5" />}
                                label="Next Vacc."
                                value={
                                  daysUntilVaccination === null
                                    ? "Not scheduled"
                                    : daysUntilVaccination < 0
                                    ? `${Math.abs(daysUntilVaccination)} days overdue`
                                    : daysUntilVaccination === 0
                                    ? "Today"
                                    : `In ${daysUntilVaccination} days`
                                }
                                valueClassName={
                                  daysUntilVaccination === null
                                    ? ""
                                    : daysUntilVaccination < 0
                                    ? "text-red-500"
                                    : daysUntilVaccination < 7
                                    ? "text-amber-500"
                                    : ""
                                }
                              />
                              <InfoTile
                                icon={<Calendar className="h-3.5 w-3.5" />}
                                label="Checkup"
                                value={formatDate(animal.lastCheckup)}
                              />
                            </div>

                            {/* Health Score Bar — only rendered when a real score exists */}
                            <div className="mt-4">
                              <div className="mb-1 flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Health Score</span>
                                {health != null ? (
                                  <span className="font-medium" style={{ color: health >= 80 ? "#22c55e" : health >= 60 ? "#f59e0b" : "#ef4444" }}>
                                    {health}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No score yet</span>
                                )}
                              </div>
                              {health != null ? (
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                  <motion.div
                                    initial={shouldReduceMotion ? { width: `${health}%` } : { width: 0 }}
                                    animate={{ width: `${health}%` }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 1, ease: "easeOut" }}
                                    className="h-full rounded-full"
                                    style={{ background: healthColor(health) }}
                                  />
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No health data yet</p>
                              )}
                            </div>

                            {/* Quick Actions */}
                            <div className="mt-4 flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 touch-target rounded-xl"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(animal._id, animal.status === "healthy" ? "sick" : "healthy");
                                }}
                              >
                                <Stethoscope className="h-4 w-4" />
                                {animal.status === "healthy" ? "Mark Sick" : "Mark Healthy"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 touch-target rounded-xl px-3"
                                onClick={() => setSelectedAnimal(animal)}
                              >
                                <Eye className="h-4 w-4" />
                                Details
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 touch-target rounded-xl"
                                    aria-label={`Actions for ${animal.name}`}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedAnimal(animal)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(animal._id, "healthy")}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Mark Healthy
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(animal._id, "sick")}>
                                    <Stethoscope className="mr-2 h-4 w-4" />
                                    Mark Sick
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setAnimalForHealthRecord(animal)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Add Health Record
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      if (confirm(`Delete "${animal.name}"? This cannot be undone.`)) {
                                        handleDeleteLivestock(animal._id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
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

                {/* Load More */}
                {canLoadMore && (
                  <div ref={sentinelRef} className="flex justify-center py-6">
                    <Button variant="outline" className="rounded-full px-6" onClick={loadMore}>
                      Load More Livestock
                    </Button>
                  </div>
                )}

                {filtered.length === 0 && !isLoading && (
                  <div className="overflow-hidden rounded-3xl border border-border/60 bg-card">
                    {livestock.length === 0 ? (
                      <div className="relative">
                        <ResponsiveImage
                          src="https://images.unsplash.com/photo-1442340743774-556731ec65b2?q=80&w=1400&auto=format&fit=crop"
                          alt="Cattle grazing in a pasture"
                          aspectRatio="aspect-[21/7]"
                          containerClassName="max-h-56"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                            Start managing your livestock
                          </h2>
                          <p className="mt-2 max-w-md text-sm text-white/85">
                            Track animal health, vaccinations, production and more — all from FarmBond.
                          </p>
                          {firstFarmId && (
                            <Button
                              onClick={() => setShowAddModal(true)}
                              className="mt-5 h-12 touch-target rounded-full bg-brand px-7 text-brand-foreground hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25"
                            >
                              <Plus className="h-4 w-4" />
                              Add Livestock
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center px-6 py-14 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                          <Search className="h-7 w-7" />
                        </div>
                        <h2 className="mt-5 text-xl font-bold tracking-tight">No livestock match your search</h2>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                          Try adjusting your search or status filters.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Health Records Tab */}
            {activeTab === "health" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">All Health Records</h2>
                </div>
                {livestock.filter((a: LivestockDoc) => a.medicalHistory && a.medicalHistory.length > 0).length === 0 ? (
                  <div className="flex flex-col items-center rounded-3xl border border-dashed border-border/80 bg-card/50 px-6 py-14 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand-foreground dark:text-brand">
                      <FileText className="h-7 w-7" />
                    </div>
                    <h3 className="mt-5 text-xl font-bold tracking-tight">No health records yet</h3>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Health records will appear here once you add medical history to your livestock.
                    </p>
                  </div>
                ) : (
                  <>
                  {livestock
                    .filter((a: LivestockDoc) => a.medicalHistory && a.medicalHistory.length > 0)
                    .flatMap((animal: LivestockDoc) =>
                      (animal.medicalHistory || []).map((record, idx) => (
                        <Card key={`${animal._id}-${idx}`} className="border-border/60">
                          <CardContent className="flex items-start gap-4 p-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="truncate font-medium">{record.description}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {animal.name} • {farmMap[animal.farmId] || "Unknown Farm"}
                                  </p>
                                </div>
                                <span className="shrink-0 text-sm text-muted-foreground">{formatDate(record.date)}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span>{record.treatment}</span>
                                {record.cost && (
                                  <span className="font-medium text-foreground">KES {record.cost.toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </>
                )}
              </motion.div>
            )}


            {/* Vaccination Schedule Tab */}
            {activeTab === "vaccinations" && (
              <VaccinationScheduleTab
                livestock={livestock}
                scheduleVaccination={scheduleVaccination}
                completeVaccination={completeVaccination}
              />
            )}

            {/* Disease Alerts Tab */}

            {/* Vaccine Coverage Rates Tab */}
            {activeTab === "coverage" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                  <div>
                    <h2 className="text-lg font-semibold">Vaccine Coverage Rates</h2>
                    <p className="text-sm text-muted-foreground">
                      Coverage calculated from the last {coverageTimeRange === 30 ? '30 days' : coverageTimeRange === 90 ? '90 days' : coverageTimeRange === 180 ? '6 months' : '1 year'} of vaccination records
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">Farm:</label>
                      <select
                        className="h-9 rounded-lg border border-input bg-background px-3 text-sm min-w-[180px]"
                        value={coverageFarmFilter}
                        onChange={(e) => setCoverageFarmFilter(e.target.value)}
                      >
                        <option value="all">All Farms</option>
                        {farms?.page?.map((farm: any) => (
                          <option key={farm._id} value={farm._id}>
                            {farm.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">Period:</label>
                      <select
                        className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                        value={coverageTimeRange}
                        onChange={(e) => setCoverageTimeRange(Number(e.target.value))}
                      >
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                        <option value={180}>Last 6 months</option>
                        <option value={365}>Last 1 year</option>
                      </select>
                    </div>
                  </div>
                </div>

                {!vaccineCoverage ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : vaccineCoverage.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium">No livestock found</h3>
                    <p className="text-muted-foreground mt-1">
                      Add livestock and record vaccinations to see coverage rates
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Low Coverage Alerts */}
                    {coverageAlerts && coverageAlerts.alerts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    {/* Alert Summary */}
                    <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          {coverageAlerts.summary.total} vaccine{coverageAlerts.summary.total !== 1 ? 's' : ''} below 50% coverage
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {coverageAlerts.summary.critical > 0 && <span className="text-red-600 font-medium">{coverageAlerts.summary.critical} critical</span>}
                          {coverageAlerts.summary.critical > 0 && coverageAlerts.summary.high > 0 && ', '}
                          {coverageAlerts.summary.high > 0 && <span className="text-orange-600 font-medium">{coverageAlerts.summary.high} high priority</span>}
                          {coverageAlerts.summary.critical > 0 && coverageAlerts.summary.high === 0 && coverageAlerts.summary.medium > 0 && ', '}
                          {coverageAlerts.summary.high === 0 && coverageAlerts.summary.medium > 0 && <span className="text-amber-600 font-medium">{coverageAlerts.summary.medium} medium priority</span>}
                        </p>
                      </div>
                    </div>

                    {/* Individual Alert Cards */}
                    {coverageAlerts.alerts.map((alert: any, idx: number) => (
                      <Card key={`${alert.vaccineName}-${alert.animalType}-${idx}`} className={`border ${
                        alert.severity === 'critical'
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-amber-500/30 bg-amber-500/5'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                              alert.severity === 'critical'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-amber-100 text-amber-600'
                            }`}>
                              <Shield className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-semibold text-sm">{alert.vaccineName}</h5>
                                <Badge variant="secondary" className="text-xs">
                                  {alert.animalType}
                                </Badge>
                                <Badge className={`text-xs ${
                                  alert.severity === 'critical'
                                    ? 'bg-red-100 text-red-700 border-red-200'
                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                                }`}>
                                  {alert.percentage}% coverage
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mb-2">
                                {alert.vaccinated}/{alert.total} animals vaccinated • Recommended: {alert.interval}
                              </div>
                              <div className="p-2.5 rounded-lg bg-background/80 text-xs leading-relaxed">
                                <span className="font-medium">Recommendation:</span> {alert.recommendation}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </motion.div>
                    )}

                    {/* Coverage Trends Chart */}
                    {!comparisonMode && coverageTrends && coverageTrends.months.length > 0 && coverageTrends.vaccineNames.length > 0 && (
                      <Card className="border-border/50">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                              <TrendingUp className="w-5 h-5 text-primary" />
                              Coverage Trends (Last 12 Months)
                            </CardTitle>
                            {farms && farms.page && farms.page.length > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setComparisonMode(true)}
                              >
                                Compare Farms
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={coverageTrends.months} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip formatter={(value: number) => [`${value}%`, '']} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                {coverageTrends.vaccineNames.map((vax: string, idx: number) => (
                                  <Line key={vax} type="monotone" dataKey={vax} stroke={["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d", "#c2410c", "#4f46e5", "#0d9488", "#9333ea"][idx % 12]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Farm Comparison Mode */}
                    {comparisonMode && (
                      <Card className="border-border/50">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                              <TrendingUp className="w-5 h-5 text-primary" />
                              Farm Comparison
                            </CardTitle>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setComparisonMode(false)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Exit Comparison
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Compare vaccine coverage trends across your farms side-by-side
                          </p>
                        </CardHeader>
                        <CardContent>
                          {/* Vaccine Selector */}
                          {farmTrends && farmTrends.vaccineNames.length > 0 && (
                            <div className="flex items-center gap-3 mb-6">
                              <Label className="text-sm font-medium">Compare by:</Label>
                              <select
                                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                                value={comparisonVaccine}
                                onChange={(e) => setComparisonVaccine(e.target.value)}
                              >
                                {farmTrends.vaccineNames.map((vax: string) => (
                                  <option key={vax} value={vax}>{vax}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {/* Farm Lines Legend */}
                          {farmTrends && farmTrends.farmTrends.length > 0 && (
                            <div className="flex flex-wrap gap-3 mb-4">
                              {farmTrends.farmTrends.map((ft: any, idx: number) => (
                                <div key={ft.farmId} className="flex items-center gap-2 text-sm">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"][idx % 8] }}
                                  />
                                  <span>{ft.farmName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {farmTrends && farmTrends.farmTrends.length > 0 ? (
                            <div className="h-[400px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={farmTrends.farmTrends[0]?.data || []}
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                                  <Tooltip
                                    formatter={(value: number) => [`${value}%`, ""]}
                                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                                  />
                                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                                  {farmTrends.farmTrends.map((ft: any, idx: number) => (
                                    <Line
                                      key={ft.farmId}
                                      type="monotone"
                                      data={ft.data}
                                      dataKey={comparisonVaccine}
                                      name={ft.farmName}
                                      stroke={["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"][idx % 8]}
                                      strokeWidth={2.5}
                                      dot={{ r: 4 }}
                                      activeDot={{ r: 6 }}
                                      strokeDasharray={idx > 0 ? ["5 5", "8 4", "12 4", "3 3"][idx % 4] : undefined}
                                    />
                                  ))}
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                              <h3 className="text-lg font-medium">No farm data available</h3>
                              <p className="text-muted-foreground mt-1">
                                Add livestock to multiple farms to compare coverage trends
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    <div className="space-y-8">
                    {vaccineCoverage.map((typeData: any) => (
                      <Card key={typeData.animalType} className="border-border/50">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                                <Beef className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="text-lg font-bold">{typeData.animalType}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {typeData.totalAnimals} animals in herd
                                </p>
                              </div>
                            </div>
                            {/* Overall coverage badge */}
                            {(() => {
                              const avgPct = typeData.coverage.length > 0
                                ? Math.round(typeData.coverage.reduce((sum: number, c: any) => sum + c.percentage, 0) / typeData.coverage.length)
                                : 0;
                              const color = avgPct >= 80 ? "bg-green-100 text-green-700" : avgPct >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
                              return (
                                <Badge className={`${color} text-sm px-3 py-1`}>
                                  {avgPct}% avg coverage
                                </Badge>
                              );
                            })()}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {typeData.coverage.map((vax: any) => {
                              const pctColor = vax.percentage >= 80
                                ? "text-green-600"
                                : vax.percentage >= 50
                                ? "text-amber-600"
                                : "text-red-600";
                              const barBg = vax.percentage >= 80
                                ? "bg-gradient-to-r from-green-500 to-emerald-500"
                                : vax.percentage >= 50
                                ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                : "bg-gradient-to-r from-red-500 to-rose-500";
                              const dotColor = vax.percentage >= 80
                                ? "bg-green-500"
                                : vax.percentage >= 50
                                ? "bg-amber-500"
                                : "bg-red-500";

                              return (
                                <div key={vax.name} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                                      <span className="text-sm font-medium">{vax.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-muted-foreground">
                                        {vax.vaccinated}/{vax.total} animals
                                      </span>
                                      <span className={`text-sm font-bold ${pctColor} min-w-[3rem] text-right`}>
                                        {vax.percentage}%
                                      </span>
                                    </div>
                                  </div>
                                  <Progress
                                    value={vax.percentage}
                                    className="h-2.5"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
            {activeTab === "alerts" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Disease Alerts</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {diseaseAlerts === undefined
                      ? "Loading..."
                      : `${diseaseAlerts.length} active alert${diseaseAlerts.length === 1 ? "" : "s"}`}
                  </div>
                </div>

                {diseaseAlerts === undefined ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-28 bg-muted/50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : diseaseAlerts.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="py-10 text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="font-medium">No active disease alerts</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Alerts appear here when any of your livestock are marked sick or quarantined.
                      </p>
                    </CardContent>
                  </Card>
                ) : diseaseAlerts.map((alert) => {
                  const severityInfo = severityConfig[alert.severity];
                  const SeverityIcon = severityInfo.icon;
                  return (
                    <Card key={alert.id} className={`border-border/50 overflow-hidden ${
                      alert.severity === "critical" ? "border-red-500/30" : ""
                    }`}>
                      <div className={`h-1 ${severityInfo.color}`} />
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl ${severityInfo.color}`}>
                            <SeverityIcon className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-lg">{alert.disease}</h3>
                                <p className="text-sm text-muted-foreground">{alert.location}</p>
                              </div>
                              <Badge className={severityInfo.color}>
                                {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                              </Badge>
                            </div>

                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <Activity className="w-4 h-4 text-muted-foreground" />
                                  Symptoms
                                </h4>
                                <ul className="space-y-1">
                                  {alert.symptoms.map((symptom, idx) => (
                                    <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                                      <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                                      {symptom}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-green-500" />
                                  Prevention Tips
                                </h4>
                                <ul className="space-y-1">
                                  {alert.preventionTips.map((tip, idx) => (
                                    <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Beef className="w-4 h-4" />
                                  {alert.affectedCount} affected
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  Reported {alert.reportedDate}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </motion.div>
            )}
          </>
        )}

        {/* Disease Alerts Modal */}
        <AnimatePresence>
          {showAlerts && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAlerts(false)}
            >
              <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl max-h-[80vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Bell className="w-5 h-5 text-primary" />
                      Disease Alerts
                    </h2>
                    <button
                      onClick={() => setShowAlerts(false)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                  {diseaseAlerts === undefined ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : diseaseAlerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No active disease alerts. Alerts appear when livestock are marked sick or quarantined.
                    </p>
                  ) : diseaseAlerts.map((alert) => {
                    const severityInfo = severityConfig[alert.severity];
                    return (
                      <div
                        key={alert.id}
                        className="p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <Badge className={severityInfo.color}>
                            {alert.severity}
                          </Badge>
                          <div className="flex-1">
                            <h4 className="font-medium">{alert.disease}</h4>
                            <p className="text-sm text-muted-foreground">{alert.location}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.affectedCount} affected • Reported {alert.reportedDate}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animal Detail Modal */}
        <AnimatePresence>
          {selectedAnimal && (
            <AnimalDetailModal
              animal={selectedAnimal}
              farmName={farmMap[selectedAnimal.farmId] || "Unknown Farm"}
              onClose={() => setSelectedAnimal(null)}
            />
          )}
        </AnimatePresence>

        {/* Add Livestock Modal */}
        <AnimatePresence>
          <AddLivestockModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            farmId={firstFarmId}
            onCreate={handleCreateLivestock}
            isCreating={false}
          />
        </AnimatePresence>

        {/* Add Health Record Modal */}
        <AddHealthRecordModal
          animal={animalForHealthRecord}
          isOpen={animalForHealthRecord !== null}
          onClose={() => setAnimalForHealthRecord(null)}
          onSubmit={handleAddHealthRecord}
        />
      </div>
    </AppLayout>
  );
}
