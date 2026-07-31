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
  Star,
  Calendar,
  MessageSquare,
  Video,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  User,
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

const expertiseColors: Record<string, string> = {
  "Crop Management": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Livestock Health": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Soil Science": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Irrigation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Pest Control": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "Organic Farming": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Dairy Farming": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  Poultry: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

const expertiseFilters = [
  "All",
  "Crop Management",
  "Livestock Health",
  "Soil Science",
  "Irrigation",
  "Organic Farming",
];

export default function AgronomistMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState("All");

  const agronomists = useQuery(api.marketplace.listAgronomists, {
    specialization: selectedExpertise === "All" ? undefined : selectedExpertise,
  });

  const isLoading = agronomists === undefined;

  const filtered = (agronomists ?? []).filter((ag) => {
    if (searchQuery === "") return true;
    const q = searchQuery.toLowerCase();
    return (
      ag.name.toLowerCase().includes(q) ||
      ag.specializations?.some((s) => s.toLowerCase().includes(q))
    );
  });

  /** Helper: check if agronomist is available based on their schedule */
  const isAvailable = (ag: (typeof filtered)[0]) =>
    (ag.availableDays?.length ?? 0) > 0;

  /** Helper: get consultation fee from services array */
  const getFee = (ag: (typeof filtered)[0]) =>
    ag.services?.[0]?.price ?? 0;

  /** Helper: get available hours string */
  const getHours = (ag: (typeof filtered)[0]) =>
    ag.availableHours
      ? `${ag.availableHours.start}–${ag.availableHours.end}`
      : "< 24 hours";

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
                Agronomist Marketplace
              </h1>
              <p className="text-muted-foreground mt-1">
                Connect with certified agricultural experts for professional
                consultation
              </p>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" />
              {isLoading
                ? "Loading..."
                : `${filtered.filter((a) => isAvailable(a)).length} Experts Available`}
            </Badge>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or specialization..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {expertiseFilters.map((exp) => (
              <button
                key={exp}
                onClick={() => setSelectedExpertise(exp)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedExpertise === exp
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {exp}
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
                  <div className="flex items-start gap-4">
                    <Skeleton className="w-14 h-14 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
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

        {/* Agronomist Cards */}
        {!isLoading && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filtered.map((agronomist) => (
              <motion.div key={agronomist._id} variants={itemVariants}>
                <Card className="border-border/50 hover:shadow-lg transition-all h-full">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                        {(agronomist as any).image ? (
                          <img
                            src={(agronomist as any).image}
                            alt={agronomist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-7 h-7 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{agronomist.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {agronomist.specializations?.join(", ") || "Generalist"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span className="text-sm font-medium">
                              {agronomist.averageRating > 0
                                ? agronomist.averageRating.toFixed(1)
                                : "New"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ({agronomist.totalReviews} reviews)
                          </span>
                        </div>
                      </div>
                      {isAvailable(agronomist) ? (
                        <Badge className="bg-green-100 text-green-700 border-green-500/20">
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Unavailable</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {(agronomist as any).bio || "Agricultural expert"}
                    </p>

                    {/* Expertise Tags */}
                    <div className="flex flex-wrap gap-2">
                      {agronomist.specializations?.map((exp) => (
                        <Badge
                          key={exp}
                          className={
                            expertiseColors[exp] || "bg-gray-100 text-gray-700"
                          }
                          variant="outline"
                        >
                          {exp}
                        </Badge>
                      ))}
                    </div>

                    {/* Info Row */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {(agronomist as any).location || "Remote"}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {getHours(agronomist)}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="w-4 h-4" />
                        KES {getFee(agronomist).toLocaleString()}/session
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="w-4 h-4" />
                        {(agronomist as any).languages?.join(", ") || "English"}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1 gradient-primary"
                        disabled={!isAvailable(agronomist)}
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Book Consultation
                      </Button>
                      {agronomist.services?.some((s) => s.type === "video") && (
                        <Button variant="outline" size="icon">
                          <Video className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="icon">
                        <MessageSquare className="w-4 h-4" />
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
            <Search className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No agronomists found</h3>
            <p className="text-muted-foreground mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
