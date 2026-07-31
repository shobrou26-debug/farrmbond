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
  ExternalLink,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Sprout,
  Truck,
  Warehouse,
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

const categoryColors: Record<string, string> = {
  seeds: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  fertilizer: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  equipment: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pesticides: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  irrigation: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  livestock: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  services: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const categoryFilters = [
  "All",
  "Seeds",
  "Fertilizer",
  "Equipment",
  "Pesticides",
  "Irrigation",
  "Livestock",
];

export default function AgriculturalCompanies() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const companies = useQuery(api.marketplace.listCompanies, {
    category: selectedCategory === "All" ? undefined : selectedCategory.toLowerCase(),
  });

  const isLoading = companies === undefined;

  const filtered = (companies ?? []).filter((c) => {
    if (searchQuery === "") return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.products?.some((p) => p.toLowerCase().includes(q))
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
                Agricultural Companies
              </h1>
              <p className="text-muted-foreground mt-1">
                Browse trusted suppliers of seeds, fertilizers, equipment, and
                services
              </p>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              <Sprout className="w-4 h-4 mr-1 text-green-500" />
              {isLoading
                ? "Loading..."
                : `${filtered.length} Verified Companies`}
            </Badge>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryFilters.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === cat
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
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-24 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Company Cards */}
        {!isLoading && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filtered.map((company) => (
              <motion.div key={company._id} variants={itemVariants}>
                <Card className="border-border/50 hover:shadow-lg transition-all h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{company.name}</h3>
                        <Badge
                          className={`mt-1 ${
                            categoryColors[company.category] ||
                            "bg-gray-100 text-gray-700"
                          }`}
                          variant="outline"
                        >
                          {company.category}
                        </Badge>
                      </div>
                      {company.verified && (
                        <Badge className="bg-green-100 text-green-700 border-green-500/20">
                          <Star className="w-3 h-3 mr-1 fill-green-600" />
                          Verified
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {company.description}
                    </p>

                    {/* Products */}
                    {company.products && company.products.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {company.products.slice(0, 3).map((product) => (
                          <Badge
                            key={product}
                            variant="secondary"
                            className="text-xs"
                          >
                            {product}
                          </Badge>
                        ))}
                        {company.products.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{company.products.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Rating */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium">
                          {company.rating > 0 ? company.rating.toFixed(1) : "New"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        ({company.reviewCount} reviews)
                      </span>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {company.location}, {company.country}
                      </div>
                      {company.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {company.phone}
                        </div>
                      )}
                      {company.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {company.email}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1 gradient-primary">
                        <Truck className="w-4 h-4 mr-2" />
                        Contact Supplier
                      </Button>
                      {company.website && (
                        <Button variant="outline" size="icon" asChild>
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Warehouse className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No companies found</h3>
            <p className="text-muted-foreground mt-1">
              Try adjusting your search or filters
          </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
