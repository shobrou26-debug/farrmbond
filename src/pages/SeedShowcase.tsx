import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Sprout,
  Sun,
  Droplets,
  Thermometer,
  Clock,
  CheckCircle2,
  Star,
  Filter,
  Leaf,
} from "lucide-react";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const mockSeeds = [
  {
    _id: "s1",
    name: "H614 Hybrid Maize",
    category: "Cereals",
    cropType: "Maize",
    maturityDays: 120,
    yieldPotential: "35-40 bags/acre",
    waterNeed: "Medium",
    sunRequirement: "Full Sun",
    pricePerKg: 450,
    currency: "KES",
    climate: "Tropical Highland",
    diseaseResistance: ["Maize Lethal Necrosis", "Rust", "Stalk Borer"],
    description: "High-yielding hybrid maize variety adapted for the Kenyan highlands. Excellent disease resistance and drought tolerance.",
    company: "East African Seeds Co.",
    rating: 4.8,
    inStock: true,
  },
  {
    _id: "s2",
    name: "KAT/B-90 Coffee Variety",
    category: "Cash Crops",
    cropType: "Coffee",
    maturityDays: 365,
    yieldPotential: "2-3 tons/acre",
    waterNeed: "Medium",
    sunRequirement: "Partial Shade",
    pricePerKg: 800,
    currency: "KES",
    climate: "Tropical Highland",
    diseaseResistance: ["Coffee Berry Disease", "Leaf Rust"],
    description: "High-quality Arabica coffee variety with excellent cup quality and disease resistance.",
    company: "Kenya Agricultural Board",
    rating: 4.7,
    inStock: true,
  },
  {
    _id: "s3",
    name: "K84/1 Sorghum",
    category: "Cereals",
    cropType: "Sorghum",
    maturityDays: 100,
    yieldPotential: "12-15 bags/acre",
    waterNeed: "Low",
    sunRequirement: "Full Sun",
    pricePerKg: 300,
    currency: "KES",
    climate: "Semi-Arid",
    diseaseResistance: ["Striga", "Shoot Fly"],
    description: "Drought-tolerant sorghum variety perfect for dryland farming. High nutritional value.",
    company: "KARI Seeds",
    rating: 4.5,
    inStock: true,
  },
  {
    _id: "s4",
    name: "Calrose Rice",
    category: "Cereals",
    cropType: "Rice",
    maturityDays: 130,
    yieldPotential: "30-35 bags/acre",
    waterNeed: "High",
    sunRequirement: "Full Sun",
    pricePerKg: 550,
    currency: "KES",
    climate: "Tropical Lowland",
    diseaseResistance: ["Blast", "Bacterial Leaf Blight"],
    description: "Premium short-grain rice variety suitable for irrigated lowland areas.",
    company: "Mwea Rice Growers",
    rating: 4.6,
    inStock: false,
  },
  {
    _id: "s5",
    name: "Sugar Ann Peas",
    category: "Vegetables",
    cropType: "Peas",
    maturityDays: 60,
    yieldPotential: "4-6 tons/acre",
    waterNeed: "Medium",
    sunRequirement: "Full Sun",
    pricePerKg: 600,
    currency: "KES",
    climate: "Temperate",
    diseaseResistance: ["Powdery Mildew", "Root Rot"],
    description: "Sweet snap pea variety ideal for both fresh market and export. Quick maturing.",
    company: "Valley Seeds Ltd",
    rating: 4.9,
    inStock: true,
  },
  {
    _id: "s6",
    name: "Hass Avocado Grafts",
    category: "Fruits",
    cropType: "Avocado",
    maturityDays: 730,
    yieldPotential: "10-15 tons/acre",
    waterNeed: "Medium",
    sunRequirement: "Full Sun",
    pricePerKg: 350,
    currency: "KES",
    climate: "Tropical Highland",
    diseaseResistance: ["Phytophthora", "Anthracnose"],
    description: "Premium Hass avocado grafted seedlings ready for planting. Export quality fruit.",
    company: "Greenlife Nurseries",
    rating: 4.8,
    inStock: true,
  },
  {
    _id: "s7",
    name: "Nyayo Beans",
    category: "Legumes",
    cropType: "Beans",
    maturityDays: 80,
    yieldPotential: "10-12 bags/acre",
    waterNeed: "Low",
    sunRequirement: "Full Sun",
    pricePerKg: 350,
    currency: "KES",
    climate: "Tropical Highland",
    diseaseResistance: ["Bean Common Mosaic Virus", "Angular Leaf Spot"],
    description: "Popular climbing bean variety with high protein content. Nitrogen-fixing.",
    company: "KALRO Seeds",
    rating: 4.7,
    inStock: true,
  },
  {
    _id: "s8",
    name: "TDH-9512 Cassava",
    category: "Root Crops",
    cropType: "Cassava",
    maturityDays: 300,
    yieldPotential: "15-20 tons/acre",
    waterNeed: "Low",
    sunRequirement: "Full Sun",
    pricePerKg: 200,
    currency: "KES",
    climate: "Tropical",
    diseaseResistance: ["Cassava Mosaic Disease", "Brown Streak"],
    description: "High-yielding cassava variety resistant to CMD and CBSD. Excellent for food security.",
    company: "National Horticultural Research Centre",
    rating: 4.6,
    inStock: true,
  },
];

const categories = ["all", "Cereals", "Cash Crops", "Vegetables", "Fruits", "Legumes", "Root Crops"];

export default function SeedShowcase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filtered = mockSeeds.filter((s) => {
    const matchesSearch =
      searchQuery === "" ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cropType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Seed Showcase</h1>
              <p className="text-muted-foreground mt-1">
                Browse certified seeds from trusted suppliers across Africa
              </p>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              <Sprout className="w-4 h-4 mr-1 text-green-500" />
              {mockSeeds.length} Seed Varieties
            </Badge>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search seeds by name or crop type..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Seed Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {filtered.map((seed) => (
            <motion.div key={seed._id} variants={itemVariants}>
              <Card className="border-border/50 hover:shadow-lg transition-all h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{seed.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-green-100 text-green-700" variant="outline">
                          {seed.category}
                        </Badge>
                        <Badge variant="secondary">{seed.cropType}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        KES {seed.pricePerKg}
                      </p>
                      <p className="text-xs text-muted-foreground">per kg</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{seed.description}</p>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {seed.maturityDays} days
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Sprout className="w-4 h-4" />
                      {seed.yieldPotential}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Droplets className="w-4 h-4" />
                      {seed.waterNeed}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Sun className="w-4 h-4" />
                      {seed.sunRequirement}
                    </div>
                  </div>

                  {/* Disease Resistance */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Disease Resistance:</p>
                    <div className="flex flex-wrap gap-1">
                      {seed.diseaseResistance.map((disease) => (
                        <Badge key={disease} variant="secondary" className="text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
                          {disease}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Company and Rating */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{seed.company}</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="font-medium">{seed.rating}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1 gradient-primary" disabled={!seed.inStock}>
                      <Leaf className="w-4 h-4 mr-2" />
                      {seed.inStock ? "Add to Cart" : "Out of Stock"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Sprout className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No seeds found</h3>
            <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
