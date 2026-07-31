import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Sprout,
  Sun,
  Droplets,
  Clock,
  CheckCircle2,
  Star,
  Leaf,
} from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const cropTypeFilters = [
  "All",
  "Maize",
  "Coffee",
  "Sorghum",
  "Rice",
  "Peas",
  "Avocado",
  "Beans",
  "Cassava",
  "Wheat",
  "Tomato",
  "Tea",
];

export default function SeedShowcase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCropType, setSelectedCropType] = useState("All");

  const seeds = useQuery(api.marketplace.listSeeds, {
    cropType: selectedCropType === "All" ? undefined : selectedCropType,
  });

  const isLoading = seeds === undefined;

  const filtered = (seeds ?? []).filter((s) => {
    if (searchQuery === "") return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.cropType.toLowerCase().includes(q) ||
      s.variety.toLowerCase().includes(q) ||
      s.company.toLowerCase().includes(q)
    );
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
              <h1 className="text-3xl font-bold tracking-tight">
                Seed Showcase
              </h1>
              <p className="text-muted-foreground mt-1">
                Browse certified seeds from trusted suppliers across Africa
              </p>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              <Sprout className="w-4 h-4 mr-1 text-green-500" />
              {isLoading
                ? "Loading..."
                : `${filtered.length} Seed Varieties`}
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
            {cropTypeFilters.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCropType(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedCropType === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-border/50">
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                  <div className="flex gap-2 mt-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Seed Cards */}
        {!isLoading && (
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
                          <Badge
                            className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            variant="outline"
                          >
                            {seed.cropType}
                          </Badge>
                          <Badge variant="secondary">{seed.variety}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {seed.currency} {seed.price.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          per {seed.unit}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {seed.description}
                    </p>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {seed.maturityDays} days
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Sprout className="w-4 h-4" />
                        {seed.yieldPerHectare}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Droplets className="w-4 h-4" />
                        {seed.waterNeeds}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Sun className="w-4 h-4" />
                        {seed.climate?.join(", ") || "Tropical"}
                      </div>
                    </div>

                    {/* Germination & Season */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-muted-foreground">
                          {seed.germinationRate}% germination
                        </span>
                      </div>
                      {seed.season && seed.season.length > 0 && (
                        <div className="text-muted-foreground">
                          🌱 {seed.season.join(", ")}
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {seed.tags && seed.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {seed.tags.slice(0, 4).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Company and Rating */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {seed.company}
                      </span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="font-medium">
                          {seed.rating > 0 ? seed.rating.toFixed(1) : "New"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({seed.reviewCount})
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1 gradient-primary"
                        disabled={!seed.inStock}
                      >
                        <Leaf className="w-4 h-4 mr-2" />
                        {seed.inStock ? "Add to Cart" : "Out of Stock"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Sprout className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No seeds found</h3>
            <p className="text-muted-foreground mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
