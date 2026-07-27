import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Leaf,
  Plus,
  Search,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sprout,
  Droplets,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Camera,
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

const statusConfig: Record<string, { label: string; color: string }> = {
  seedling: { label: "Seedling", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  growing: { label: "Growing", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  flowering: { label: "Flowering", color: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
  fruiting: { label: "Fruiting", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  harvest_ready: { label: "Harvest Ready", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  harvested: { label: "Harvested", color: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const mockCrops = [
  { id: "1", name: "Tomatoes", variety: "Roma VF", type: "vegetable", farm: "Green Valley Farm", status: "harvest_ready", health: 92, plantingDate: "2026-03-15", expectedYield: "2,400 kg", cost: "$1,200" },
  { id: "2", name: "Maize", variety: "H614", type: "grain", farm: "Sunrise Ranch", status: "growing", health: 85, plantingDate: "2026-04-01", expectedYield: "8,000 kg", cost: "$2,500" },
  { id: "3", name: "Beans", variety: "Rose Coco", type: "legume", farm: "Green Valley Farm", status: "flowering", health: 88, plantingDate: "2026-04-20", expectedYield: "1,200 kg", cost: "$600" },
  { id: "4", name: "Kale", variety: "Sukuma Wiki", type: "vegetable", farm: "Riverside Fields", status: "growing", health: 95, plantingDate: "2026-05-01", expectedYield: "800 kg", cost: "$300" },
  { id: "5", name: "Potatoes", variety: "Shangi", type: "tuber", farm: "Sunrise Ranch", status: "seedling", health: 78, plantingDate: "2026-05-15", expectedYield: "5,000 kg", cost: "$1,800" },
  { id: "6", name: "Cabbages", variety: "Green King", type: "vegetable", farm: "Riverside Fields", status: "harvested", health: 100, plantingDate: "2026-02-10", expectedYield: "1,500 kg", cost: "$700" },
];

export default function Crops() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCrops = mockCrops.filter((crop) =>
    crop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    crop.variety.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = mockCrops.filter((c) => c.status !== "harvested" && c.status !== "failed").length;
  const harvestReady = mockCrops.filter((c) => c.status === "harvest_ready").length;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Crop Management</h1>
              <p className="text-muted-foreground mt-1">Track and manage all your crops across farms</p>
            </div>
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Crop
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-500">
                <Sprout className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Crops</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ready to Harvest</p>
                <p className="text-2xl font-bold">{harvestReady}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Health Score</p>
                <p className="text-2xl font-bold">90%</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search crops..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </motion.div>

        {/* Crops Grid */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCrops.map((crop) => {
            const status = statusConfig[crop.status];
            return (
              <motion.div key={crop.id} variants={itemVariants}>
                <Card className="border-border/50 card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/10">
                          <Leaf className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{crop.name}</h3>
                          <p className="text-xs text-muted-foreground">{crop.variety}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                          <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem><Camera className="w-4 h-4 mr-2" />Disease Check</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={status.color}>{status.label}</Badge>
                      <Badge variant="secondary">{crop.type}</Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Farm</span>
                        <span className="font-medium">{crop.farm}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Planted</span>
                        <span>{crop.plantingDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expected Yield</span>
                        <span className="font-medium">{crop.expectedYield}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Health</span>
                        <span className="font-medium">{crop.health}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${crop.health}%`,
                            background: crop.health >= 90 ? "linear-gradient(90deg, #22c55e, #16a34a)" : crop.health >= 70 ? "linear-gradient(90deg, #f59e0b, #d97706)" : "linear-gradient(90deg, #ef4444, #dc2626)",
                          }}
                        />
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
