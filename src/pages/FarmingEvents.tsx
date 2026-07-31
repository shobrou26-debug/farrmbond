import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  Calendar,
  MapPin,
  Clock,
  Users,
  Star,
  Filter,
  ExternalLink,
  Tag,
  Megaphone,
  GraduationCap,
  Tractor,
  Sprout,
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

const eventTypeConfig: Record<string, { color: string; icon: React.ComponentType<{className?: string}> }> = {
  training: { color: "bg-blue-100 text-blue-700", icon: GraduationCap },
  expo: { color: "bg-purple-100 text-purple-700", icon: Tractor },
  workshop: { color: "bg-green-100 text-green-700", icon: Sprout },
  sponsored: { color: "bg-amber-100 text-amber-700", icon: Megaphone },
};

const mockEvents = [
  {
    _id: "e1",
    title: "East Africa AgriTech Expo 2026",
    type: "expo",
    description: "Annual agricultural technology exhibition featuring the latest farming innovations, equipment, and digital solutions.",
    location: "Kenyatta International Convention Centre, Nairobi",
    date: "2026-08-15",
    endDate: "2026-08-17",
    time: "09:00 - 17:00",
    organizer: "Kenya Agricultural Society",
    attendees: 2500,
    maxCapacity: 5000,
    ticketPrice: "Free",
    sponsored: false,
    tags: ["AgriTech", "Innovation", "Networking"],
  },
  {
    _id: "e2",
    title: "Organic Farming Certification Workshop",
    type: "training",
    description: "Learn how to get certified as an organic farm. Covers KEPHIS standards and international organic certification requirements.",
    location: "Nairobi Agricultural Centre",
    date: "2026-08-05",
    endDate: "2026-08-05",
    time: "08:00 - 16:00",
    organizer: "Organic Farmers Association of Kenya",
    attendees: 45,
    maxCapacity: 50,
    ticketPrice: "KES 2,500",
    sponsored: false,
    tags: ["Organic", "Certification", "Standards"],
  },
  {
    _id: "e3",
    title: "FarmBond x AgriGrow Fertilizer Demo Day",
    type: "sponsored",
    description: "Free demonstration of premium fertilizer products. First 100 farmers receive free soil testing and fertilizer samples.",
    location: "Kasarani Show Ground, Nairobi",
    date: "2026-08-10",
    endDate: "2026-08-10",
    time: "10:00 - 15:00",
    organizer: "AgriGrow Fertilizers",
    attendees: 78,
    maxCapacity: 100,
    ticketPrice: "Free",
    sponsored: true,
    sponsor: "AgriGrow Fertilizers",
    tags: ["Fertilizer", "Free Samples", "Soil Testing"],
  },
  {
    _id: "e4",
    title: "Smart Irrigation Systems Workshop",
    type: "workshop",
    description: "Hands-on workshop on setting up drip irrigation systems. Participants receive a starter kit worth KES 5,000.",
    location: "Kabete Agricultural Training Centre",
    date: "2026-08-20",
    endDate: "2026-08-21",
    time: "08:30 - 17:00",
    organizer: "AquaFlow Irrigation",
    attendees: 28,
    maxCapacity: 30,
    ticketPrice: "KES 3,500",
    sponsored: false,
    tags: ["Irrigation", "Hands-on", "Equipment"],
  },
  {
    _id: "e5",
    title: "Livestock Vaccination Drive",
    type: "sponsored",
    description: "Free FMD and Anthrax vaccination campaign for livestock in Machakos County. Open to all registered farmers.",
    location: "Machakos County Agricultural Office",
    date: "2026-08-12",
    endDate: "2026-08-13",
    time: "07:00 - 17:00",
    organizer: "County Government of Machakos",
    attendees: 156,
    maxCapacity: 500,
    ticketPrice: "Free",
    sponsored: true,
    sponsor: "County Government",
    tags: ["Vaccination", "Free", "Livestock"],
  },
  {
    _id: "e6",
    title: "Smallholder Farmer Digital Literacy Program",
    type: "training",
    description: "Learn to use smartphone apps for farm management, market access, and mobile banking. 3-day comprehensive program.",
    location: "Kawangware Community Centre, Nairobi",
    date: "2026-08-25",
    endDate: "2026-08-27",
    time: "09:00 - 16:00",
    organizer: "Digital Farmers Kenya",
    attendees: 32,
    maxCapacity: 40,
    ticketPrice: "Free",
    sponsored: false,
    tags: ["Digital", "Free", "Mobile"],
  },
];

export default function FarmingEvents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [showSponsoredOnly, setShowSponsoredOnly] = useState(false);

  const filtered = mockEvents.filter((e) => {
    const matchesSearch =
      searchQuery === "" ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || e.type === selectedType;
    const matchesSponsored = !showSponsoredOnly || e.sponsored;
    return matchesSearch && matchesType && matchesSponsored;
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
              <h1 className="text-3xl font-bold tracking-tight">Farming Events</h1>
              <p className="text-muted-foreground mt-1">
                Discover training sessions, expos, workshops, and sponsored events near you
              </p>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              <Calendar className="w-4 h-4 mr-1 text-primary" />
              {mockEvents.length} Upcoming Events
            </Badge>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events or locations..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "training", "expo", "workshop", "sponsored"].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Event Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {filtered.map((event) => {
            const TypeIcon = eventTypeConfig[event.type]?.icon || Calendar;
            const typeColor = eventTypeConfig[event.type]?.color || "bg-gray-100 text-gray-700";

            return (
              <motion.div key={event._id} variants={itemVariants}>
                <Card className={`border-border/50 hover:shadow-lg transition-all h-full ${event.sponsored ? "ring-2 ring-amber-500/30" : ""}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${typeColor}`} variant="outline">
                            <TypeIcon className="w-3 h-3 mr-1" />
                            {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                          </Badge>
                          {event.sponsored && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-500/20">
                              <Megaphone className="w-3 h-3 mr-1" />
                              Sponsored
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{event.description}</p>

                    {/* Event Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {event.time}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                        <MapPin className="w-4 h-4" />
                        {event.location}
                      </div>
                    </div>

                    {/* Capacity and Price */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {event.attendees}/{event.maxCapacity} registered
                      </div>
                      <Badge variant={event.ticketPrice === "Free" ? "default" : "secondary"}>
                        {event.ticketPrice}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(event.attendees / event.maxCapacity) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round((event.attendees / event.maxCapacity) * 100)}% capacity filled
                      </p>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {event.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          <Tag className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1 gradient-primary" disabled={event.attendees >= event.maxCapacity}>
                        {event.attendees >= event.maxCapacity ? "Full" : "Register Now"}
                      </Button>
                      <Button variant="outline" size="icon">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No events found</h3>
            <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
