import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  Search,
  Star,
  Calendar,
  MessageCircle,
  Video,
  MapPin,
  Award,
  Clock,
  Filter,
  ArrowRight,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const mockAgronomists = [
  {
    id: "1",
    name: "Dr. James Ochieng",
    title: "Crop Disease Specialist",
    specializations: ["Disease Management", "Soil Health", "Organic Farming"],
    rating: 4.9,
    reviews: 127,
    consultations: 342,
    experience: 12,
    hourlyRate: 50,
    currency: "USD",
    location: "Nairobi, Kenya",
    available: true,
    avatar: "",
  },
  {
    id: "2",
    name: "Prof. Sarah Wanjiku",
    title: "Livestock Nutrition Expert",
    specializations: ["Animal Nutrition", "Dairy Management", "Breeding"],
    rating: 4.8,
    reviews: 98,
    consultations: 256,
    experience: 15,
    hourlyRate: 65,
    currency: "USD",
    location: "Kisumu, Kenya",
    available: true,
    avatar: "",
  },
  {
    id: "3",
    name: "Eng. Peter Kamau",
    title: "Irrigation Systems Engineer",
    specializations: ["Drip Irrigation", "Water Management", "Smart Farming"],
    rating: 4.7,
    reviews: 76,
    consultations: 189,
    experience: 10,
    hourlyRate: 45,
    currency: "USD",
    location: "Nakuru, Kenya",
    available: false,
    avatar: "",
  },
  {
    id: "4",
    name: "Dr. Mary Akinyi",
    title: "Soil Science Specialist",
    specializations: ["Soil Analysis", "Fertilizer Management", "Sustainability"],
    rating: 4.9,
    reviews: 143,
    consultations: 398,
    experience: 18,
    hourlyRate: 55,
    currency: "USD",
    location: "Mombasa, Kenya",
    available: true,
    avatar: "",
  },
];

export default function AgronomistMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = mockAgronomists.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.specializations.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Agronomist Marketplace</h1>
          <p className="text-muted-foreground mt-1">Connect with expert agricultural consultants</p>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {/* Search */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name or specialization..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Button variant="outline"><Filter className="w-4 h-4 mr-2" />Filters</Button>
          </motion.div>

          {/* Featured Agronomist */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50 gradient-nature text-white overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-6">
                  <Avatar className="w-20 h-20 border-2 border-white/30">
                    <AvatarFallback className="bg-white/20 text-white text-2xl">SA</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Badge className="bg-white/20 text-white mb-2">Featured Expert</Badge>
                    <h2 className="text-2xl font-bold mb-1">Dr. Mary Akinyi</h2>
                    <p className="text-white/80 mb-3">Soil Science Specialist • 18 years experience</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {["Soil Analysis", "Fertilizer Management", "Sustainability"].map((spec) => (
                        <Badge key={spec} variant="secondary" className="bg-white/20 text-white border-0">{spec}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-1"><Star className="w-4 h-4 fill-yellow-300 text-yellow-300" /><span className="font-bold">4.9</span><span className="text-white/70">(143 reviews)</span></div>
                      <span className="text-white/50">•</span>
                      <span className="text-white/80">398 consultations</span>
                    </div>
                    <Button className="bg-white text-primary hover:bg-white/90">Book Consultation</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Agronomist Grid */}
          <motion.div variants={itemVariants}>
            <h2 className="text-lg font-semibold mb-4">Available Experts</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((agronomist) => (
              <motion.div key={agronomist.id} variants={itemVariants}>
                <Card className="border-border/50 card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar className="w-14 h-14">
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">{agronomist.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{agronomist.name}</h3>
                          {agronomist.available && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Available</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{agronomist.title}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{agronomist.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {agronomist.specializations.map((spec) => (
                        <Badge key={spec} variant="secondary" className="text-xs">{spec}</Badge>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                      <div className="p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-center gap-1"><Star className="w-3 h-3 text-amber-500" /><span className="text-sm font-bold">{agronomist.rating}</span></div>
                        <p className="text-[10px] text-muted-foreground">{agronomist.reviews} reviews</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-sm font-bold">{agronomist.consultations}</p>
                        <p className="text-[10px] text-muted-foreground">Consultations</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30">
                        <p className="text-sm font-bold">{agronomist.experience}yr</p>
                        <p className="text-[10px] text-muted-foreground">Experience</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      <div>
                        <p className="text-lg font-bold">${agronomist.hourlyRate}<span className="text-xs font-normal text-muted-foreground">/hour</span></p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm"><MessageCircle className="w-4 h-4" /></Button>
                        <Button variant="outline" size="sm"><Video className="w-4 h-4" /></Button>
                        <Button size="sm" className="gradient-primary">
                          <Calendar className="w-4 h-4 mr-1" />Book
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
