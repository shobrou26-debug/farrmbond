import { useState, useEffect, useCallback } from "react";
import { useQuery, useAction } from "convex/react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  Leaf,
  RefreshCw,
  Satellite,
  AlertTriangle,
  MapPin,
  Calendar,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ============================================================
// Types
// ============================================================

export interface SatelliteViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: Id<"farms">;
  farmName: string;
  latitude: number;
  longitude: number;
}

// ============================================================
// NDVI Color Mapping (static reference data — used to interpret
// REAL backend NDVI values, never to invent data)
// ============================================================

function getNDVIClass(value: number): { color: string; label: string; description: string } {
  if (value < 0.1)
    return { color: "#8B4513", label: "Bare Soil", description: "No vegetation detected" };
  if (value < 0.2)
    return { color: "#D2B48C", label: "Sparse", description: "Very sparse vegetation" };
  if (value < 0.3)
    return { color: "#F4A460", label: "Low", description: "Low vegetation cover" };
  if (value < 0.4)
    return { color: "#FFD700", label: "Moderate", description: "Moderate vegetation" };
  if (value < 0.5)
    return { color: "#ADFF2F", label: "Good", description: "Good vegetation health" };
  if (value < 0.6)
    return { color: "#7CFC00", label: "Very Good", description: "Very good vegetation" };
  if (value < 0.7)
    return { color: "#32CD32", label: "Excellent", description: "Excellent vegetation" };
  if (value < 0.8)
    return { color: "#228B22", label: "Dense", description: "Dense vegetation cover" };
  return { color: "#006400", label: "Very Dense", description: "Very dense vegetation" };
}

// ============================================================
// NDVI Color Legend
// ============================================================

