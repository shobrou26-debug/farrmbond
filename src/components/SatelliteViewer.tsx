import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Layers,
  Leaf,
  Thermometer,
  Droplets,
  Sun,
  Maximize2,
  Minimize2,
  RefreshCw,
  Download,
  Calendar,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

export interface SatelliteViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmName: string;
  latitude: number;
  longitude: number;
  ndviScore?: number;
}

interface NDVIData {
  date: string;
  value: number;
  trend: "up" | "down" | "stable";
}

interface AnalysisResult {
  vegetationHealth: string;
  vegetationDensity: string;
  waterStress: string;
  soilMoisture: string;
  recommendations: string[];
}

// ============================================================
// NDVI Color Mapping (Simulated)
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
// Simulated NDVI Analysis
// ============================================================

function generateNDVIHistory(baseNdvi: number): NDVIData[] {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  return months.map((month, i) => {
    const variation = (Math.sin(i * 0.8) * 0.15) + (Math.random() * 0.1 - 0.05);
    const value = Math.max(0.1, Math.min(0.95, baseNdvi / 100 + variation));
    const prevValue = i > 0 ? baseNdvi / 100 + (Math.sin((i - 1) * 0.8) * 0.15) : value;
    return {
      date: `${month} 2026`,
      value: parseFloat(value.toFixed(2)),
      trend: value > prevValue + 0.02 ? "up" : value < prevValue - 0.02 ? "down" : "stable",
    };
  });
}

