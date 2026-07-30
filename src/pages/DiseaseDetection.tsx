import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAction, useMutation } from "convex/react";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Camera,
  Image as ImageIcon,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Bug,
  Leaf,
  Shield,
  Pill,
  ArrowRight,
  History,
  Trash2,
  Download,
  Share2,
  Info,
  Zap,
  TrendingUp,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

// ============================================================
// Types
// ============================================================

interface DetectionResult {
  id: string;
  type: "disease" | "pest";
  name: string;
  confidence: number;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  symptoms: string[];
  causes: string[];
  recommendations: string[];
  treatments: {
    organic: string[];
    chemical: string[];
    prevention: string[];
  };
  affectedCrops: string[];
  imageUrl: string;
  detectedAt: Date;
}

// ============================================================
// Severity Badge Component
// ============================================================

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { color: string; label: string }> = {
    low: { color: "bg-green-500/10 text-green-600 border-green-500/20", label: "Low Risk" },
    medium: { color: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Medium Risk" },
    high: { color: "bg-orange-500/10 text-orange-600 border-orange-500/20", label: "High Risk" },
    critical: { color: "bg-red-500/10 text-red-600 border-red-500/20", label: "Critical" },
  };
  const cfg = config[severity] || config.medium;
  return <Badge className={cfg.color}>{cfg.label}</Badge>;
}

// ============================================================
// Image Upload Component
// ============================================================

