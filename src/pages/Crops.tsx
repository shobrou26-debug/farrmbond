import { useMemo, useState } from "react";
import { motion } from "framer-motion";
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
  Leaf,
  Plus,
  Search,
  TrendingUp,
  CheckCircle2,
  Sprout,
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
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

export default function Crops() {
  const navigate = useNavigate();
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
  const avgHealth =
    crops.length > 0
      ? Math.round(crops.reduce((sum, c) => sum + (c.healthScore || 0), 0) / crops.length)
      : 0;

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

  const totalCost = (crop: Crop) =>
    (crop.seedCost || 0) + (crop.fertilizerCost || 0) + (crop.laborCost || 0) + (crop.otherCosts || 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Crop Management</h1>
              <p className="text-muted-foreground mt-1">Track and manage all your crops across farms</p>
            </div>
            <Button className="gradient-primary" onClick={openAdd}>
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
                <p className="text-2xl font-bold">{avgHealth}%</p>
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
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 bg-muted/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredCrops.length === 0 ? (
          <div className="text-center py-16">
            <Leaf className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">{searchQuery ? "No crops match your search" : "No crops yet"}</h3>
            <p className="text-muted-foreground mt-1">
              {searchQuery ? "Try a different search term" : "Add your first crop to start tracking"}
            </p>
            {!searchQuery && (
              <Button className="mt-4 gradient-primary" onClick={openAdd}>
                <Plus className="w-4 h-4 mr-2" />
                Add Crop
              </Button>
            )}
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCrops.map((crop) => {
              const status = statusConfig[crop.status] || statusConfig.growing;
              const farmName = farmMap.get(crop.farmId)?.name || "Unknown Farm";
              const cost = totalCost(crop);
              return (
                <motion.div key={crop._id} variants={itemVariants}>
                  <Card className="border-border/50 card-hover">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/10">
                            <Leaf className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{crop.name}</h3>
                            <p className="text-xs text-muted-foreground">{crop.variety || crop.type}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailCrop(crop)}>
                              <Eye className="w-4 h-4 mr-2" />View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditCrop(crop)}>
                              <Edit className="w-4 h-4 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate("/disease-detection")}>
                              <Camera className="w-4 h-4 mr-2" />Disease Check
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(crop)}>
                              <Trash2 className="w-4 h-4 mr-2" />Delete
                            </DropdownMenuItem>
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
                          <span className="font-medium">{farmName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Planted</span>
                          <span>{new Date(crop.plantingDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Quantity</span>
                          <span className="font-medium">{crop.quantity} {crop.unit}</span>
                        </div>
                        {cost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Cost</span>
                            <span className="font-medium">{format(cost)}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Health</span>
                          <span className="font-medium">{crop.healthScore || 0}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${crop.healthScore || 0}%`,
                              background: (crop.healthScore || 0) >= 90 ? "linear-gradient(90deg, #22c55e, #16a34a)" : (crop.healthScore || 0) >= 70 ? "linear-gradient(90deg, #f59e0b, #d97706)" : "linear-gradient(90deg, #ef4444, #dc2626)",
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
        )}

        {/* Infinite scroll sentinel */}
        {canLoadMore && (
          <div ref={sentinelRef} className="h-10 flex items-center justify-center">
            <Button variant="ghost" size="sm" onClick={loadMore}>Load more</Button>
          </div>
        )}

        {/* Add Crop Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Crop</DialogTitle>
              <DialogDescription>Record a new crop for one of your farms.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button className="gradient-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Add Crop"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Status Dialog */}
        <Dialog open={!!editCrop} onOpenChange={(o) => !o && setEditCrop(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update {editCrop?.name}</DialogTitle>
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

        {/* Detail Dialog */}
        <Dialog open={!!detailCrop} onOpenChange={(o) => !o && setDetailCrop(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{detailCrop?.name}</DialogTitle>
              <DialogDescription>{detailCrop?.variety || detailCrop?.type}</DialogDescription>
            </DialogHeader>
            {detailCrop && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Farm</span><span className="font-medium">{farmMap.get(detailCrop.farmId)?.name || "Unknown"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{statusConfig[detailCrop.status]?.label || detailCrop.status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Health</span><span className="font-medium">{detailCrop.healthScore || 0}%</span></div>
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
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailCrop(null)}>Close</Button>
              {detailCrop && (
                <Button className="gradient-primary" onClick={() => navigate("/disease-detection")}>
                  <Camera className="w-4 h-4 mr-2" />Disease Check
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
