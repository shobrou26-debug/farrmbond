import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BookOpen,
  Filter,
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

const expertiseColors: Record<string, string> = {
  "Crop Management": "bg-green-100 text-green-700",
  "Livestock Health": "bg-amber-100 text-amber-700",
  "Soil Science": "bg-amber-100 text-amber-700",
  "Irrigation": "bg-blue-100 text-blue-700",
  "Pest Control": "bg-red-100 text-red-700",
  "Organic Farming": "bg-emerald-100 text-emerald-700",
  "Dairy Farming": "bg-cyan-100 text-cyan-700",
  "Poultry": "bg-orange-100 text-orange-700",
};

const mockAgronomists = [
  {
    _id: "ag1",
    userId: "u1",
    name: "Dr. Sarah Kamau",
    specialization: "Crop Disease Specialist",
    expertise: ["Crop Management", "Pest Control", "Soil Science"],
    rating: 4.9,
    reviewCount: 127,
    consultationFee: 2500,
    location: "Nairobi, Kenya",
    bio: "15+ years experience in crop disease diagnosis and management across East Africa.",
    available: true,
    videoConsultation: true,
    languages: ["English", "Swahili"],
    responseTime: "< 2 hours",
  },
  {
    _id: "ag2",
    userId: "u2",
    name: "Prof. James Ochieng",
    specialization: "Livestock Veterinarian",
    expertise: ["Livestock Health", "Dairy Farming"],
    rating: 4.8,
    reviewCount: 89,
    consultationFee: 3000,
    location: "Kisumu, Kenya",
    bio: "University professor specializing in livestock health and nutrition for smallholder farmers.",
    available: true,
    videoConsultation: true,
    languages: ["English", "Swahili", "Luo"],
    responseTime: "< 4 hours",
  },
  {
    _id: "ag3",
    userId: "u3",
    name: "Grace Wanjiku",
    specialization: "Organic Farming Expert",
    expertise: ["Organic Farming", "Crop Management", "Irrigation"],
    rating: 4.7,
    reviewCount: 64,
    consultationFee: 1500,
    location: "Nyeri, Kenya",
    bio: "Certified organic farming consultant helping farmers transition to sustainable practices.",
    available: false,
    videoConsultation: true,
    languages: ["English", "Swahili"],
    responseTime: "< 24 hours",
  },
  {
    _id: "ag4",
    userId: "u4",
    name: "Dr. Michael Tendai",
    specialization: "Soil & Fertility Expert",
    expertise: ["Soil Science", "Crop Management"],
    rating: 4.9,
    reviewCount: 156,
    consultationFee: 3500,
    location: "Kampala, Uganda",
    bio: "PhD in Soil Science with focus on tropical agriculture and soil health optimization.",
    available: true,
    videoConsultation: true,
    languages: ["English", "Luganda"],
    responseTime: "< 1 hour",
  },
  {
    _id: "ag5",
    userId: "u5",
    name: "Amina Hassan",
    specialization: "Irrigation Specialist",
    expertise: ["Irrigation", "Crop Management"],
    rating: 4.6,
    reviewCount: 42,
    consultationFee: 2000,
    location: "Arusha, Tanzania",
    bio: "Expert in drip irrigation systems and water management for arid and semi-arid regions.",
    available: true,
    videoConsultation: false,
    languages: ["English", "Swahili"],
    responseTime: "< 6 hours",
  },
  {
    _id: "ag6",
    userId: "u6",
    name: "Dr. Peter Mwangi",
    specialization: "Poultry & Piggery Expert",
    expertise: ["Poultry", "Livestock Health"],
    rating: 4.8,
    reviewCount: 78,
    consultationFee: 2000,
    location: "Thika, Kenya",
    bio: "Commercial poultry and pig farming consultant with 20 years of industry experience.",
    available: true,
    videoConsultation: true,
    languages: ["English", "Swahili"],
    responseTime: "< 3 hours",
  },
];

export default function AgronomistMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string>("all");
  const [selectedAgronomist, setSelectedAgronomist] = useState<any>(null);

  const filtered = mockAgronomists.filter((ag) => {
    const matchesSearch =
      searchQuery === "" ||
      ag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ag.specialization.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesExpertise =
      selectedExpertise === "all" ||
      ag.expertise.includes(selectedExpertise);
    return matchesSearch && matchesExpertise;
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
              <h1 className="text-3xl font-bold tracking-tight">Agronomist Marketplace</h1>
              <p className="text-muted-foreground mt-1">
                Connect with certified agricultural experts for professional consultation
              </p>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" />
              {mockAgronomists.filter((a) => a.available).length} Experts Available
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
            {["all", "Crop Management", "Livestock Health", "Soil Science", "Irrigation", "Organic Farming"].map(
              (exp) => (
                <button
                  key={exp}
                  onClick={() => setSelectedExpertise(exp)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedExpertise === exp
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {exp === "all" ? "All" : exp}
                </button>
              )
            )}
          </div>
        </div>

        {/* Agronomist Cards */}
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
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-7 h-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{agronomist.name}</h3>
                      <p className="text-sm text-muted-foreground">{agronomist.specialization}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">{agronomist.rating}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ({agronomist.reviewCount} reviews)
                        </span>
                      </div>
                    </div>
                    {agronomist.available ? (
                      <Badge className="bg-green-100 text-green-700 border-green-500/20">
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Unavailable</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{agronomist.bio}</p>

                  {/* Expertise Tags */}
                  <div className="flex flex-wrap gap-2">
                    {agronomist.expertise.map((exp) => (
                      <Badge
                        key={exp}
                        className={expertiseColors[exp] || "bg-gray-100 text-gray-700"}
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
                      {agronomist.location}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {agronomist.responseTime}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      KES {agronomist.consultationFee.toLocaleString()}/session
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageSquare className="w-4 h-4" />
                      {agronomist.languages.join(", ")}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1 gradient-primary"
                      disabled={!agronomist.available}
                      onClick={() => setSelectedAgronomist(agronomist)}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Consultation
                    </Button>
                    {agronomist.videoConsultation && (
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

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No agronomists found</h3>
            <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
