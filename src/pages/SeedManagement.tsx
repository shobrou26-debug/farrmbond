import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Sprout, Building2, Users, Plus, Pencil, Trash2,
  X, Star, MapPin, Phone, Mail, Globe, CheckCircle2,
  AlertTriangle, RefreshCw, Save,
} from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ============================================================
// Seed Management Tab
// ============================================================
function SeedsTab() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", cropType: "", variety: "", description: "", company: "",
    price: 0, currency: "KES", unit: "kg", germinationRate: 90,
    maturityDays: 90, yieldPerHectare: "", waterNeeds: "Medium",
    climate: "" as string, season: "" as string, tags: "" as string,
  });

  const seeds = useQuery(api.marketplace.listSeeds, {});
  const createSeed = useMutation(api.marketplace.createSeed);
  const updateSeed = useMutation(api.marketplace.updateSeed);
  const deleteSeed = useMutation(api.marketplace.deleteSeed);

  const filtered = (seeds ?? []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.cropType.toLowerCase().includes(q) || s.company.toLowerCase().includes(q);
  });

  const resetForm = () => {
    setForm({ name: "", cropType: "", variety: "", description: "", company: "",
      price: 0, currency: "KES", unit: "kg", germinationRate: 90,
      maturityDays: 90, yieldPerHectare: "", waterNeeds: "Medium",
      climate: "", season: "", tags: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (seed: any) => {
    setForm({
      name: seed.name, cropType: seed.cropType, variety: seed.variety,
      description: seed.description, company: seed.company,
      price: seed.price, currency: seed.currency, unit: seed.unit,
      germinationRate: seed.germinationRate, maturityDays: seed.maturityDays,
      yieldPerHectare: seed.yieldPerHectare, waterNeeds: seed.waterNeeds,
      climate: seed.climate?.join(", ") || "", season: seed.season?.join(", ") || "",
      tags: seed.tags?.join(", ") || "",
    });
    setEditingId(seed._id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const data = {
      name: form.name, cropType: form.cropType, variety: form.variety,
      description: form.description, company: form.company,
      price: form.price, currency: form.currency, unit: form.unit,
      germinationRate: form.germinationRate, maturityDays: form.maturityDays,
      yieldPerHectare: form.yieldPerHectare, waterNeeds: form.waterNeeds,
      climate: form.climate.split(",").map((s) => s.trim()).filter(Boolean),
      season: form.season.split(",").map((s) => s.trim()).filter(Boolean),
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
    };
    if (editingId) {
      await updateSeed({ seedId: editingId as any, ...data });
    } else {
      await createSeed(data);
    }
    resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search seeds..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gradient-primary">
          <Plus className="w-4 h-4 mr-2" /> {showForm ? "Close" : "Add Seed"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-base">{editingId ? "Edit Seed" : "Add New Seed"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                ["Name", "name"], ["Crop Type", "cropType"], ["Variety", "variety"],
                ["Company", "company"], ["Price", "price", "number"], ["Unit", "unit"],
                ["Germination %", "germinationRate", "number"], ["Maturity Days", "maturityDays", "number"],
                ["Yield/Hectare", "yieldPerHectare"], ["Water Needs", "waterNeeds"],
                ["Climate", "climate"], ["Season", "season"], ["Tags", "tags"],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Input
                    type={type || "text"}
                    value={(form as any)[key!]}
                    onChange={(e) => setForm({ ...form, [key!]: type === "number" ? Number(e.target.value) : e.target.value })}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="gradient-primary"><Save className="w-4 h-4 mr-2" /> {editingId ? "Update" : "Create"}</Button>
              <Button variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-2" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((seed) => (
          <Card key={seed._id} className="border-border/50 hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div><h3 className="font-semibold">{seed.name}</h3><p className="text-xs text-muted-foreground">{seed.cropType} · {seed.variety}</p></div>
                <Badge variant={seed.inStock ? "default" : "destructive"} className="text-xs">{seed.inStock ? "In Stock" : "Out"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{seed.description}</p>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="font-bold text-primary">{seed.currency} {seed.price}</span>
                <div className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-500 fill-amber-500" /><span>{seed.rating > 0 ? seed.rating.toFixed(1) : "New"}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => startEdit(seed)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
                <Button variant="outline" size="sm" onClick={async () => { if (confirm("Delete this seed?")) await deleteSeed({ seedId: seed._id }); }}><Trash2 className="w-3 h-3 text-red-500" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && !seeds && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1,2,3].map((i) => <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-20" /></CardContent></Card>)}</div>}
      {filtered.length === 0 && seeds && seeds.length > 0 && <p className="text-center text-muted-foreground py-8">No seeds match your search.</p>}
      {seeds && seeds.length === 0 && <p className="text-center text-muted-foreground py-8">No seeds yet. Click "Add Seed" to create one.</p>}
    </div>
  );
}

// ============================================================
// Companies Tab
// ============================================================
function CompaniesTab() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "seeds", description: "", location: "", country: "",
    phone: "", email: "", website: "", products: "" as string,
  });

  const companies = useQuery(api.marketplace.listCompanies, {});
  const createCompany = useMutation(api.marketplace.createCompany);
  const updateCompany = useMutation(api.marketplace.updateCompany);
  const deleteCompany = useMutation(api.marketplace.deleteCompany);

  const filtered = (companies ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.country.toLowerCase().includes(q);
  });

  const resetForm = () => {
    setForm({ name: "", category: "seeds", description: "", location: "", country: "", phone: "", email: "", website: "", products: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (company: any) => {
    setForm({ name: company.name, category: company.category, description: company.description,
      location: company.location, country: company.country, phone: company.phone || "",
      email: company.email || "", website: company.website || "", products: company.products?.join(", ") || "" });
    setEditingId(company._id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const data = {
      name: form.name, category: form.category, description: form.description,
      location: form.location, country: form.country, phone: form.phone || undefined,
      email: form.email || undefined, website: form.website || undefined,
      products: form.products.split(",").map((s) => s.trim()).filter(Boolean),
    };
    if (editingId) {
      await updateCompany({ companyId: editingId as any, ...data });
    } else {
      await createCompany(data);
    }
    resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search companies..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gradient-primary">
          <Plus className="w-4 h-4 mr-2" /> {showForm ? "Close" : "Add Company"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-base">{editingId ? "Edit Company" : "Add New Company"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {["Name", "Category", "Location", "Country", "Phone", "Email", "Website"].map((label) => {
                const key = label.toLowerCase();
                return (
                  <div key={key}>
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    <Input value={(form as any)[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1" />
                  </div>
                );
              })}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-xs font-medium text-muted-foreground">Products (comma-separated)</label>
                <Input value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} className="mt-1" placeholder="Tractor, Seeds, Fertilizer" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="gradient-primary"><Save className="w-4 h-4 mr-2" /> {editingId ? "Update" : "Create"}</Button>
              <Button variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-2" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((company) => (
          <Card key={company._id} className="border-border/50 hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div><h3 className="font-semibold">{company.name}</h3><Badge variant="secondary" className="text-xs mt-1">{company.category}</Badge></div>
                {company.verified && <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</Badge>}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{company.description}</p>
              <div className="space-y-1 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {company.location}, {company.country}</div>
                {company.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {company.email}</div>}
              </div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-500 fill-amber-500" /><span className="text-sm">{company.rating > 0 ? company.rating.toFixed(1) : "New"}</span><span className="text-xs text-muted-foreground">({company.reviewCount})</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => startEdit(company)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
                <Button variant="outline" size="sm" onClick={async () => { if (confirm("Delete this company?")) await deleteCompany({ companyId: company._id }); }}><Trash2 className="w-3 h-3 text-red-500" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && companies && companies.length > 0 && <p className="text-center text-muted-foreground py-8">No companies match your search.</p>}
      {companies && companies.length === 0 && <p className="text-center text-muted-foreground py-8">No companies yet. Click "Add Company" to create one.</p>}
    </div>
  );
}

// ============================================================
// Agronomists Tab
// ============================================================
function AgronomistsTab() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", specializations: "", experience: 0,
    availableDays: "", availableHoursStart: "09:00", availableHoursEnd: "17:00", timezone: "Africa/Nairobi",
  });

  const agronomists = useQuery(api.marketplace.listAgronomists, {});
  const updateAgronomist = useMutation(api.marketplace.updateAgronomist);
  const deleteAgronomist = useMutation(api.marketplace.deleteAgronomist);

  const filtered = (agronomists ?? []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.name?.toLowerCase().includes(q) || a.title?.toLowerCase().includes(q) || a.specializations?.some((s) => s.toLowerCase().includes(q));
  });

  const startEdit = (ag: any) => {
    setForm({ title: ag.title || "", specializations: ag.specializations?.join(", ") || "",
      experience: ag.experience || 0, availableDays: ag.availableDays?.join(", ") || "",
      availableHoursStart: ag.availableHours?.start || "09:00", availableHoursEnd: ag.availableHours?.end || "17:00",
      timezone: ag.timezone || "Africa/Nairobi" });
    setEditingId(ag._id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!editingId) return;
    await updateAgronomist({
      profileId: editingId as any,
      title: form.title,
      specializations: form.specializations.split(",").map((s) => s.trim()).filter(Boolean),
      experience: form.experience,
      availableDays: form.availableDays.split(",").map((s) => s.trim()).filter(Boolean),
      availableHours: { start: form.availableHoursStart, end: form.availableHoursEnd },
      timezone: form.timezone,
    });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search agronomists..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {showForm && editingId && (
        <Card className="border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-base">Edit Agronomist</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["Title", "Specializations", "Experience", "Available Days", "Available Hours Start", "Available Hours End", "Timezone"].map((label) => {
                const key = label.toLowerCase().replace(/\s+/g, "");
                const actualKey = key === "availablehoursstart" ? "availableHoursStart" : key === "availablehoursend" ? "availableHoursEnd" : key === "availabledays" ? "availableDays" : key === "specializations" ? "specializations" : key;
                return (
                  <div key={actualKey}>
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    <Input type={key === "experience" ? "number" : "text"} value={(form as any)[actualKey] || ""} onChange={(e) => setForm({ ...form, [actualKey]: key === "experience" ? Number(e.target.value) : e.target.value })} className="mt-1" />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="gradient-primary"><Save className="w-4 h-4 mr-2" /> Update</Button>
              <Button variant="outline" onClick={() => { setEditingId(null); setShowForm(false); }}><X className="w-4 h-4 mr-2" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((ag) => (
          <Card key={ag._id} className="border-border/50 hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div><h3 className="font-semibold">{ag.name}</h3><p className="text-xs text-muted-foreground">{ag.title}</p></div>
                {ag.availableDays && ag.availableDays.length > 0 ? (
                  <Badge className="bg-green-100 text-green-700 text-xs">Available</Badge>
                ) : <Badge variant="secondary" className="text-xs">Unavailable</Badge>}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {ag.specializations?.slice(0, 3).map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span>{ag.experience} yrs exp</span>
                <span>{ag.averageRating > 0 ? ag.averageRating.toFixed(1) : "New"}★</span>
                <span>{ag.totalConsultations} consultations</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => startEdit(ag)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
                <Button variant="outline" size="sm" onClick={async () => { if (confirm("Delete this agronomist?")) await deleteAgronomist({ profileId: ag._id }); }}><Trash2 className="w-3 h-3 text-red-500" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && agronomists && agronomists.length > 0 && <p className="text-center text-muted-foreground py-8">No agronomists match your search.</p>}
      {agronomists && agronomists.length === 0 && <p className="text-center text-muted-foreground py-8">No agronomist profiles found.</p>}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function SeedManagement() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Seed Management</h1>
              <p className="text-muted-foreground mt-1">Manage seeds, agricultural companies, and agronomist profiles</p>
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="seeds" className="space-y-6">
          <TabsList>
            <TabsTrigger value="seeds" className="gap-2"><Sprout className="w-4 h-4" /> Seeds</TabsTrigger>
            <TabsTrigger value="companies" className="gap-2"><Building2 className="w-4 h-4" /> Companies</TabsTrigger>
            <TabsTrigger value="agronomists" className="gap-2"><Users className="w-4 h-4" /> Agronomists</TabsTrigger>
          </TabsList>
          <TabsContent value="seeds"><SeedsTab /></TabsContent>
          <TabsContent value="companies"><CompaniesTab /></TabsContent>
          <TabsContent value="agronomists"><AgronomistsTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