function NDVILegend() {
  const ranges = [
    { min: 0, max: 0.1, color: "#8B4513", label: "Bare Soil" },
    { min: 0.1, max: 0.2, color: "#D2B48C", label: "Sparse" },
    { min: 0.2, max: 0.3, color: "#F4A460", label: "Low" },
    { min: 0.3, max: 0.4, color: "#FFD700", label: "Moderate" },
    { min: 0.4, max: 0.5, color: "#ADFF2F", label: "Good" },
    { min: 0.5, max: 0.6, color: "#7CFC00", label: "Very Good" },
    { min: 0.6, max: 0.7, color: "#32CD32", label: "Excellent" },
    { min: 0.7, max: 0.8, color: "#228B22", label: "Dense" },
    { min: 0.8, max: 1.0, color: "#006400", label: "Very Dense" },
  ];

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {ranges.map((r, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: r.color }} />
          <span className="text-[10px] text-muted-foreground">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// NDVI Trend Chart (renders REAL backend history only)
// ============================================================

function NDVITrendChart({ data }: { data: Array<{ label: string; ndvi: number }> }) {
  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-500" />
          NDVI History
        </h4>
        <p className="text-xs text-muted-foreground">
          No historical satellite readings yet. Analyze the farm to record the first measurement.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.ndvi), 0.1);
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Leaf className="w-4 h-4 text-green-500" />
        NDVI History (from satellite records)
      </h4>
      <div className="flex items-end gap-2 h-24">
        {data.map((d, i) => {
          const ndviClass = getNDVIClass(d.ndvi);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium">{(d.ndvi * 100).toFixed(0)}%</span>
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${Math.max(6, (d.ndvi / maxVal) * 70)}px`,
                  backgroundColor: ndviClass.color,
                }}
              />
              <span className="text-[10px] text-muted-foreground">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Main Satellite Viewer — real Copernicus/Sentinel-2 data
// ============================================================

export function SatelliteViewer({
  open,
  onOpenChange,
  farmId,
  farmName,
  latitude,
  longitude,
}: SatelliteViewerProps) {
  const navigate = useNavigate();

  // Existing stored analysis (reactive — updates after a fresh scan)
  const analysis = useQuery(api.satellite.getSatelliteAnalysis, open ? { farmId } : "skip");

  // Subscription status — satellite analysis is a Pro feature (server-enforced)
  const subStatus = useQuery(api.subscriptions.getSubscriptionStatus, open ? {} : "skip");
  const isProActive = subStatus?.isActive === true;

  // Manual "scan now" — hits the real Copernicus API server-side
  const analyzeFarmSatellite = useAction(api.satellite.analyzeFarmSatellite);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setScanError(null);
      setScanResult(null);
    }
  }, [open]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const result = (await analyzeFarmSatellite({ farmId })) as
        | { ok: true; ndvi: number; sceneName: string; source: string; sceneDate: string; cloudCover: number | null }
        | { ok: false; reason: string };
      if (result.ok) {
        setScanResult(
          `Scan complete — NDVI ${(result.ndvi * 100).toFixed(0)}% (${result.source})`
        );
      } else {
        setScanError(result.reason);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Satellite analysis failed.");
    } finally {
      setScanning(false);
    }
  }, [analyzeFarmSatellite, farmId]);

  const currentNDVI = analysis?.currentNDVI ?? null;
  const ndviClass = currentNDVI !== null ? getNDVIClass(currentNDVI) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
                <Satellite className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base">Satellite View</DialogTitle>
                <p className="text-xs text-muted-foreground truncate">{farmName}</p>
              </div>
            </div>
            {currentNDVI !== null && ndviClass && (
              <Badge
                className="border shrink-0"
                style={{
                  backgroundColor: ndviClass.color + "22",
                  color: ndviClass.color,
                  borderColor: ndviClass.color + "44",
                }}
              >
                NDVI: {(currentNDVI * 100).toFixed(0)}% — {ndviClass.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Map Area — coordinates + data-driven overlay */}
          <div className="flex-1 relative bg-muted/30 min-h-[280px]">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/10 via-emerald-900/20 to-slate-900/10">
              {/* Grid overlay (visual reference only) */}
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)
                  `,
                  backgroundSize: "24px 24px",
                }}
              />
              {/* NDVI color wash derived from the REAL stored reading */}
              {currentNDVI !== null && ndviClass && (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse at center, ${ndviClass.color}33 0%, transparent 70%)`,
                  }}
                />
              )}
            </div>

            {/* Center marker */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg" />
              <div className="absolute -top-1 -left-1 w-6 h-6 bg-primary/30 rounded-full animate-ping" />
            </div>

            {/* Coordinates */}
            <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
            </div>

            {/* Source label */}
            <div className="absolute top-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded">
              Sentinel-2 (Copernicus)
            </div>
          </div>

          {/* Analysis Panel */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border overflow-y-auto p-4 space-y-4">
            {/* Scan Now — Pro feature */}
            <div className="p-3 rounded-xl border border-border">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Analyze from satellite
              </p>
              {isProActive ? (
                <>
                  <Button
                    onClick={handleScan}
                    disabled={scanning}
                    size="sm"
                    className="w-full"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${scanning ? "animate-spin" : ""}`} />
                    {scanning ? "Contacting Copernicus..." : "Run new analysis"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Fetches the latest cloud-free Sentinel-2 scene for this location from the Copernicus API.
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Satellite NDVI analysis is a <span className="font-medium text-foreground">Pro</span> feature.
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => navigate("/settings?tab=subscription")}
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              )}
              {scanError && (
                <p className="text-[11px] text-amber-600 mt-2 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {scanError}
                </p>
              )}
              {scanResult && (
                <p className="text-[11px] text-green-600 mt-2">{scanResult}</p>
              )}
            </div>

            {analysis === undefined ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : currentNDVI === null ? (
              <div className="text-center py-8">
                <Satellite className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium">No satellite data yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No stored analysis exists for this farm. Run a new analysis to fetch real
                  Sentinel-2 vegetation data.
                </p>
              </div>
            ) : (
              ndviClass && (
                <>
                  {/* Current NDVI */}
                  <div className="p-3 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Current NDVI</span>
                      <span className="text-lg font-bold" style={{ color: ndviClass.color }}>
                        {(currentNDVI * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${currentNDVI * 100}%`, backgroundColor: ndviClass.color }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{ndviClass.description}</p>
                    {analysis?.lastUpdated && (
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Recorded {new Date(analysis.lastUpdated).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Legend */}
                  <div>
                    <p className="text-xs font-medium mb-1.5">NDVI Color Scale</p>
                    <NDVILegend />
                  </div>

                  {/* Trend (real stored history) */}
                  <NDVITrendChart data={analysis?.ndviTrend ?? []} />

                  {/* Stress areas (derived from real readings) */}
                  {analysis?.stressAreas && analysis.stressAreas.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Detected Stress</h4>
                      {analysis.stressAreas.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
