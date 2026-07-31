import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { api } from "@/convex/_generated/api";
import { useTimezone } from "@/hooks/use-timezone";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sprout,
  Scissors,
  Droplets,
  Bug,
  Leaf,
  Sun,
  Cloud,
  CloudRain,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Filter,
  X,
  Loader2,
} from "lucide-react";
import { useWeather } from "@/hooks/use-weather";

// ============================================================
// Types
// ============================================================

type EventType = "planting" | "harvesting" | "fertilizing" | "pest_control" | "irrigation" | "vaccination" | "other";

interface CalendarEvent {
  _id: string;
  title: string;
  startDate: number;
  endDate?: number;
  eventType: EventType;
  description?: string;
  farmId: string;
  farmName?: string;
  cropId?: string;
  priority: "high" | "medium" | "low";
  isCompleted: boolean;
  reminderDaysBefore?: number;
}

// ============================================================
// Event Type Config
// ============================================================

const eventTypeConfig: Record<EventType, { label: string; icon: typeof Sprout; color: string; bgColor: string }> = {
  planting: { label: "Planting", icon: Sprout, color: "text-green-600", bgColor: "bg-green-500/10" },
  harvesting: { label: "Harvesting", icon: Scissors, color: "text-amber-600", bgColor: "bg-amber-500/10" },
  fertilizing: { label: "Fertilizing", icon: Leaf, color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
  pest_control: { label: "Pest Control", icon: Bug, color: "text-red-600", bgColor: "bg-red-500/10" },
  irrigation: { label: "Irrigation", icon: Droplets, color: "text-blue-600", bgColor: "bg-blue-500/10" },
  vaccination: { label: "Vaccination", icon: Sun, color: "text-purple-600", bgColor: "bg-purple-500/10" },
  other: { label: "Other", icon: CalendarIcon, color: "text-gray-600", bgColor: "bg-gray-500/10" },
};

// ============================================================
// Calendar Helpers
// ============================================================

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function getWeatherCondition(tempHigh: number, humidity: number): "sunny" | "cloudy" | "rainy" | "stormy" {
  if (humidity > 80) return "rainy";
  if (humidity > 60) return "cloudy";
  if (tempHigh > 35) return "stormy";
  return "sunny";
}

// ============================================================
// Mini Calendar Component
// ============================================================

function MiniCalendar({
  year,
  month,
  events,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      const eventDate = new Date(e.startDate);
      return eventDate.getDate() === day && eventDate.getMonth() === month && eventDate.getFullYear() === year;
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onPrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-base">{monthName}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(year, month, day);
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            const dayEvents = getEventsForDay(day);
            const hasHighPriority = dayEvents.some((e) => e.eventType === "pest_control" && !e.isCompleted);

            return (
              <button
                key={day}
                onClick={() => onSelectDate(date)}
                className={`relative aspect-square flex flex-col items-center justify-start p-1 rounded-lg transition-all text-sm ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className={`text-xs ${isSelected ? "text-primary-foreground" : ""}`}>{day}</span>

                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((event, idx) => (
                      <div
                        key={idx}
                        className={`w-1 h-1 rounded-full ${
                          event.isCompleted
                            ? "bg-green-400"
                            : event.eventType === "pest_control"
                            ? "bg-red-400"
                            : "bg-primary"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {hasHighPriority && (
                  <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Event List
// ============================================================

function EventList({
  events,
  selectedDate,
  onComplete,
  timezone,
}: {
  events: CalendarEvent[];
  selectedDate: Date | null;
  onComplete: (id: string) => void;
  timezone: string;
}) {
  const filteredEvents = selectedDate
    ? events.filter((e) => new Date(e.startDate).toDateString() === selectedDate.toDateString())
    : events.filter((e) => !e.isCompleted).sort((a, b) => a.startDate - b.startDate);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {selectedDate
            ? `Events for ${selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : "Upcoming Events"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events scheduled</p>
            <p className="text-xs mt-1">Create your first calendar event to get started</p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const config = eventTypeConfig[event.eventType] || eventTypeConfig.other;
            const Icon = config.icon;
            const isOverdue = !event.isCompleted && new Date(event.startDate) < new Date();

            return (
              <motion.div
                key={event._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                  event.isCompleted
                    ? "bg-muted/30 border-border/50 opacity-60"
                    : isOverdue
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-card border-border/50 hover:border-primary/30"
                }`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${config.bgColor}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-sm font-medium ${event.isCompleted ? "line-through" : ""}`}>
                      {event.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(event.startDate).toLocaleString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                  </div>
                  {isOverdue && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Overdue
                    </p>
                  )}
                </div>
                {!event.isCompleted && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => onComplete(event._id)}
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </Button>
                )}
              </motion.div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Weather Recommendations
// ============================================================

function WeatherRecommendations({ weather }: { weather: ReturnType<typeof useWeather> }) {
  const forecast = (weather.data?.daily || []).map((d) => ({ date: d.date, tempHigh: d.tempMax, humidity: 50, precipitation: d.precipitationSum }));
  const today = new Date();

  const upcomingForecast = forecast;

  const goodPlantingDays = upcomingForecast.filter((w: { tempHigh: number; humidity: number }) => w.humidity < 70 && w.tempHigh > 18);
  const goodHarvestDays = upcomingForecast.filter((w: { humidity: number }) => w.humidity < 60);
  const rainyDays = upcomingForecast.filter((w: { humidity: number }) => w.humidity > 75);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Cloud className="w-4 h-4 text-blue-500" />
          Weather-Based Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Sprout className="w-4 h-4 text-green-600" />
            <h4 className="text-sm font-semibold text-green-700">Planting Window</h4>
          </div>
          {goodPlantingDays.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {goodPlantingDays.map((_: unknown, i: number) => (
                <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700">
                  {new Date(today.getTime() + (i + 1) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-green-700">No ideal planting days in the next 7 days</p>
          )}
        </div>

        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Scissors className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-amber-700">Harvest Window</h4>
          </div>
          {goodHarvestDays.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {goodHarvestDays.map((_: unknown, i: number) => (
                <Badge key={i} variant="secondary" className="bg-amber-500/10 text-amber-700">
                  {new Date(today.getTime() + (i + 1) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-700">No ideal harvesting days in the next 7 days</p>
          )}
        </div>

        {rainyDays.length > 0 && (
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <CloudRain className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-blue-700">Rain Expected</h4>
            </div>
            <p className="text-xs text-blue-700">
              {rainyDays.length} rainy day(s) expected. Plan field activities around rain periods.
            </p>
          </div>
        )}

        {upcomingForecast.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">7-Day Forecast</h4>
            <div className="grid grid-cols-7 gap-1">
              {upcomingForecast.map((w: { humidity: number; tempHigh: number }, i: number) => {
                const condition = getWeatherCondition(w.tempHigh, w.humidity);
                return (
                  <div key={i} className="text-center p-1 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(today.getTime() + (i + 1) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "short" })}
                    </p>
                    <p className="text-sm my-0.5">
                      {condition === "sunny" ? "☀️" : condition === "rainy" ? "🌧️" : condition === "cloudy" ? "☁️" : "⛈️"}
                    </p>
                    <p className="text-[10px] font-medium">{Math.round(w.tempHigh)}°</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Calendar Page
// ============================================================

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<EventType | "all">("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Real Convex data (paginated via usePaginatedQuery)
  const { results: calendarEvents, isLoading: isLoadingEvents } = usePaginatedQuery(api.farmCalendar.listUserEvents);
  const { results: farms } = usePaginatedQuery(api.farms.listUserFarms);
  const completeEventMutation = useMutation(api.farmCalendar.completeEvent);
  const { timezone, formatTime, formatDateTime } = useTimezone();

  // Real weather data
  const weather = useWeather();

  // Map Convex events to local format
  const events: CalendarEvent[] = useMemo(() => {
    if (!calendarEvents) return [];
    return calendarEvents.map((e) => ({
      _id: e._id,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      eventType: e.eventType as EventType,
      description: e.description,
      farmId: e.farmId,
      cropId: e.cropId,
      priority: e.eventType === "pest_control" ? "high" : e.eventType === "planting" ? "high" : "medium",
      isCompleted: e.isCompleted,
      reminderDaysBefore: e.reminderDaysBefore,
    }));
  }, [calendarEvents]);

  const filteredEvents = filterType === "all" ? events : events.filter((e) => e.eventType === filterType);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1));
  };

  const handleCompleteEvent = async (id: string) => {
    try {
      await completeEventMutation({ eventId: id as any });
    } catch (error) {
      console.error("Failed to complete event:", error);
    }
  };

  const isLoading = isLoadingEvents;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Farm Calendar</h1>
              <p className="text-muted-foreground mt-1">Plan and track your farming activities with weather insights</p>
            </div>
          </div>
        </motion.div>

        {/* Event Type Filters */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mb-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("all")}
            >
              All Events
            </Button>
            {(Object.keys(eventTypeConfig) as EventType[]).map((type) => {
              const config = eventTypeConfig[type];
              const Icon = config.icon;
              return (
                <Button
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className="gap-1.5"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </Button>
              );
            })}
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              {isLoading ? (
                <Card className="border-border/50">
                  <CardContent className="p-6 space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 35 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <MiniCalendar
                  year={year}
                  month={month}
                  events={filteredEvents}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onPrevMonth={handlePrevMonth}
                  onNextMonth={handleNextMonth}
                />
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              {isLoading ? (
                <Card className="border-border/50">
                  <CardContent className="p-6 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <EventList
                  events={filteredEvents}
                  selectedDate={selectedDate}
                  onComplete={handleCompleteEvent}
                  timezone={timezone}
                />
              )}
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
              <WeatherRecommendations weather={weather} />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Upcoming Events</span>
                    <Badge variant="secondary">{events.filter((e) => !e.isCompleted).length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                      {events.filter((e) => e.isCompleted).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Events</span>
                    <Badge variant="secondary">{events.length}</Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
