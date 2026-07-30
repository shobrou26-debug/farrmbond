import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Thermometer,
  Activity,
  FileText,
  X,
  ChevronRight,
  Bell,
  Pill,
  Shield,
  AlertCircle,
  Info,
  PillBottle,
  Weight,
  Inbox,
  DollarSign,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { VaccinationScheduleTab } from "@/components/VaccinationSchedule";
import { Label } from "@/components/ui/label";
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

interface DiseaseAlert {
  id: string;
  disease: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedCount: number;
  location: string;
  symptoms: string[];
  preventionTips: string[];
  reportedDate: string;
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
const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  healthy: { label: "Healthy", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: Heart },
  sick: { label: "Sick", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: Stethoscope },
  pregnant: { label: "Pregnant", color: "bg-pink-500/10 text-pink-600 border-pink-500/20", icon: Heart },
  quarantine: { label: "Quarantine", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: AlertTriangle },
};

const severityConfig: Record<string, { color: string; icon: React.ComponentType<{className?: string}> }> = {
  critical: { color: "bg-red-500 text-white", icon: AlertTriangle },
  high: { color: "bg-orange-500 text-white", icon: AlertCircle },
  medium: { color: "bg-amber-500 text-white", icon: Info },
  low: { color: "bg-blue-500 text-white", icon: Info },
};

const recordTypeConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  checkup: { label: "Checkup", color: "bg-blue-100 text-blue-700", icon: Stethoscope },
  vaccination: { label: "Vaccination", color: "bg-green-100 text-green-700", icon: Shield },
  treatment: { label: "Treatment", color: "bg-purple-100 text-purple-700", icon: Pill },
  surgery: { label: "Surgery", color: "bg-red-100 text-red-700", icon: Activity },
  deworming: { label: "Deworming", color: "bg-cyan-100 text-cyan-700", icon: PillBottle },
  injury: { label: "Injury", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
};

// ============================================================
// Disease Alerts (external data - not from Convex)
// ============================================================
const mockDiseaseAlerts: DiseaseAlert[] = [
  {
    id: "d1",
    disease: "Foot and Mouth Disease (FMD)",
    severity: "critical",
    affectedCount: 12,
    location: "Nakuru County, Kenya",
    symptoms: ["Blisters on mouth and feet", "Excessive drooling", "Lameness", "Fever", "Loss of appetite"],
    preventionTips: ["Vaccinate regularly", "Quarantine new animals", "Avoid contact with infected areas", "Report cases immediately"],
    reportedDate: "2026-07-25",
  },
  {
    id: "d2",
    disease: "Avian Influenza (Bird Flu)",
    severity: "high",
    affectedCount: 45,
    location: "Kiambu County, Kenya",
    symptoms: ["Sudden death", "Swelling of head", "Purple discoloration of wattles", "Decreased egg production"],
    preventionTips: ["Keep poultry enclosed", "Avoid wild bird contact", "Practice biosecurity", "Vaccinate flock"],
    reportedDate: "2026-07-23",
  },
  {
    id: "d3",
    disease: "East Coast Fever (ECF)",
    severity: "medium",
    affectedCount: 5,
    location: "Machakos County, Kenya",
    symptoms: ["Enlarged lymph nodes", "Fever", "Nasal discharge", "Weight loss", "Anemia"],
    preventionTips: ["Immunize cattle", "Control tick population", "Regular dipping", "Monitor herd closely"],
    reportedDate: "2026-07-20",
  },
  {
    id: "d4",
    disease: "Newcastle Disease",
    severity: "medium",
    affectedCount: 28,
    location: "Trans Nzoia County, Kenya",
    symptoms: ["Respiratory distress", "Greenish diarrhea", "Nervous signs", "Drop in egg production"],
    preventionTips: ["Vaccinate on schedule", "Isolate sick birds", "Maintain hygiene", "Control wild bird access"],
    reportedDate: "2026-07-18",
  },
];

