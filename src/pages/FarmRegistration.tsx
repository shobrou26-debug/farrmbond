import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGeolocation } from "@/hooks/use-weather";
import {
  MapPin,
  Navigation,
  Loader2,
  Save,
  Sprout,
  AlertTriangle,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

// ============================================================
// Farm Registration / Edit
// Page → api.farms.createFarm / api.farms.updateFarm → server
// auth + ownership → database → reactive UI
// ============================================================

export default function FarmRegistration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editFarmId = searchParams.get("farmId");

  const createFarm = useMutation(api.farms.createFarm);
  const updateFarm = useMutation(api.farms.updateFarm);
  const editingFarm = useQuery(
    api.farms.getFarm,
    editFarmId ? { farmId: editFarmId as Id<"farms"> } : "skip"
  );

  const { latitude, longitude, loading: locating, error: geoError, requestLocation } = useGeolocation();

  const [form, setForm] = useState({
    name: "",
    description: "",
    lat: "",
    lon: "",
    address: "",
    city: "",
    state: "",
    country: "",
    size: "",
    sizeUnit: "hectares" as "hectares" | "acres",
    soilType: "",
    soilPh: "",
    irrigationType: "",
    waterSources: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load the farm when editing
  useEffect(() => {
    if (editingFarm) {
      setForm({
        name: editingFarm.name ?? "",
        description: editingFarm.description ?? "",
        lat: editingFarm.location?.latitude != null ? String(editingFarm.location.latitude) : "",
        lon: editingFarm.location?.longitude != null ? String(editingFarm.location.longitude) : "",
        address: editingFarm.location?.address ?? "",
        city: editingFarm.location?.city ?? "",
        state: editingFarm.location?.state ?? "",
        country: editingFarm.location?.country ?? "",
        size: editingFarm.size != null ? String(editingFarm.size) : "",
        sizeUnit: editingFarm.sizeUnit ?? "hectares",
        soilType: editingFarm.soilType ?? "",
        soilPh: editingFarm.soilPh != null ? String(editingFarm.soilPh) : "",
        irrigationType: editingFarm.irrigationType ?? "",
        waterSources: (editingFarm.waterSources ?? []).join(", "),
      });
    }
  }, [editingFarm]);

  // Prefill coordinates from GPS once located (create mode only)
  useEffect(() => {
    if (latitude !== null && longitude !== null && !editFarmId) {
      setForm((f) => ({
        ...f,
        lat: f.lat || latitude.toFixed(6),
        lon: f.lon || longitude.toFixed(6),
      }));
    }
  }, [latitude, longitude, editFarmId]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    if (!name) return setFormError("Farm name is required.");
    const lat = Number(form.lat);
    const lon = Number(form.lon);
    if (!form.lat || isNaN(lat) || lat < -90 || lat > 90)
      return setFormError("A valid latitude (-90 to 90) is required. Use 'Use my location' or enter it manually.");
    if (!form.lon || isNaN(lon) || lon < -180 || lon > 180)
      return setFormError("A valid longitude (-180 to 180) is required.");
    const size = Number(form.size);
    if (!form.size || isNaN(size) || size <= 0)
      return setFormError("Farm size must be a positive number.");
    const soilPh = form.soilPh === "" ? undefined : Number(form.soilPh);
    if (soilPh !== undefined && (isNaN(soilPh) || soilPh < 0 || soilPh > 14))
      return setFormError("Soil pH must be between 0 and 14.");

    setSubmitting(true);
    try {
      const location = {
        latitude: lat,
        longitude: lon,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country.trim() || undefined,
      };

      if (editFarmId) {
        await updateFarm({
          farmId: editFarmId as Id<"farms">,
          name,
          description: form.description.trim() || undefined,
          latitude: lat,
          longitude: lon,
          address: location.address,
          city: location.city,
          state: location.state,
          country: location.country,
          size,
          sizeUnit: form.sizeUnit,
          soilType: form.soilType.trim() || undefined,
          soilPh,
          irrigationType: form.irrigationType.trim() || undefined,
          waterSources:
            form.waterSources.split(",").map((s) => s.trim()).filter(Boolean) || undefined,
        });
        toast.success("Farm updated");
      } else {
        await createFarm({
          name,
          description: form.description.trim() || undefined,
          latitude: lat,
          longitude: lon,
          address: location.address,
          city: location.city,
          state: location.state,
          country: location.country,
          size,
          sizeUnit: form.sizeUnit,
          soilType: form.soilType.trim() || undefined,
          soilPh,
          irrigationType: form.irrigationType.trim() || undefined,
          waterSources:
            form.waterSources.split(",").map((s) => s.trim()).filter(Boolean) || undefined,
        });
        toast.success("Farm registered");
      }
      navigate("/farms");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save farm.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1000px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {editFarmId ? "Edit Farm" : "Register a Farm"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {editFarmId
              ? "Update this farm's details. Changes are saved to your account."
              : "Add your farm with GPS coordinates so FarmBond can fetch local weather, soil and satellite data."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                Location (GPS)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="farm-lat">Latitude *</Label>
                  <Input
                    id="farm-lat"
                    type="number"
                    step="any"
                    placeholder="-1.2921"
                    value={form.lat}
                    onChange={(e) => set("lat", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farm-lon">Longitude *</Label>
                  <Input
                    id="farm-lon"
                    type="number"
                    step="any"
                    placeholder="36.8219"
                    value={form.lon}
                    onChange={(e) => set("lon", e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => requestLocation()}
                disabled={locating}
              >
                {locating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4 mr-2" />
                )}
                Use my current location
              </Button>
              {geoError && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> {geoError}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="farm-address">Address</Label>
                  <Input id="farm-address" placeholder="Street / landmark" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="farm-city">City</Label>
                    <Input id="farm-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="farm-state">State</Label>
                    <Input id="farm-state" value={form.state} onChange={(e) => set("state", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="farm-country">Country</Label>
                    <Input id="farm-country" value={form.country} onChange={(e) => set("country", e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sprout className="w-4 h-4 text-green-500" />
                Farm Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="farm-name">Farm Name *</Label>
                <Input
                  id="farm-name"
                  placeholder="e.g. Shamba Ya Miti"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="farm-desc">Description</Label>
                <Input
                  id="farm-desc"
                  placeholder="Short description of your farm"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="farm-size">Size *</Label>
                  <Input
                    id="farm-size"
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="2.5"
                    value={form.size}
                    onChange={(e) => set("size", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={form.sizeUnit}
                    onValueChange={(v) => set("sizeUnit", v as "hectares" | "acres")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hectares">Hectares</SelectItem>
                      <SelectItem value="acres">Acres</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farm-soilph">Soil pH (optional)</Label>
                  <Input
                    id="farm-soilph"
                    type="number"
                    step="any"
                    min="0"
                    max="14"
                    placeholder="6.5"
                    value={form.soilPh}
                    onChange={(e) => set("soilPh", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="farm-soiltype">Soil Type</Label>
                  <Select value={form.soilType} onValueChange={(v) => set("soilType", v)}>
                    <SelectTrigger id="farm-soiltype">
                      <SelectValue placeholder="Select soil type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandy">Sandy</SelectItem>
                      <SelectItem value="loamy">Loamy</SelectItem>
                      <SelectItem value="clay">Clay</SelectItem>
                      <SelectItem value="silt">Silt</SelectItem>
                      <SelectItem value="peat">Peat</SelectItem>
                      <SelectItem value="chalky">Chalky</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farm-irrigation">Irrigation Type</Label>
                  <Select value={form.irrigationType} onValueChange={(v) => set("irrigationType", v)}>
                    <SelectTrigger id="farm-irrigation">
                      <SelectValue placeholder="Select irrigation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rainfed">Rainfed</SelectItem>
                      <SelectItem value="drip">Drip</SelectItem>
                      <SelectItem value="sprinkler">Sprinkler</SelectItem>
                      <SelectItem value="flood">Flood / surface</SelectItem>
                      <SelectItem value="pivot">Center pivot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farm-water">Water Sources (comma-separated)</Label>
                  <Input
                    id="farm-water"
                    placeholder="Borehole, River, Rainwater"
                    value={form.waterSources}
                    onChange={(e) => set("waterSources", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {formError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {formError}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting} className="gradient-primary">
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {submitting ? "Saving..." : editFarmId ? "Save Changes" : "Register Farm"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/farms")}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
