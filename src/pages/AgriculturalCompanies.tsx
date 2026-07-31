import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const categoryColors: Record<string, string> = {
  Seeds: "bg-green-100 text-green-700",
  Fertilizer: "bg-amber-100 text-amber-700",
  Equipment: "bg-blue-100 text-blue-700",
  "Pesticides": "bg-red-100 text-red-700",
  Irrigation: "bg-cyan-100 text-cyan-700",
  Livestock: "bg-orange-100 text-orange-700",
  Insurance: "bg-purple-100 text-purple-700",
  Financing: "bg-emerald-100 text-emerald-700",
};

const mockCompanies = [
  {
    _id: "c1",
    name: "East African Seeds Co.",
    category: "Seeds",
    description: "Leading seed producer in East Africa with certified hybrid seeds for maize, wheat, and vegetables.",
    location: "Nairobi, Kenya",
    phone: "+254 20 123 4567",
    email: "info@easeeds.co.ke",
    website: "https://easeeds.co.ke",
    rating: 4.8,
    reviewCount: 234,
    verified: true,
    products: ["Hybrid Maize Seeds", "Wheat Seeds", "Vegetable Seeds"],
  },
  {
    _id: "c2",
    name: "AgriGrow Fertilizers",
    category: "Fertilizer",
    description: "Premium organic and synthetic fertilizers tailored for African soils.",
    location: "Kampala, Uganda",
    phone: "+256 41 234 5678",
    email: "sales@agrigrow.ug",
    website: "https://agrigrow.ug",
    rating: 4.6,
    reviewCount: 156,
    verified: true,
    products: ["NPK Fertilizers", "Organic Compost", "Soil Amendments"],
  },
  {
    _id: "c3",
    name: "FarmTech Equipment",
    category: "Equipment",
    description: "Affordable farming equipment including tractors, ploughs, and harvesting machines.",
    location: "Dar es Salaam, Tanzania",
    phone: "+255 22 345 6789",
    email: "info@farmtech.co.tz",
    website: "https://farmtech.co.tz",
    rating: 4.7,
    reviewCount: 89,
    verified: true,
    products: ["Mini Tractors", "Ploughs", "Threshers"],
  },
  {
    _id: "c4",
    name: "GreenShield Pesticides",
    category: "Pesticides",
    description: "Eco-friendly pest control solutions safe for crops and the environment.",
    location: "Lagos, Nigeria",
    phone: "+234 1 456 7890",
    email: "contact@greenshield.ng",
    website: "https://greenshield.ng",
    rating: 4.5,
    reviewCount: 112,
    verified: true,
    products: ["Organic Pesticides", "Herbicides", "Fungicides"],
  },
  {
    _id: "c5",
    name: "AquaFlow Irrigation",
    category: "Irrigation",
    description: "Complete drip and sprinkler irrigation systems for all farm sizes.",
    location: "Addis Ababa, Ethiopia",
    phone: "+251 11 234 5678",
    email: "info@aquaflow.et",
    website: "https://aquaflow.et",
    rating: 4.8,
    reviewCount: 67,
    verified: true,
    products: ["Drip Irrigation Kits", "Sprinkler Systems", "Water Pumps"],
  },
  {
    _id: "c6",
    name: "Livestock Plus",
    category: "Livestock",
    description: "Premium animal feeds, supplements, and veterinary supplies.",
    location: "Nairobi, Kenya",
    phone: "+254 20 567 8901",
    email: "orders@livestockplus.co.ke",
    website: "https://livestockplus.co.ke",
    rating: 4.7,
    reviewCount: 198,
    verified: true,
    products: ["Dairy Feed", "Poultry Feed", "Mineral Supplements"],
  },
];

export default function AgriculturalCompanies() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filtered = mockCompanies.filter((c) => {
    const matchesSearch =
      searchQuery === "" ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || c.category === selectedCategory;
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
              <h1 className="text-3xl font-bold tracking-tight">Agricultural Companies</h1>
              <p className="text-muted-foreground mt-1">
                Browse trusted suppliers of seeds, fertilizers, equipment, and services
              </p>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              <Sprout className="w-4 h-4 mr-1 text-green-500" />
              {mockCompanies.length} Verified Companies
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
            {["all", "Seeds", "Fertilizer", "Equipment", "Pesticides", "Irrigation", "Livestock"].map((cat) => (
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

        {/* Company Cards */}
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
                      <Badge className={`${categoryColors[company.category] || "bg-gray-100 text-gray-700"} mt-1`} variant="outline">
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
                  <p className="text-sm text-muted-foreground">{company.description}</p>

                  {/* Products */}
                  <div className="flex flex-wrap gap-2">
                    {company.products.slice(0, 3).map((product) => (
                      <Badge key={product} variant="secondary" className="text-xs">
                        {product}
                      </Badge>
                    ))}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-medium">{company.rating}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">({company.reviewCount} reviews)</span>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {company.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {company.phone}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {company.email}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1 gradient-primary">
                      <Truck className="w-4 h-4 mr-2" />
                      Contact Supplier
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href={company.website} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Warehouse className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No companies found</h3>
            <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
