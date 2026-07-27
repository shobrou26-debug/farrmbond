import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Stethoscope as StethoscopeIcon,
  Weight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// Types
// ============================================================
interface HealthRecord {
  id: string;
  date: string;
  type: "checkup" | "vaccination" | "treatment" | "surgery" | "deworming" | "injury";
  description: string;
  veterinarian?: string;
  notes?: string;
  cost?: number;
}

interface VaccinationSchedule {
  id: string;
  vaccine: string;
  date: string;
  status: "completed" | "upcoming" | "overdue";
  notes?: string;
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

interface Livestock {
  id: string;
  name: string;
  type: string;
  breed: string;
  quantity: number;
  unit: string;
  farm: string;
  status: "healthy" | "sick" | "pregnant" | "quarantine" | "recovery";
  health: number;
  age: string;
  weight: string;
  gender: "male" | "female" | "mixed";
  nextVaccination: string;
  lastCheckup: string;
  production: string;
  healthRecords: HealthRecord[];
  vaccinationSchedule: VaccinationSchedule[];
  notes?: string;
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
  recovery: { label: "Recovery", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Activity },
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
// Mock Data
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

const mockLivestock: Livestock[] = [
  {
    id: "1",
    name: "Holstein Dairy Herd",
    type: "Cattle",
    breed: "Holstein",
    quantity: 24,
    unit: "head",
    farm: "Sunrise Ranch",
    status: "healthy",
    health: 95,
    age: "3-7 years",
    weight: "550-650 kg",
    gender: "female",
    nextVaccination: "2026-08-15",
    lastCheckup: "2026-07-10",
    production: "Milk: 18L/day avg",
    healthRecords: [
      { id: "hr1", date: "2026-07-10", type: "checkup", description: "Routine health inspection", veterinarian: "Dr. Kamau", notes: "All animals in good health", cost: 5000 },
      { id: "hr2", date: "2026-06-15", type: "vaccination", description: "Annual FMD vaccination", veterinarian: "Dr. Kamau", notes: "All 24 head vaccinated", cost: 12000 },
      { id: "hr3", date: "2026-05-20", type: "deworming", description: "Quarterly deworming treatment", veterinarian: "Dr. Kamau", notes: "Used Ivermectin", cost: 3600 },
    ],
    vaccinationSchedule: [
      { id: "vs1", vaccine: "FMD Vaccine", date: "2026-08-15", status: "upcoming" },
      { id: "vs2", vaccine: "Anthrax Vaccine", date: "2026-09-01", status: "upcoming" },
      { id: "vs3", vaccine: "Brucellosis Test", date: "2026-07-15", status: "completed" },
    ],
  },
  {
    id: "2",
    name: "Broiler Flock A",
    type: "Poultry",
    breed: "Cobb 500",
    quantity: 200,
    unit: "birds",
    farm: "Green Valley Farm",
    status: "healthy",
    health: 88,
    age: "6 weeks",
    weight: "2.1 kg avg",
    gender: "mixed",
    nextVaccination: "2026-07-20",
    lastCheckup: "2026-07-12",
    production: "Meat: 2.1kg avg",
    healthRecords: [
      { id: "hr4", date: "2026-07-12", type: "checkup", description: "Flock health assessment", veterinarian: "Dr. Njoroge", notes: "Minor respiratory issues in 3 birds", cost: 2000 },
      { id: "hr5", date: "2026-07-05", type: "vaccination", description: "Newcastle disease vaccine", veterinarian: "Dr. Njoroge", notes: "All birds vaccinated via drinking water", cost: 4000 },
    ],
    vaccinationSchedule: [
      { id: "vs4", vaccine: "Infectious Bronchitis", date: "2026-07-20", status: "upcoming" },
      { id: "vs5", vaccine: "Newcastle Disease Booster", date: "2026-07-05", status: "completed" },
    ],
  },
  {
    id: "3",
    name: "Saanen Dairy Goats",
    type: "Goat",
    breed: "Saanen",
    quantity: 12,
    unit: "head",
    farm: "Riverside Fields",
    status: "healthy",
    health: 90,
    age: "2-5 years",
    weight: "55-70 kg",
    gender: "female",
    nextVaccination: "2026-09-01",
    lastCheckup: "2026-07-08",
    production: "Milk: 3L/day avg",
    healthRecords: [
      { id: "hr6", date: "2026-07-08", type: "checkup", description: "Monthly health check", veterinarian: "Dr. Wanjiku", notes: "All goats healthy, good body condition", cost: 3000 },
      { id: "hr7", date: "2026-06-20", type: "deworming", description: "Routine deworming", veterinarian: "Dr. Wanjiku", notes: "Albendazole administered", cost: 1200 },
    ],
    vaccinationSchedule: [
      { id: "vs6", vaccine: "CCPP Vaccine", date: "2026-09-01", status: "upcoming" },
      { id: "vs7", vaccine: "Peste des Petits Ruminants", date: "2026-08-20", status: "upcoming" },
    ],
  },
  {
    id: "4",
    name: "Dorper Sheep",
    type: "Sheep",
    breed: "Dorper",
    quantity: 18,
    unit: "head",
    farm: "Sunrise Ranch",
    status: "pregnant",
    health: 82,
    age: "2-4 years",
    weight: "45-60 kg",
    gender: "female",
    nextVaccination: "2026-08-10",
    lastCheckup: "2026-07-05",
    production: "Lambing: Sept",
    healthRecords: [
      { id: "hr8", date: "2026-07-05", type: "checkup", description: "Pregnancy check", veterinarian: "Dr. Kamau", notes: "15 confirmed pregnant, due September", cost: 4500 },
      { id: "hr9", date: "2026-06-10", type: "vaccination", description: "Clostridial vaccine", veterinarian: "Dr. Kamau", notes: "All breeding ewes vaccinated", cost: 5400 },
    ],
    vaccinationSchedule: [
      { id: "vs8", vaccine: "Clostridial Booster", date: "2026-08-10", status: "upcoming" },
      { id: "vs9", vaccine: "Foot Rot Treatment", date: "2026-07-25", status: "overdue" },
    ],
  },
  {
    id: "5",
    name: "Layer Hens",
    type: "Poultry",
    breed: "Isa Brown",
    quantity: 150,
    unit: "birds",
    farm: "Green Valley Farm",
    status: "healthy",
    health: 92,
    age: "28 weeks",
    weight: "1.8 kg avg",
    gender: "female",
    nextVaccination: "2026-07-25",
    lastCheckup: "2026-07-14",
    production: "Eggs: 130/day",
    healthRecords: [
      { id: "hr10", date: "2026-07-14", type: "checkup", description: "Egg production assessment", veterinarian: "Dr. Njoroge", notes: "Production at 87%, good health", cost: 2000 },
      { id: "hr11", date: "2026-07-01", type: "vaccination", description: "Fowl Pox vaccine", veterinarian: "Dr. Njoroge", notes: "Wing web method used", cost: 3000 },
    ],
    vaccinationSchedule: [
      { id: "vs10", vaccine: "Mareks Disease Booster", date: "2026-07-25", status: "upcoming" },
      { id: "vs11", vaccine: "Infectious Bronchitis", date: "2026-08-15", status: "upcoming" },
    ],
  },
  {
    id: "6",
    name: "Brahman Bulls",
    type: "Cattle",
    breed: "Brahman",
    quantity: 6,
    unit: "head",
    farm: "Sunrise Ranch",
    status: "sick",
    health: 45,
    age: "4-6 years",
    weight: "700-800 kg",
    gender: "male",
    nextVaccination: "2026-07-18",
    lastCheckup: "2026-07-15",
    production: "Fattening program",
    healthRecords: [
      { id: "hr12", date: "2026-07-15", type: "treatment", description: "Treatment for East Coast Fever", veterinarian: "Dr. Kamau", notes: "Injections administered, isolated from herd", cost: 8000 },
      { id: "hr13", date: "2026-07-10", type: "checkup", description: "Initial symptoms assessment", veterinarian: "Dr. Kamau", notes: "Enlarged lymph nodes detected, fever", cost: 3000 },
      { id: "hr14", date: "2026-06-01", type: "vaccination", description: "Anthrax vaccination", veterinarian: "Dr. Kamau", notes: "Annual vaccination completed", cost: 3000 },
    ],
    vaccinationSchedule: [
      { id: "vs12", vaccine: "ECF Treatment", date: "2026-07-18", status: "overdue" },
      { id: "vs13", vaccine: "Follow-up Check", date: "2026-07-25", status: "upcoming" },
    ],
    notes: "Currently under treatment for East Coast Fever. Isolated from main herd. Monitor daily.",
  },
  {
    id: "7",
    name: "Friesian Dairy Herd",
    type: "Cattle",
    breed: "Friesian",
    quantity: 16,
    unit: "head",
    farm: "Valley View Estate",
    status: "recovery",
    health: 72,
    age: "2-8 years",
    weight: "500-600 kg",
    gender: "female",
    nextVaccination: "2026-08-05",
    lastCheckup: "2026-07-12",
    production: "Milk: 15L/day avg",
    healthRecords: [
      { id: "hr15", date: "2026-07-12", type: "checkup", description: "Recovery progress check", veterinarian: "Dr. Wanjiku", notes: "Recovering well from mastitis outbreak", cost: 4000 },
      { id: "hr16", date: "2026-07-01", type: "treatment", description: "Mastitis treatment - 4 cows", veterinarian: "Dr. Wanjiku", notes: "Antibiotic therapy completed", cost: 12000 },
    ],
    vaccinationSchedule: [
      { id: "vs14", vaccine: "Brucellosis Test", date: "2026-08-05", status: "upcoming" },
    ],
  },
  {
    id: "8",
    name: "Boer Goat Stud",
    type: "Goat",
    breed: "Boer",
    quantity: 8,
    unit: "head",
    farm: "Highland Homestead",
    status: "healthy",
    health: 94,
    age: "1-3 years",
    weight: "65-90 kg",
    gender: "male",
    nextVaccination: "2026-08-20",
    lastCheckup: "2026-07-08",
    production: "Breeding stock",
    healthRecords: [
      { id: "hr17", date: "2026-07-08", type: "checkup", description: "Breeding soundness exam", veterinarian: "Dr. Kamau", notes: "All bucks in excellent condition", cost: 6000 },
      { id: "hr18", date: "2026-06-15", type: "deworming", description: "Routine deworming", veterinarian: "Dr. Kamau", notes: "Fenbendazole administered", cost: 800 },
    ],
    vaccinationSchedule: [
      { id: "vs15", vaccine: "CCPP Vaccine", date: "2026-08-20", status: "upcoming" },
    ],
  },
];

// ============================================================
// Helper Functions
// ============================================================
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const getDaysUntil = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

// ============================================================
// Main Component
// ============================================================
export default function Livestock() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedAnimal, setSelectedAnimal] = useState<Livestock | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "health" | "vaccinations" | "alerts">("overview");
  const [showAlerts, setShowAlerts] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);

  // Filter livestock
  const filtered = useMemo(() => {
    return mockLivestock.filter((animal) => {
      const matchesSearch =
        searchQuery === "" ||
        animal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        animal.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        animal.breed.toLowerCase().includes(searchQuery.toLowerCase()) ||
        animal.farm.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === "all" || animal.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, selectedStatus]);

  // Statistics
  const stats = useMemo(() => {
    const totalHead = mockLivestock.reduce((sum, l) => sum + l.quantity, 0);
    const healthyCount = mockLivestock.filter((l) => l.status === "healthy").length;
    const sickCount = mockLivestock.filter((l) => l.status === "sick" || l.status === "quarantine").length;
    const vaccinationsDue = mockLivestock.reduce((sum, l) => {
      const upcoming = l.vaccinationSchedule.filter(
        (v) => v.status === "upcoming" || v.status === "overdue"
      ).length;
      return sum + upcoming;
    }, 0);
    const overdueVaccinations = mockLivestock.reduce((sum, l) => {
      const overdue = l.vaccinationSchedule.filter((v) => v.status === "overdue").length;
      return sum + overdue;
    }, 0);
    const avgHealth = Math.round(mockLivestock.reduce((sum, l) => sum + l.health, 0) / mockLivestock.length);
    return { totalHead, healthyCount, sickCount, vaccinationsDue, overdueVaccinations, avgHealth };
  }, []);

  // Upcoming vaccinations across all animals
  const upcomingVaccinations = useMemo(() => {
    const allVaccinations: Array<{ animal: Livestock; vaccine: string; date: string; status: string }> = [];
    mockLivestock.forEach((animal) => {
      animal.vaccinationSchedule.forEach((vac) => {
        if (vac.status === "upcoming" || vac.status === "overdue") {
          allVaccinations.push({ animal, vaccine: vac.vaccine, date: vac.date, status: vac.status });
        }
      });
    });
    return allVaccinations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, []);

  // Status filter options
  const statusFilters = [
    { id: "all", label: "All", count: mockLivestock.length },
    { id: "healthy", label: "Healthy", count: mockLivestock.filter((l) => l.status === "healthy").length },
    { id: "sick", label: "Sick", count: mockLivestock.filter((l) => l.status === "sick").length },
    { id: "pregnant", label: "Pregnant", count: mockLivestock.filter((l) => l.status === "pregnant").length },
    { id: "recovery", label: "Recovery", count: mockLivestock.filter((l) => l.status === "recovery").length },
    { id: "quarantine", label: "Quarantine", count: mockLivestock.filter((l) => l.status === "quarantine").length },
  ];

  // Animal Detail Modal
  const AnimalDetailModal = ({ animal }: { animal: Livestock }) => {
    const [detailTab, setDetailTab] = useState<"records" | "vaccinations" | "notes">("records");

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => setSelectedAnimal(null)}
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
              onClick={() => setSelectedAnimal(null)}
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
                <p className="text-muted-foreground">{animal.breed} • {animal.farm}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={statusConfig[animal.status].color}>
                    {statusConfig[animal.status].label}
                  </Badge>
                  <Badge variant="secondary">{animal.quantity} {animal.unit}</Badge>
                  <Badge variant="secondary">{animal.gender === "male" ? "♂ Male" : animal.gender === "female" ? "♀ Female" : "Mixed"}</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-border">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Health Score</p>
              <p className="text-2xl font-bold" style={{ color: animal.health >= 80 ? "#22c55e" : animal.health >= 60 ? "#f59e0b" : "#ef4444" }}>
                {animal.health}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Age</p>
              <p className="text-2xl font-bold">{animal.age}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Weight</p>
              <p className="text-2xl font-bold">{animal.weight}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Last Checkup</p>
              <p className="text-lg font-semibold">{formatDate(animal.lastCheckup)}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {[
              { id: "records" as const, label: "Health Records", icon: FileText },
              { id: "vaccinations" as const, label: "Vaccinations", icon: Shield },
              { id: "notes" as const, label: "Notes", icon: Stethoscope },
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
                {animal.healthRecords.map((record) => {
                  const typeInfo = recordTypeConfig[record.type];
                  const TypeIcon = typeInfo.icon;
                  return (
                    <div key={record.id} className="flex gap-4 p-4 rounded-xl bg-muted/30">
                      <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{record.description}</h4>
                          <span className="text-sm text-muted-foreground">{formatDate(record.date)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {record.veterinarian && `By ${record.veterinarian}`}
                          {record.cost && ` • Cost: KES ${record.cost.toLocaleString()}`}
                        </p>
                        {record.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">"{record.notes}"</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {animal.healthRecords.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No health records yet</p>
                  </div>
                )}
              </div>
            )}

            {detailTab === "vaccinations" && (
              <div className="space-y-4">
                {animal.vaccinationSchedule.map((vac) => (
                  <div
                    key={vac.id}
                    className={`flex items-center gap-4 p-4 rounded-xl ${
                      vac.status === "overdue"
                        ? "bg-red-500/5 border border-red-500/20"
                        : vac.status === "completed"
                        ? "bg-green-500/5 border border-green-500/20"
                        : "bg-muted/30"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        vac.status === "overdue"
                          ? "bg-red-500/10 text-red-600"
                          : vac.status === "completed"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{vac.vaccine}</h4>
                      <p className="text-sm text-muted-foreground">{formatDate(vac.date)}</p>
                    </div>
                    <Badge
                      className={
                        vac.status === "overdue"
                          ? "bg-red-500/10 text-red-600"
                          : vac.status === "completed"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-primary/10 text-primary"
                      }
                    >
                      {vac.status === "overdue" ? "Overdue" : vac.status === "completed" ? "Completed" : "Upcoming"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "notes" && (
              <div className="space-y-4">
                {animal.notes ? (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-amber-600">Important Notes</span>
                    </div>
                    <p className="text-muted-foreground">{animal.notes}</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Stethoscope className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No notes recorded</p>
                  </div>
                )}
                <div className="p-4 rounded-xl bg-muted/30">
                  <h4 className="font-medium mb-2">Production Info</h4>
                  <p className="text-muted-foreground">{animal.production}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
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
              <Button className="gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Livestock
              </Button>
            </div>
          </div>
        </motion.div>

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
              <Button variant="outline" size="sm" onClick={() => setActiveTab("vaccinations")}>
                View Schedule
              </Button>
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
              { id: "vaccinations" as const, label: "Vaccination Schedule", icon: Syringe },
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
              {filtered.map((animal) => {
                const status = statusConfig[animal.status];
                const StatusIcon = status.icon;
                const daysUntilVaccination = getDaysUntil(animal.nextVaccination);
                const hasOverdue = animal.vaccinationSchedule.some((v) => v.status === "overdue");

                return (
                  <motion.div key={animal.id} variants={itemVariants}>
                    <Card className={`border-border/50 hover:shadow-lg transition-all cursor-pointer ${hasOverdue ? "border-red-500/30" : ""}`}>
                      <CardContent className="p-5" onClick={() => setSelectedAnimal(animal)}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10">
                              <Beef className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{animal.name}</h3>
                              <p className="text-xs text-muted-foreground">
                                {animal.breed} • {animal.farm}
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
                              <DropdownMenuItem>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Stethoscope className="w-4 h-4 mr-2" />
                                Add Health Record
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Syringe className="w-4 h-4 mr-2" />
                                Schedule Vaccination
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
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
                            <span className="font-medium text-primary">{animal.production}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Next Vaccination</span>
                            <span className={daysUntilVaccination < 0 ? "text-red-500 font-medium" : daysUntilVaccination < 7 ? "text-amber-500 font-medium" : ""}>
                              {daysUntilVaccination < 0
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
                            <span className="font-medium" style={{ color: animal.health >= 80 ? "#22c55e" : animal.health >= 60 ? "#f59e0b" : "#ef4444" }}>
                              {animal.health}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${animal.health}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{
                                background:
                                  animal.health >= 80
                                    ? "linear-gradient(90deg, #22c55e, #16a34a)"
                                    : animal.health >= 60
                                    ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                    : "linear-gradient(90deg, #ef4444, #dc2626)",
                              }}
                            />
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm" className="flex-1" onClick={(e) => e.stopPropagation()}>
                            <Stethoscope className="w-4 h-4 mr-1" />
                            Health
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1" onClick={(e) => e.stopPropagation()}>
                            <Syringe className="w-4 h-4 mr-1" />
                            Vaccinate
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Beef className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">No livestock found</h3>
                <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
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
              <Button className="gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Record
              </Button>
            </div>
            {mockLivestock.map((animal) =>
              animal.healthRecords.map((record) => {
                const typeInfo = recordTypeConfig[record.type];
                const TypeIcon = typeInfo.icon;
                return (
                  <Card key={record.id} className="border-border/50">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{record.description}</h4>
                            <p className="text-sm text-muted-foreground">
                              {animal.name} • {animal.farm}
                            </p>
                          </div>
                          <span className="text-sm text-muted-foreground">{formatDate(record.date)}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {record.veterinarian && (
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-3 h-3" />
                              {record.veterinarian}
                            </span>
                          )}
                          {record.cost && (
                            <span>KES {record.cost.toLocaleString()}</span>
                          )}
                        </div>
                        {record.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">"{record.notes}"</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </motion.div>
        )}

        {/* Vaccination Schedule Tab */}
        {activeTab === "vaccinations" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Vaccination Schedule</h2>
              <Button className="gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Vaccination
              </Button>
            </div>

            {/* Overdue Section */}
            {upcomingVaccinations.filter((v) => v.status === "overdue").length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Overdue ({upcomingVaccinations.filter((v) => v.status === "overdue").length})
                </h3>
                <div className="space-y-3">
                  {upcomingVaccinations
                    .filter((v) => v.status === "overdue")
                    .map((v, idx) => (
                      <Card key={idx} className="border-red-500/30 bg-red-500/5">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-red-500/10">
                            <Syringe className="w-5 h-5 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{v.vaccine}</h4>
                            <p className="text-sm text-muted-foreground">
                              {v.animal.name} • {v.animal.farm}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-red-600">
                              {formatDate(v.date)}
                            </p>
                            <p className="text-xs text-red-500">
                              {Math.abs(getDaysUntil(v.date))} days overdue
                            </p>
                          </div>
                          <Button size="sm" variant="outline" className="border-red-500/30 text-red-600">
                            Schedule Now
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* Upcoming Section */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Upcoming ({upcomingVaccinations.filter((v) => v.status === "upcoming").length})
              </h3>
              <div className="space-y-3">
                {upcomingVaccinations
                  .filter((v) => v.status === "upcoming")
                  .map((v, idx) => {
                    const daysUntil = getDaysUntil(v.date);
                    return (
                      <Card key={idx} className="border-border/50">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Syringe className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{v.vaccine}</h4>
                            <p className="text-sm text-muted-foreground">
                              {v.animal.name} • {v.animal.farm}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatDate(v.date)}</p>
                            <p className={`text-xs ${daysUntil < 7 ? "text-amber-500" : "text-muted-foreground"}`}>
                              {daysUntil === 0 ? "Today" : `In ${daysUntil} days`}
                            </p>
                          </div>
                          <Button size="sm" variant="outline">
                            <Calendar className="w-4 h-4 mr-1" />
                            Remind
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>

            {/* Completed Section */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Recently Completed
              </h3>
              <div className="space-y-2">
                {mockLivestock
                  .flatMap((a) =>
                    a.vaccinationSchedule
                      .filter((v) => v.status === "completed")
                      .map((v) => ({ animal: a, ...v }))
                  )
                  .slice(0, 5)
                  .map((v, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="font-medium">{v.vaccine}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{v.animal.name}</span>
                      <span className="ml-auto text-muted-foreground">{formatDate(v.date)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
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
                              Reported {formatDate(alert.reportedDate)}
                            </span>
                          </div>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
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
                              {alert.affectedCount} • Reported {formatDate(alert.reportedDate)}
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
          {selectedAnimal && <AnimalDetailModal animal={selectedAnimal} />}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