function analyzeFarm(baseNdvi: number, latitude: number): AnalysisResult {
  const ndvi = baseNdvi / 100;

  const health =
    ndvi > 0.7 ? "Excellent" : ndvi > 0.5 ? "Good" : ndvi > 0.3 ? "Moderate" : "Poor";

  const density =
    ndvi > 0.6 ? "Very High" : ndvi > 0.4 ? "High" : ndvi > 0.25 ? "Moderate" : "Low";

  const waterStress =
    ndvi > 0.6 ? "None detected" : ndvi > 0.4 ? "Minimal" : ndvi > 0.3 ? "Moderate stress" : "High stress";

  const soilMoisture =
    ndvi > 0.6 ? "Adequate" : ndvi > 0.4 ? "Fair" : ndvi > 0.3 ? "Low" : "Critically low";

  const recommendations: string[] = [];
  if (ndvi < 0.4) recommendations.push("Consider increasing irrigation frequency");
  if (ndvi < 0.3) recommendations.push("Apply organic mulch to retain soil moisture");
  if (ndvi > 0.7) recommendations.push("Vegetation is thriving - maintain current practices");
  if (latitude > 0 && latitude < 10) recommendations.push("Monitor for seasonal pest activity in tropical zone");
  if (ndvi >= 0.4 && ndvi <= 0.6) recommendations.push("Apply balanced NPK fertilizer to boost growth");
  recommendations.push("Re-scan in 7-14 days to track changes");

  return { vegetationHealth: health, vegetationDensity: density, waterStress, soilMoisture, recommendations };
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
// NDVI Trend Chart (Simple Bar Chart)
// ============================================================

function NDVITrendChart({ data }: { data: NDVIData[] }) {
  const maxVal = Math.max(...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Leaf className="w-4 h-4 text-green-500" />
        NDVI Trend (Last 7 Months)
      </h4>
      <div className="flex items-end gap-2 h-24">
        {data.map((d, i) => {
          const ndviClass = getNDVIClass(d.value);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium">{(d.value * 100).toFixed(0)}%</span>
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${(d.value / maxVal) * 70}px`,
                  backgroundColor: ndviClass.color,
                }}
              />
              <span className="text-[10px] text-muted-foreground">{d.date.split(" ")[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Main Satellite Viewer Component
// ============================================================

export function SatelliteViewer({
  open,
  onOpenChange,
  farmName,
  latitude,
  longitude,
  ndviScore = 65,
}: SatelliteViewerProps) {
  const [layer, setLayer] = useState<"satellite" | "ndvi" | "terrain">("satellite");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ndviData, setNdviData] = useState<NDVIData[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [currentNdvi, setCurrentNdvi] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      // Simulate loading satellite data
      setTimeout(() => {
        const ndvi = ndviScore / 100;
        setCurrentNdvi(ndvi);
        setNdviData(generateNDVIHistory(ndviScore));
        setAnalysis(analyzeFarm(ndviScore, latitude));
        setIsLoading(false);
      }, 1500);
    }
  }, [open, ndviScore, latitude]);

  const ndviClass = getNDVIClass(currentNdvi);

  // Generate simulated NDVI color overlay for the map
  const ndviOverlayStyle = {
    background: `radial-gradient(ellipse at center, ${ndviClass.color}44 0%, transparent 70%)`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${isFullscreen ? "max-w-[95vw] h-[90vh]" : "max-w-5xl"} p-0 gap-0 overflow-hidden`}
      >
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <Leaf className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base">Satellite View</DialogTitle>
                <p className="text-xs text-muted-foreground">{farmName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border" style={{ backgroundColor: ndviClass.color + "22", color: ndviClass.color, borderColor: ndviClass.color + "44" }}>
                NDVI: {(currentNdvi * 100).toFixed(0)}% — {ndviClass.label}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Map Area */}
          <div className="flex-1 relative bg-muted/30">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Loading satellite imagery...</p>
              </div>
            ) : (
              <>
                {/* Simulated Satellite Map */}
                <div
                  ref={mapRef}
                  className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-emerald-800/30 to-green-700/20"
                >
                  {/* Grid overlay to simulate satellite imagery */}
                  <div className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: `
                        linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                      `,
                      backgroundSize: "20px 20px",
                    }}
                  />

                  {/* Simulated vegetation patterns */}
                  <div className="absolute inset-0">
                    <div className="absolute top-[20%] left-[15%] w-[30%] h-[25%] rounded-2xl opacity-40"
                      style={{ background: ndviClass.color }} />
                    <div className="absolute top-[45%] left-[50%] w-[35%] h-[30%] rounded-3xl opacity-30"
                      style={{ background: ndviClass.color }} />
                    <div className="absolute top-[60%] left-[10%] w-[25%] h-[20%] rounded-xl opacity-35"
                      style={{ background: ndviClass.color }} />
                  </div>

                  {/* NDVI Overlay */}
                  {layer === "ndvi" && (
                    <div className="absolute inset-0" style={ndviOverlayStyle} />
                  )}

                  {/* Center marker */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg" />
                    <div className="absolute -top-1 -left-1 w-6 h-6 bg-primary/30 rounded-full animate-ping" />
                  </div>

                  {/* Coordinates */}
                  <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
                  </div>

                  {/* Satellite info */}
                  <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    Sentinel-2 • 10m Resolution
                  </div>
                </div>

                {/* Layer Controls */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                  {(["satellite", "ndvi", "terrain"] as const).map((l) => (
                    <Button
                      key={l}
                      variant={layer === l ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setLayer(l)}
                      className="text-xs h-7"
                    >
                      {l === "satellite" ? "🛰️" : l === "ndvi" ? "🌿" : "⛰️"} {l.charAt(0).toUpperCase() + l.slice(1)}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Analysis Panel */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border overflow-y-auto p-4 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : analysis ? (
              <>
                {/* Current NDVI */}
                <div className="p-3 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Current NDVI</span>
                    <span className="text-lg font-bold" style={{ color: ndviClass.color }}>
                      {(currentNdvi * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${currentNdvi * 100}%`, backgroundColor: ndviClass.color }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{ndviClass.description}</p>
                </div>

                {/* Legend */}
                <div>
                  <p className="text-xs font-medium mb-1.5">NDVI Color Scale</p>
                  <NDVILegend />
                </div>

                {/* Trend Chart */}
                <NDVITrendChart data={ndviData} />

                {/* Analysis Results */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Analysis Results</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">Vegetation Health</p>
                      <p className="text-xs font-medium">{analysis.vegetationHealth}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">Vegetation Density</p>
                      <p className="text-xs font-medium">{analysis.vegetationDensity}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">Water Stress</p>
                      <p className="text-xs font-medium">{analysis.waterStress}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">Soil Moisture</p>
                      <p className="text-xs font-medium">{analysis.soilMoisture}</p>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Recommendations</h4>
                  <div className="space-y-1.5">
                    {analysis.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Leaf className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download className="w-3 h-3 mr-1" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Calendar className="w-3 h-3 mr-1" />
                    History
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