function ImageUploader({
  onUpload,
  isAnalyzing,
}: {
  onUpload: (file: File, preview: string) => void;
  isAnalyzing: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith("image/")) {
          // Use data URL instead of blob URL so it persists across page reloads
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            onUpload(file, dataUrl);
          };
          reader.readAsDataURL(file);
        }
      }
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        // Use data URL instead of blob URL so it persists across page reloads
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          onUpload(file, dataUrl);
        };
        reader.readAsDataURL(file);
      }
    },
    [onUpload]
  );

  return (
    <Card className="border-border/50">
      <CardContent className="p-8">
        <form
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isAnalyzing && inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center min-h-[300px] rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          } ${isAnalyzing ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
            disabled={isAnalyzing}
          />
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">Upload Plant Image</p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag and drop an image, or click to browse
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> JPG, PNG, WEBP
              </span>
              <span>Max 10MB</span>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Image Preview with Analysis
// ============================================================

function ImagePreview({
  imageUrl,
  onRemove,
  isAnalyzing,
}: {
  imageUrl: string;
  onRemove: () => void;
  isAnalyzing: boolean;
}) {
  return (
    <Card className="border-border/50 overflow-hidden">
      <div className="relative">
        <img
          src={imageUrl}
          alt="Uploaded plant"
          className="w-full h-64 md:h-80 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 bg-white/90 hover:bg-white"
          onClick={onRemove}
        >
          <X className="w-4 h-4" />
        </Button>
        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
              <p className="text-white font-medium">Analyzing image with AI...</p>
              <p className="text-white/70 text-sm">This may take a few seconds</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Detection Result Card
// ============================================================

function DetectionResultCard({ result }: { result: DetectionResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                  result.type === "disease"
                    ? "bg-red-500/10 text-red-500"
                    : "bg-orange-500/10 text-orange-500"
                }`}
              >
                {result.type === "disease" ? (
                  <Leaf className="w-6 h-6" />
                ) : (
                  <Bug className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold">{result.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="capitalize">
                    {result.type}
                  </Badge>
                  <SeverityBadge severity={result.severity} />
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold">{result.confidence}%</span>
              </div>
              <p className="text-xs text-muted-foreground">Confidence</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {result.description}
          </p>

          {result.affectedCrops.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs text-muted-foreground">Affected crops:</span>
              {result.affectedCrops.map((crop) => (
                <Badge key={crop} variant="outline" className="text-xs">
                  {crop}
                </Badge>
              ))}
            </div>
          )}

          {result.symptoms.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                Symptoms
              </h4>
              <ul className="space-y-1.5">
                {result.symptoms.slice(0, expanded ? undefined : 3).map((symptom, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="w-3 h-3 mt-1 shrink-0 text-primary" />
                    {symptom}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4"
            >
              {result.causes.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Causes</h4>
                  <ul className="space-y-1.5">
                    {result.causes.map((cause, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="w-3 h-3 mt-1 shrink-0 text-amber-500" />
                        {cause}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.treatments.organic.length > 0 && (
                  <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Leaf className="w-4 h-4 text-green-500" />
                      Organic Solutions
                    </h4>
                    <ul className="space-y-1.5">
                      {result.treatments.organic.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.treatments.chemical.length > 0 && (
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-blue-500" />
                      Chemical Treatments
                    </h4>
                    <ul className="space-y-1.5">
                      {result.treatments.chemical.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Zap className="w-3 h-3 mt-0.5 shrink-0 text-blue-500" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {result.treatments.prevention.length > 0 && (
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-500" />
                    Prevention Tips
                  </h4>
                  <ul className="space-y-1.5">
                    {result.treatments.prevention.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-purple-500" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show Less" : "Show Full Analysis"}
              <ChevronRight
                className={`w-4 h-4 ml-1 transition-transform ${
                  expanded ? "rotate-90" : ""
                }`}
              />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================
// Detection History
// ============================================================

function DetectionHistoryList({
  history,
  onSelect,
}: {
  history: DetectionResult[];
  onSelect: (item: DetectionResult) => void;
}) {
  if (history.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" />
            Recent Scans
          </CardTitle>
          <Badge variant="secondary">{history.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {history.slice(0, 4).map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(item)}
              className="relative group cursor-pointer rounded-xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all"
            >
              <img
                src={item.imageUrl}
                alt="Previous scan"
                className="w-full h-24 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs font-medium text-white truncate">
                  {item.name}
                </p>
                <div className="flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.severity === "critical"
                        ? "bg-red-500"
                        : item.severity === "high"
                        ? "bg-orange-500"
                        : item.severity === "medium"
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                  />
                  <span className="text-[10px] text-white/70">
                    {item.confidence}% •{" "}
                    {item.detectedAt.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// How It Works Section
// ============================================================

function HowItWorks() {
  const steps = [
    {
      icon: Camera,
      title: "Capture or Upload",
      description: "Take a photo of your plant or upload an existing image showing signs of disease or pest damage.",
    },
    {
      icon: Sparkles,
      title: "AI Analysis",
      description: "Our AI (Google Gemini Vision) analyzes the image against a database of 500+ plant diseases and pests.",
    },
    {
      icon: Shield,
      title: "Get Solutions",
      description: "Receive detailed treatment recommendations including organic and chemical options tailored to your region.",
    },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">How It Works</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mx-auto mb-3">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="text-sm font-semibold mb-1">{step.title}</h4>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Detection Page
// ============================================================

export default function DiseaseDetection() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Real Convex data
  const detectDisease = useAction(api.aiAssistant.detectDisease);
  const saveDetectionMutation = useMutation(api.detectionResults.saveDetection);
  const { results: detectionHistory, sentinelRef, canLoadMore, isLoadingMore } = usePaginatedQuery(api.detectionResults.listUserDetections);

  const history: DetectionResult[] = detectionHistory.map((d) => ({
    id: d._id,
    type: d.type,
    name: d.name,
    confidence: d.confidence,
    severity: d.severity,
    description: d.description,
    symptoms: [],
    causes: [],
    recommendations: d.recommendations,
    treatments: { organic: [], chemical: [], prevention: [] },
    affectedCrops: [],
    imageUrl: d.imageUrl,
    detectedAt: new Date(d.detectedAt),
  }));

  const handleUpload = useCallback(async (file: File, preview: string) => {
    setImageUrl(preview);
    setResult(null);
    setError(null);
    setIsAnalyzing(true);

    try {
      // Convert file to base64 for the AI API
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data:image/...;base64, prefix
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      const base64Image = await base64Promise;

      // Call real Gemini AI detection
      const aiResult = await detectDisease({
        imageBase64: base64Image,
        mimeType: file.type,
      });

      // Parse the AI response
      const parsed = JSON.parse(aiResult.analysis);

      const detectionResult: DetectionResult = {
        id: Date.now().toString(),
        type: parsed.type || "disease",
        name: parsed.name || "Unknown Issue",
        confidence: parsed.confidence || 75,
        severity: parsed.severity || "medium",
        description: parsed.description || "Analysis completed.",
        symptoms: parsed.symptoms || [],
        causes: parsed.causes || [],
        recommendations: parsed.recommendations || [],
        treatments: {
          organic: parsed.organicTreatments || [],
          chemical: parsed.chemicalTreatments || [],
          prevention: parsed.prevention || [],
        },
        affectedCrops: parsed.affectedCrops || [],
        imageUrl: preview,
        detectedAt: new Date(),
      };

      setResult(detectionResult);

      // Save to Convex
      try {
        await saveDetectionMutation({
          type: detectionResult.type,
          name: detectionResult.name,
          confidence: detectionResult.confidence,
          imageUrl: preview,
          description: detectionResult.description,
          severity: detectionResult.severity,
          recommendations: detectionResult.recommendations,
        });
      } catch (saveError) {
        console.error("Failed to save detection result:", saveError);
      }
    } catch (err) {
      console.error("AI detection error:", err);
      setError(
        "AI analysis failed. Make sure GOOGLE_GEMINI_API_KEY is configured in your environment. " +
        "Get a free key at https://aistudio.google.com/apikey — 1,500 requests/day free."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [detectDisease, saveDetectionMutation]);

  const handleRemove = useCallback(() => {
    setImageUrl(null);
    setResult(null);
    setError(null);
  }, []);

  const handleSelectHistory = useCallback((item: DetectionResult) => {
    setImageUrl(item.imageUrl);
    setResult(item);
  }, []);

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
          <h1 className="text-3xl font-bold tracking-tight">
            Disease & Pest Detection
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload a photo and get instant AI-powered diagnosis and treatment recommendations
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          <motion.div variants={itemVariants}>
            <HowItWorks />
          </motion.div>

          <motion.div variants={itemVariants}>
            {imageUrl ? (
              <ImagePreview
                imageUrl={imageUrl}
                onRemove={handleRemove}
                isAnalyzing={isAnalyzing}
              />
            ) : (
              <ImageUploader onUpload={handleUpload} isAnalyzing={isAnalyzing} />
            )}
          </motion.div>

          {/* Error State */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700">Analysis Error</p>
                      <p className="text-sm text-red-600 mt-1">{error}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Detection Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <DetectionResultCard result={result} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Detection History */}
          <motion.div variants={itemVariants}>
            <DetectionHistoryList
              history={history}
              onSelect={handleSelectHistory}
            />
          </motion.div>

          {/* Tips */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50 bg-muted/30">
              <CardContent className="p-5">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Tips for Best Results
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    "Take clear, well-lit photos of affected plant parts",
                    "Include both healthy and damaged areas for comparison",
                    "Capture close-up shots of symptoms (leaves, stems, fruits)",
                    "Ensure the affected area fills most of the frame",
                    "Avoid blurry or dark images for accurate analysis",
                    "Upload multiple angles if symptoms vary across the plant",
                  ].map((tip, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <CheckCircle2 className="w-3 h-3 mt-1 shrink-0 text-primary" />
                      {tip}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
