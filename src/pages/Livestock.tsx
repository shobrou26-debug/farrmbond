import { useState } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }, as const
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  healthy: { label: "Healthy", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: Heart },
  sick: { label: "Sick", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: Stethoscope },
  pregnant: { label: "Pregnant", color: "bg-pink-500/10 text-pink-600 border-pink-500/20", icon: Heart },
  quarantine: { label: "Quarantine", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: AlertTriangle },
};

const mockLivestock = [
  { id: "1", name: "Holstein Dairy Herd", type: "Cattle", breed: "Holstein", quantity: 24, unit: "head", farm: "Sunrise Ranch", status: "healthy", health: 95, nextVaccination: "2026-08-15", production: "Milk: 18L/day avg" },
  { id: "2", name: "Broiler Flock A", type: "Poultry", breed: "Cobb 500", quantity: 200, unit: "birds", farm: "Green Valley Farm", status: "healthy", health: 88, nextVaccination: "2026-07-20", production: "Meat: 2.1kg avg" },
  { id: "3", name: "Saanen Dairy Goats", type: "Goat", breed: "Saanen", quantity: 12, unit: "head", farm: "Riverside Fields", status: "healthy", health: 90, nextVaccination: "2026-09-01", production: "Milk: 3L/day avg" },
  { id: "4", name: "Dorper Sheep", type: "Sheep", breed: "Dorper", quantity: 18, unit: "head", farm: "Sunrise Ranch", status: "pregnant", health: 82, nextVaccination: "2026-08-10", production: "Lambing: Sept" },
  { id: "5", name: "Layer Hens", type: "Poultry", breed: "Isa Brown", quantity: 150, unit: "birds", farm: "Green Valley Farm", status: "healthy", health: 92, nextVaccination: "2026-07-25", production: "Eggs: 130/day" },
  { id: "6", name: "Brahman Bulls", type: "Cattle", breed: "Brahman", quantity: 6, unit: "head", farm: "Sunrise Ranch", status: "sick", health: 45, nextVaccination: "2026-07-18", production: "Fattening program" },
];

export default function Livestock() {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = mockLivestock.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const healthyCount = mockLivestock.filter((l) => l.status === "healthy").length;
  const sickCount = mockLivestock.filter((l) => l.status === "sick").length;
  const totalHead = mockLivestock.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Livestock Management</h1>
              <p className="text-muted-foreground mt-1">Monitor and manage your livestock across all farms</p>
            </div>
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Livestock
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <Card className="border-border/50"><CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500"><Beef className="w-6 h-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">Total Head</p><p className="text-2xl font-bold">{totalHead}</p></div>
          </CardContent></Card>
          <Card className="border-border/50"><CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-500"><CheckCircle2 className="w-6 h-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">Healthy</p><p className="text-2xl font-bold">{healthyCount}</p></div>
          </CardContent></Card>
          <Card className="border-border/50"><CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500"><Stethoscope className="w-6 h-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">Need Attention</p><p className="text-2xl font-bold">{sickCount}</p></div>
          </CardContent></Card>
          <Card className="border-border/50"><CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500"><Syringe className="w-6 h-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">Vaccinations Due</p><p className="text-2xl font-bold">2</p></div>
          </CardContent></Card>
        </motion.div>

        {/* Search */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search livestock..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </motion.div>

        {/* Livestock Grid */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((animal) => {
            const status = statusConfig[animal.status];
            const StatusIcon = status.icon;
            return (
              <motion.div key={animal.id} variants={itemVariants}>
                <Card className="border-border/50 card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10">
                          <Beef className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{animal.name}</h3>
                          <p className="text-xs text-muted-foreground">{animal.breed} • {animal.farm}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem><Stethoscope className="w-4 h-4 mr-2" />Health Record</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={status.color}><StatusIcon className="w-3 h-3 mr-1" />{status.label}</Badge>
                      <Badge variant="secondary">{animal.quantity} {animal.unit}</Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{animal.type}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Production</span><span className="font-medium">{animal.production}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Next Vaccination</span><span>{animal.nextVaccination}</span></div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Health Score</span>
                        <span className="font-medium">{animal.health}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{
                          width: `${animal.health}%`,
                          background: animal.health >= 90 ? "linear-gradient(90deg, #22c55e, #16a34a)" : animal.health >= 70 ? "linear-gradient(90deg, #f59e0b, #d97706)" : "linear-gradient(90deg, #ef4444, #dc2626)",
                        }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </AppLayout>
  );
}