// ============================================================
// Helper Functions
// ============================================================
const formatDate = (timestamp?: number) => {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const formatDateForInput = (timestamp?: number) => {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString().split("T")[0];
};

const parseDateInput = (dateStr: string): number | undefined => {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date.getTime();
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
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
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
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
// Enhanced Add Livestock Modal (Multi-Step)
// ============================================================
function AddLivestockModal({
  isOpen,
  onClose,
  farmId,
  onCreate,
  isCreating,
}: {
  isOpen: boolean;
  onClose: () => void;
  farmId: string | null;
  onCreate: (data: {
    farmId: string;
    name: string;
    type: string;
    breed?: string;
    quantity: number;
    unit: string;
    acquisitionDate: number;
    productionType?: string;
    acquisitionCost?: number;
    feedType?: string;
    dailyFeedCost?: number;
    lastVaccination?: number;
    nextVaccination?: number;
    lastCheckup?: number;
    initialHealthRecord?: {
      description: string;
      treatment: string;
      cost?: number;
    };
  }) => void;
  isCreating: boolean;
}) {
  const [step, setStep] = useState(0); // 0: basic, 1: cost, 2: health, 3: review
  const [name, setName] = useState("");
  const [type, setType] = useState("Cattle");
  const [breed, setBreed] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("head");
  const [productionType, setProductionType] = useState("");
  // Cost tracking
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [feedType, setFeedType] = useState("");
  const [dailyFeedCost, setDailyFeedCost] = useState("");
  // Vaccination scheduling
  const [lastVaccination, setLastVaccination] = useState("");
  const [nextVaccination, setNextVaccination] = useState("");
  const [lastCheckup, setLastCheckup] = useState("");
  // Initial health record
  const [hasInitialRecord, setHasInitialRecord] = useState(false);
  const [recordDescription, setRecordDescription] = useState("");
  const [recordTreatment, setRecordTreatment] = useState("");
  const [recordCost, setRecordCost] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setName("");
    setType("Cattle");
    setBreed("");
    setQuantity("1");
    setUnit("head");
    setProductionType("");
    setAcquisitionCost("");
    setFeedType("");
    setDailyFeedCost("");
    setLastVaccination("");
    setNextVaccination("");
    setLastCheckup("");
    setHasInitialRecord(false);
    setRecordDescription("");
    setRecordTreatment("");
    setRecordCost("");
    setStep(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const canProceedStep0 = name.trim() && quantity;
  const canProceedStep1 = true; // Cost fields are optional
  const canProceedStep2 = !hasInitialRecord || (recordDescription.trim() && recordTreatment.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !name || !quantity) return;

    const data: Parameters<typeof onCreate>[0] = {
      farmId,
      name,
      type,
      breed: breed || undefined,
      quantity: parseInt(quantity) || 1,
      unit,
      acquisitionDate: Date.now(),
      productionType: productionType || undefined,
    };

    if (acquisitionCost) data.acquisitionCost = parseFloat(acquisitionCost);
    if (feedType) data.feedType = feedType;
    if (dailyFeedCost) data.dailyFeedCost = parseFloat(dailyFeedCost);
    if (lastVaccination) data.lastVaccination = parseDateInput(lastVaccination);
    if (nextVaccination) data.nextVaccination = parseDateInput(nextVaccination);
    if (lastCheckup) data.lastCheckup = parseDateInput(lastCheckup);
    if (hasInitialRecord && recordDescription.trim() && recordTreatment.trim()) {
      data.initialHealthRecord = {
        description: recordDescription,
        treatment: recordTreatment,
        cost: recordCost ? parseFloat(recordCost) : undefined,
      };
    }

    onCreate(data);
    resetForm();
    onClose();
  };

  const steps = [
    { label: "Basic Info", icon: Beef },
    { label: "Cost & Feed", icon: DollarSign },
    { label: "Health & Vaccines", icon: Syringe },
    { label: "Review", icon: CheckCircle2 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Beef className="w-5 h-5 text-primary" />
              Add Livestock
            </h2>
            <button onClick={handleClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center gap-2 mt-4">
            {steps.map((s, i) => {
              const StepIcon = s.icon;
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                      i <= step
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < step ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-xs hidden sm:inline ${i === step ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && (
                    <div className={`w-4 h-px mx-1 ${i < step ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 min-h-[320px]">
            {/* Step 0: Basic Info */}
            {step === 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Information</h3>
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input placeholder="e.g., Holstein Dairy Herd" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Type *</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      required
                    >
                      <option value="Cattle">Cattle</option>
                      <option value="Poultry">Poultry</option>
                      <option value="Goat">Goat</option>
                      <option value="Sheep">Sheep</option>
                      <option value="Pig">Pig</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Breed</label>
                    <Input placeholder="e.g., Holstein" value={breed} onChange={(e) => setBreed(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Quantity *</label>
                    <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Unit</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    >
                      <option value="head">head</option>
                      <option value="birds">birds</option>
                      <option value="pigs">pigs</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Production Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={productionType}
                    onChange={(e) => setProductionType(e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="milk">Milk</option>
                    <option value="meat">Meat</option>
                    <option value="eggs">Eggs</option>
                    <option value="wool">Wool</option>
                    <option value="breeding">Breeding</option>
                  </select>
                </div>
              </motion.div>
            )}

            {/* Step 1: Cost & Feed Tracking */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cost & Feed Tracking</h3>
                <div>
                  <label className="text-sm font-medium">Acquisition Cost (KES)</label>
                  <Input type="number" min="0" placeholder="e.g., 50000" value={acquisitionCost} onChange={(e) => setAcquisitionCost(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Total cost of purchasing/acquiring this livestock</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Feed Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={feedType}
                    onChange={(e) => setFeedType(e.target.value)}
                  >
                    <option value="">Select feed type</option>
                    <option value="commercial">Commercial Feed</option>
                    <option value="natural">Natural/Pasture</option>
                    <option value="mixed">Mixed</option>
                    <option value="silage">Silage</option>
                    <option value="hay">Hay</option>
                    <option value="grains">Grains</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Daily Feed Cost (KES)</label>
                  <Input type="number" min="0" step="0.01" placeholder="e.g., 500" value={dailyFeedCost} onChange={(e) => setDailyFeedCost(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Estimated daily feed cost per unit</p>
                </div>
              </motion.div>
            )}

            {/* Step 2: Health & Vaccination Scheduling */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Health & Vaccination Schedule</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Last Vaccination Date</label>
                    <Input type="date" value={lastVaccination} onChange={(e) => setLastVaccination(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Next Vaccination Date</label>
                    <Input type="date" value={nextVaccination} onChange={(e) => setNextVaccination(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Last Checkup Date</label>
                  <Input type="date" value={lastCheckup} onChange={(e) => setLastCheckup(e.target.value)} />
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="hasInitialRecord"
                      checked={hasInitialRecord}
                      onChange={(e) => setHasInitialRecord(e.target.checked)}
                      className="rounded border-input"
                    />
                    <label htmlFor="hasInitialRecord" className="text-sm font-medium">Add initial health record</label>
                  </div>

                  {hasInitialRecord && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 pl-6 border-l-2 border-primary/20"
                    >
                      <div>
                        <label className="text-sm font-medium">Description *</label>
                        <Input placeholder="e.g., Initial health assessment" value={recordDescription} onChange={(e) => setRecordDescription(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Treatment / Notes *</label>
                        <Input placeholder="e.g., All animals in good health, dewormed" value={recordTreatment} onChange={(e) => setRecordTreatment(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Cost (KES)</label>
                        <Input type="number" min="0" placeholder="e.g., 5000" value={recordCost} onChange={(e) => setRecordCost(e.target.value)} />
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Review & Confirm</h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Beef className="w-4 h-4 text-amber-500" />
                      Basic Info
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Name:</span><span>{name}</span>
                      <span className="text-muted-foreground">Type:</span><span>{type}</span>
                      {breed && <><span className="text-muted-foreground">Breed:</span><span>{breed}</span></>}
                      <span className="text-muted-foreground">Quantity:</span><span>{quantity} {unit}</span>
                      {productionType && <><span className="text-muted-foreground">Production:</span><span className="capitalize">{productionType}</span></>}
                    </div>
                  </div>

                  {(acquisitionCost || feedType || dailyFeedCost) && (
                    <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        Cost & Feed
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {acquisitionCost && <><span className="text-muted-foreground">Acquisition Cost:</span><span>KES {parseFloat(acquisitionCost).toLocaleString()}</span></>}
                        {feedType && <><span className="text-muted-foreground">Feed Type:</span><span className="capitalize">{feedType}</span></>}
                        {dailyFeedCost && <><span className="text-muted-foreground">Daily Feed Cost:</span><span>KES {parseFloat(dailyFeedCost).toLocaleString()}</span></>}
                      </div>
                    </div>
                  )}

                  {(lastVaccination || nextVaccination || lastCheckup || hasInitialRecord) && (
                    <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Syringe className="w-4 h-4 text-blue-500" />
                        Health & Vaccinations
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {lastVaccination && <><span className="text-muted-foreground">Last Vaccination:</span><span>{formatDate(parseDateInput(lastVaccination))}</span></>}
                        {nextVaccination && <><span className="text-muted-foreground">Next Vaccination:</span><span>{formatDate(parseDateInput(nextVaccination))}</span></>}
                        {lastCheckup && <><span className="text-muted-foreground">Last Checkup:</span><span>{formatDate(parseDateInput(lastCheckup))}</span></>}
                        {hasInitialRecord && (
                          <>
                            <span className="text-muted-foreground">Initial Record:</span>
                            <span>{recordDescription}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border flex gap-3">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                type="button"
                className="flex-1 gradient-primary"
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 0 && !canProceedStep0) ||
                  (step === 2 && !canProceedStep2)
                }
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button type="submit" className="flex-1 gradient-primary" disabled={isCreating || !name}>
                {isCreating ? "Adding..." : "Add Livestock"}
              </Button>
            )}
          </div>
        </form>
      </motion.div>
    </motion.div>
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
            <p className="text-2xl font-bold" style={{ color: (animal.healthScore ?? 100) >= 80 ? "#22c55e" : (animal.healthScore ?? 100) >= 60 ? "#f59e0b" : "#ef4444" }}>
              {animal.healthScore ?? 100}%
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
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedAnimal, setSelectedAnimal] = useState<LivestockDoc | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "health" | "vaccinations" | "alerts">("overview");
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
  const completeVaccination = useMutation(api.livestock.completeVaccination);

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
    const avgHealth = livestock.length > 0
      ? Math.round(livestock.reduce((sum: number, l: LivestockDoc) => sum + (l.healthScore ?? 100), 0) / livestock.length)
      : 0;
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

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Livestock Health</h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive health tracking, vaccination schedules, and disease alerts
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAlerts(true)}
                className="relative"
              >
                <Bell className="w-4 h-4 mr-2" />
                Disease Alerts
                {mockDiseaseAlerts.filter((a) => a.severity === "critical" || a.severity === "high").length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {mockDiseaseAlerts.filter((a) => a.severity === "critical" || a.severity === "high").length}
                  </span>
                )}
              </Button>
              <Button
                className="gradient-primary"
                onClick={() => setShowAddModal(true)}
                disabled={!firstFarmId}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Livestock
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-3">
                    <div className="h-12 w-12 rounded-xl bg-muted" />
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-6 w-16 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
            >
              <motion.div variants={itemVariants}>
                <Card className="border-border/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                      <Beef className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Livestock</p>
                      <p className="text-2xl font-bold">{stats.totalHead}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="border-border/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Healthy Groups</p>
                      <p className="text-2xl font-bold">{stats.healthyCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="border-border/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Need Attention</p>
                      <p className="text-2xl font-bold">{stats.sickCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="border-border/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${stats.overdueVaccinations > 0 ? "bg-gradient-to-br from-red-500 to-rose-600" : "bg-gradient-to-br from-blue-500 to-indigo-600"} text-white`}>
                      <Syringe className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vaccinations Due</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-bold">{stats.vaccinationsDue}</p>
                        {stats.overdueVaccinations > 0 && (
                          <span className="text-sm text-red-500 font-medium">({stats.overdueVaccinations} overdue)</span>
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
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-red-600">Overdue Vaccinations</h4>
                    <p className="text-sm text-muted-foreground mt-1">
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
              <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
                {[
                  { id: "overview" as const, label: "Overview", icon: Beef },
                  { id: "health" as const, label: "Health Records", icon: Heart },
                  { id: "vaccinations" as const, label: "Vaccinations", icon: Syringe },
                  { id: "alerts" as const, label: "Disease Alerts", icon: AlertTriangle },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
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
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search livestock by name, type, breed, or farm..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {statusFilters.map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => setSelectedStatus(filter.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          selectedStatus === filter.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {filter.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          selectedStatus === filter.id ? "bg-white/20" : "bg-background"
                        }`}>
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
                    const status = statusConfig[animal.status] || { label: animal.status, color: "bg-gray-100 text-gray-600", icon: Beef };
                    const StatusIcon = status.icon;
                    const daysUntilVaccination = getDaysUntilDate(animal.nextVaccination);
                    const health = animal.healthScore ?? 100;
                    const farmName = farmMap[animal.farmId] || "Unknown Farm";

                    return (
                      <motion.div key={animal._id} variants={itemVariants}>
                        <Card className={`border-border/50 hover:shadow-lg transition-all cursor-pointer ${daysUntilVaccination !== null && daysUntilVaccination < 0 ? "border-red-500/30" : ""}`}>
                          <CardContent className="p-5" onClick={() => setSelectedAnimal(animal)}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10">
                                  <Beef className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold">{animal.name}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {animal.breed || animal.type} • {farmName}
                                  </p>
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedAnimal(animal)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(animal._id, "healthy")}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Mark Healthy
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(animal._id, "sick")}>
                                    <Stethoscope className="w-4 h-4 mr-2" />
                                    Mark Sick
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setAnimalForHealthRecord(animal)}>
                                    <FileText className="w-4 h-4 mr-2" />
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
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                              <Badge className={status.color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                              <Badge variant="secondary">
                                {animal.quantity} {animal.unit}
                              </Badge>
                            </div>

                            <div className="space-y-2 text-sm mb-4">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Type</span>
                                <span>{animal.type}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Production</span>
                                <span className="font-medium text-primary capitalize">{animal.productionType || "N/A"}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Next Vaccination</span>
                                <span className={
                                  daysUntilVaccination === null ? "" :
                                  daysUntilVaccination < 0 ? "text-red-500 font-medium" :
                                  daysUntilVaccination < 7 ? "text-amber-500 font-medium" : ""
                                }>
                                  {daysUntilVaccination === null
                                    ? "Not scheduled"
                                    : daysUntilVaccination < 0
                                    ? `${Math.abs(daysUntilVaccination)} days overdue`
                                    : daysUntilVaccination === 0
                                    ? "Today"
                                    : `In ${daysUntilVaccination} days`}
                                </span>
                              </div>
                            </div>

                            {/* Health Score Bar */}
                            <div>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-muted-foreground">Health Score</span>
                                <span className="font-medium" style={{ color: health >= 80 ? "#22c55e" : health >= 60 ? "#f59e0b" : "#ef4444" }}>
                                  {health}%
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${health}%` }}
                                  transition={{ duration: 1, ease: "easeOut" }}
                                  className="h-full rounded-full"
                                  style={{
                                    background:
                                      health >= 80
                                        ? "linear-gradient(90deg, #22c55e, #16a34a)"
                                        : health >= 60
                                        ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                        : "linear-gradient(90deg, #ef4444, #dc2626)",
                                  }}
                                />
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex gap-2 mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(animal._id, animal.status === "healthy" ? "sick" : "healthy");
                                }}
                              >
                                <Stethoscope className="w-4 h-4 mr-1" />
                                {animal.status === "healthy" ? "Mark Sick" : "Mark Healthy"}
                              </Button>
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
                    <Button variant="outline" onClick={loadMore}>
                      Load More
                    </Button>
                  </div>
                )}

                {filtered.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <Beef className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium">No livestock found</h3>
                    <p className="text-muted-foreground mt-1">
                      {livestock.length === 0
                        ? "Add your first livestock to get started"
                        : "Try adjusting your search or filters"}
                    </p>
                    {livestock.length === 0 && firstFarmId && (
                      <Button className="gradient-primary mt-4" onClick={() => setShowAddModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Livestock
                      </Button>
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
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium">No health records yet</h3>
                    <p className="text-muted-foreground mt-1">Health records will appear here once you add medical history to your livestock</p>
                  </div>
                ) : (
                  livestock
                    .filter((a: LivestockDoc) => a.medicalHistory && a.medicalHistory.length > 0)
                    .flatMap((animal: LivestockDoc) =>
                      (animal.medicalHistory || []).map((record, idx) => (
                        <Card key={`${animal._id}-${idx}`} className="border-border/50">
                          <CardContent className="p-4 flex items-start gap-4">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">{record.description}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {animal.name} • {farmMap[animal.farmId] || "Unknown Farm"}
                                  </p>
                                </div>
                                <span className="text-sm text-muted-foreground">{formatDate(record.date)}</span>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span>{record.treatment}</span>
                                {record.cost && (
                                  <span>KES {record.cost.toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )
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
                    Last updated: Today
                  </div>
                </div>

                {mockDiseaseAlerts.map((alert) => {
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
                  {mockDiseaseAlerts.map((alert) => {
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
