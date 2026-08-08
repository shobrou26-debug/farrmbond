import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/convex/_generated/api";
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
  ExternalLink,
  Tag,
  Megaphone,
  GraduationCap,
  Tractor,
  Sprout,
  Check,
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

const eventTypeConfig: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  training: { color: "bg-blue-100 text-blue-700", icon: GraduationCap },
  expo: { color: "bg-purple-100 text-purple-700", icon: Tractor },
  workshop: { color: "bg-green-100 text-green-700", icon: Sprout },
  sponsored: { color: "bg-amber-100 text-amber-700", icon: Megaphone },
};

type EventItem = {
  _id: string;
  title: string;
  type: "training" | "expo" | "workshop" | "sponsored";
  description: string;
  location: string;
  startDate: number;
  endDate: number;
  time: string;
  organizer: string;
  attendees: number;
  maxCapacity: number;
  ticketPrice: string;
  sponsored: boolean;
  sponsorName?: string;
  tags: string[];
};

export default function FarmingEvents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [showSponsoredOnly, setShowSponsoredOnly] = useState(false);

  const events = useQuery(api.farmingEvents.listEvents, {
    type: selectedType === "all" ? undefined : selectedType,
    includePast: false,
  });
  const myRegistrations = useQuery(api.farmingEvents.getMyRegistrations);
  const registerForEvent = useMutation(api.farmingEvents.registerForEvent);
  const cancelRegistration = useMutation(api.farmingEvents.cancelRegistration);

  const [pendingId, setPendingId] = useState<string | null>(null);

  const registeredIds = useMemo(() => new Set(myRegistrations ?? []), [myRegistrations]);

  const filtered = useMemo(() => {
    return (events ?? []).filter((e) => {
      const matchesSearch =
        searchQuery === "" ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSponsored = !showSponsoredOnly || e.sponsored;
      return matchesSearch && matchesSponsored;
    });
  }, [events, searchQuery, showSponsoredOnly]);

  const handleRegister = async (event: EventItem) => {
    setPendingId(event._id);
    try {
      await registerForEvent({ eventId: event._id as any });
      toast.success(`Registered for "${event.title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setPendingId(null);
    }
  };

  const handleCancel = async (event: EventItem) => {
    setPendingId(event._id);
    try {
      await cancelRegistration({ eventId: event._id as any });
      toast.success("Registration cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setPendingId(null);
    }
  };

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
              {(events ?? []).length} Upcoming Events
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
          <div className="flex flex-wrap gap-2 items-center">
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
            <button
              onClick={() => setShowSponsoredOnly(!showSponsoredOnly)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                showSponsoredOnly
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              Sponsored
            </button>
          </div>
        </div>

        {/* Event Cards */}
        {!events ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 bg-muted/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filtered.map((event) => {
              const TypeIcon = eventTypeConfig[event.type]?.icon || Calendar;
              const typeColor = eventTypeConfig[event.type]?.color || "bg-gray-100 text-gray-700";
              const isRegistered = registeredIds.has(event._id);
              const isFull = event.attendees >= event.maxCapacity;
              const progress = Math.min(100, Math.round((event.attendees / event.maxCapacity) * 100));

              return (
                <motion.div key={event._id} variants={itemVariants}>
                  <Card className={`border-border/50 hover:shadow-lg transition-all h-full flex flex-col ${event.sponsored ? "ring-2 ring-amber-500/30" : ""}`}>
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
                            {isRegistered && (
                              <Badge className="bg-green-100 text-green-700 border-green-500/20">
                                <Check className="w-3 h-3 mr-1" />
                                Registered
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 flex flex-col flex-1">
                      <p className="text-sm text-muted-foreground">{event.description}</p>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          {event.attendees}/{event.maxCapacity} registered
                        </div>
                        <Badge variant={event.ticketPrice === "Free" ? "default" : "secondary"}>
                          {event.ticketPrice}
                        </Badge>
                      </div>

                      <div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isFull ? "bg-red-500" : "bg-primary"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {progress}% capacity filled
                        </p>
                      </div>

                      {event.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {event.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 mt-auto">
                        {isRegistered ? (
                          <Button
                            variant="outline"
                            className="flex-1"
                            disabled={pendingId === event._id}
                            onClick={() => handleCancel(event)}
                          >
                            {pendingId === event._id ? "Cancelling..." : "Cancel Registration"}
                          </Button>
                        ) : (
                          <Button
                            className="flex-1 gradient-primary"
                            disabled={isFull || pendingId === event._id}
                            onClick={() => handleRegister(event)}
                          >
                            {isFull ? "Event Full" : pendingId === event._id ? "Registering..." : "Register Now"}
                          </Button>
                        )}
                        <Button variant="outline" size="icon" title="Open organizer site">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {events && filtered.length === 0 && (
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
