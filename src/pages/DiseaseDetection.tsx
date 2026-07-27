import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

interface DetectionHistory {
  id: string;
  imageUrl: string;
  result: DetectionResult;
  timestamp: Date;
}

// ============================================================
// Simulated AI Detection Database
// ============================================================

const diseaseDatabase: DetectionResult[] = [
  {
    id: "1",
    type: "disease",
    name: "Late Blight (Phytophthora infestans)",
    confidence: 94,
    severity: "critical",
    description: "Late blight is a potentially devastating disease affecting tomatoes and potatoes. It spreads rapidly in cool, wet conditions and can destroy entire crops within days.",
    symptoms: [
      "Water-soaked spots on leaves that turn brown/black",
      "White fuzzy growth on leaf undersides in humid conditions",
      "Brown lesions on stems",
      "Firm, brown spots on fruits",
      "Rapid plant collapse in severe cases",
    ],
    causes: [
      "Fungal pathogen Phytophthora infestans",
      "Cool temperatures (15-25°C) with high humidity",
      "Extended leaf wetness periods",
      "Wind-driven rain spreading spores",
    ],
    recommendations: [
      "Remove and destroy infected plant material immediately",
      "Apply fungicide treatment within 24 hours",
      "Improve air circulation between plants",
      "Avoid overhead irrigation",
      "Monitor adjacent plants closely",
    ],
    treatments: {
      organic: [
        "Apply copper-based fungicide (Bordeaux mixture)",
        "Use Bacillus subtilis-based biofungicide",
        "Apply neem oil spray as preventive",
        "Remove infected leaves and mulch around base",
      ],
      chemical: [
        "Chlorothalonil (Daconil) - apply every 7-10 days",
        "Mancozeb (Dithane) - preventative application",
        "Metalaxyl (Ridomil) - systemic treatment",
        "Azoxystrobin (Quadris) - curative application",
      ],
      prevention: [
        "Plant resistant varieties (e.g., Defiant, Mountain Magic)",
        "Ensure proper plant spacing (60cm+)",
        "Water at base of plants, avoid wetting foliage",
        "Rotate crops on 3-year cycle",
        "Remove crop debris after harvest",
      ],
    },
    affectedCrops: ["Tomatoes", "Potatoes", "Peppers"],
    imageUrl: "",
    detectedAt: new Date(),
  },
  {
    id: "2",
    type: "pest",
    name: "Fall Armyworm (Spodoptera frugiperda)",
    confidence: 89,
    severity: "high",
    description: "Fall armyworm is a major pest of maize and other cereals. Larvae feed on leaves, creating characteristic window-pane damage, and can bore into the whorl.",
    symptoms: [
      "Window-pane feeding on young leaves",
      "Large, irregular holes in leaves",
      "Frass (sawdust-like excrement) in the whorl",
      "Damaged or cut maize cobs",
      "Spiral pattern of feeding on leaf surface",
    ],
    causes: [
      "Adult moth migration (can travel 100+ km)",
      "Warm temperatures favor rapid reproduction",
      "Continuous cropping of host plants",
      "Lack of natural predators",
    ],
    recommendations: [
      "Scout fields early morning or late evening",
      "Apply targeted insecticide to whorl if infestation >50%",
      "Use pheromone traps for monitoring",
      "Introduce biological control agents",
      "Practice push-pull technology with Desmodium/Napier grass",
    ],
    treatments: {
      organic: [
        "Apply Bacillus thuringiensis (Bt) spray",
        "Use neem oil extract (Azadirachtin)",
        "Introduce Trichogramma egg parasitoids",
        "Apply spinosad-based organic insecticide",
      ],
      chemical: [
        "Chlorantraniliprole (Prevathon) - low toxicity",
        "Emamectin benzoate - systemic treatment",
        "Lambda-cyhalothrin - contact insecticide",
        "Carbofuran granules in whorl (controlled use)",
      ],
      prevention: [
        "Plant early to avoid peak moth migration",
        "Use push-pull intercropping system",
        "Maintain field hygiene (remove crop residues)",
        "Rotate with non-host crops (legumes)",
        "Conserve natural predators (birds, parasitoids)",
      ],
    },
    affectedCrops: ["Maize", "Sorghum", "Millet", "Rice"],
    imageUrl: "",
    detectedAt: new Date(),
  },
  {
    id: "3",
    type: "disease",
    name: "Powdery Mildew (Erysiphe cichoracearum)",
    confidence: 91,
    severity: "medium",
    description: "Powdery mildew is a common fungal disease that appears as white powdery spots on leaves and stems. It thrives in warm, dry conditions with high humidity.",
    symptoms: [
      "White powdery spots on upper leaf surfaces",
      "Yellowing and curling of affected leaves",
      "Stunted growth in severe cases",
      "Premature leaf drop",
      "Reduced fruit quality and yield",
    ],
    causes: [
      "Fungal pathogen Erysiphe cichoracearum",
      "Warm days (21-27°C) with cool nights",
      "High humidity but dry leaf surfaces",
      "Dense plant canopy reducing airflow",
    ],
    recommendations: [
      "Apply fungicide at first sign of infection",
      "Improve air circulation through pruning",
      "Remove severely infected leaves",
      "Monitor weather conditions for disease-favorable periods",
    ],
    treatments: {
      organic: [
        "Apply sulfur-based fungicide",
        "Use potassium bicarbonate spray",
        "Apply milk spray (40% milk, 60% water)",
        "Neem oil application every 7-14 days",
      ],
      chemical: [
        "Myclobutanil (Systhene) - systemic fungicide",
        "Propiconazole (Banner) - preventative",
        "Triadimefon (Bayleton) - curative treatment",
        "Tebuconazole (Folicur) - broad spectrum",
      ],
      prevention: [
        "Choose resistant varieties",
        "Ensure proper plant spacing",
        "Avoid overhead irrigation",
        "Prune to improve airflow",
        "Monitor regularly for early detection",
      ],
    },
    affectedCrops: ["Cucumbers", "Squash", "Melons", "Grapes"],
    imageUrl: "",
    detectedAt: new Date(),
  },
  {
    id: "4",
    type: "pest",
    name: "Aphids (Aphis gossypii)",
    confidence: 96,
    severity: "medium",
    description: "Aphids are small sap-sucking insects that cause leaf curling, stunted growth, and can transmit plant viruses. They reproduce rapidly in favorable conditions.",
    symptoms: [
      "Curled or distorted new growth",
      "Sticky honeydew on leaves and stems",
      "Black sooty mold on honeydew",
      "Clusters of small insects on leaf undersides",
      "Yellowing of affected leaves",
    ],
    causes: [
      "Rapid reproduction (10-12 generations per year)",
      "Warm temperatures favor population growth",
      "Lack of natural predators",
      "Excessive nitrogen fertilization",
    ],
    recommendations: [
      "Scout plants regularly, especially new growth",
      "Release beneficial insects (ladybugs, lacewings)",
      "Apply soap spray for light infestations",
      "Remove heavily infested plant parts",
    ],
    treatments: {
      organic: [
        "Strong water spray to dislodge aphids",
        "Insecticidal soap spray (2.5 tbsp per liter)",
        "Release ladybugs (1500 per 100 sq ft)",
        "Apply neem oil extract every 7 days",
      ],
      chemical: [
        "Imidacloprid (Admire) - systemic treatment",
        "Pirimicarb (Pirimor) - selective aphicide",
        "Thiamethoxam (Actara) - soil drench",
        "Malathion - contact insecticide",
      ],
      prevention: [
        "Encourage beneficial insects with flowering plants",
        "Avoid over-fertilizing with nitrogen",
        "Remove weeds that harbor aphids",
        "Use reflective mulch to deter winged aphids",
        "Inspect new transplants before planting",
      ],
    },
    affectedCrops: ["Cotton", "Vegetables", "Fruits", "Ornamentals"],
    imageUrl: "",
    detectedAt: new Date(),
  },
];

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
          const preview = URL.createObjectURL(file);
          onUpload(file, preview);
        }
      }
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const preview = URL.createObjectURL(file);
        onUpload(file, preview);
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
              <p className="text-white font-medium">Analyzing image...</p>
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
          {/* Header */}
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

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {result.description}
          </p>

          {/* Affected Crops */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-muted-foreground">Affected crops:</span>
            {result.affectedCrops.map((crop) => (
              <Badge key={crop} variant="outline" className="text-xs">
                {crop}
              </Badge>
            ))}
          </div>

          {/* Symptoms */}
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

          {/* Expand/Collapse */}
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4"
            >
              {/* Causes */}
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

              {/* Treatments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {/* Prevention */}
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
            </motion.div>
          )}

          {/* Actions */}
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-1" />
                Share
              </Button>
            </div>
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
  history: DetectionHistory[];
  onSelect: (item: DetectionHistory) => void;
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
                  {item.result.name}
                </p>
                <div className="flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.result.severity === "critical"
                        ? "bg-red-500"
                        : item.result.severity === "high"
                        ? "bg-orange-500"
                        : item.result.severity === "medium"
                        ? "bg-amber-500"
                        : "bg-green-500"
                    }`}
                  />
                  <span className="text-[10px] text-white/70">
                    {item.result.confidence}% •{" "}
                    {item.timestamp.toLocaleDateString()}
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
      icon: Zap,
      title: "AI Analysis",
      description: "Our AI analyzes the image against a database of 500+ plant diseases and pests to identify the issue.",
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
  const [history, setHistory] = useState<DetectionHistory[]>([]);

  const handleUpload = useCallback((file: File, preview: string) => {
    setImageUrl(preview);
    setResult(null);
    setIsAnalyzing(true);

    // Simulate AI analysis with delay
    setTimeout(() => {
      const randomResult =
        diseaseDatabase[Math.floor(Math.random() * diseaseDatabase.length)];
      const finalResult: DetectionResult = {
        ...randomResult,
        imageUrl: preview,
        detectedAt: new Date(),
      };

      setResult(finalResult);
      setIsAnalyzing(false);

      // Add to history
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          imageUrl: preview,
          result: finalResult,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    }, 2500);
  }, []);

  const handleRemove = useCallback(() => {
    setImageUrl(null);
    setResult(null);
  }, []);

  const handleSelectHistory = useCallback((item: DetectionHistory) => {
    setImageUrl(item.imageUrl);
    setResult(item.result);
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
          {/* How It Works */}
          <motion.div variants={itemVariants}>
            <HowItWorks />
          </motion.div>

          {/* Upload / Preview Area */}
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
