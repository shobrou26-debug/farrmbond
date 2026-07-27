import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

// ============================================================
// Types
// ============================================================

type EventType = "planting" | "harvesting" | "fertilizing" | "pest_control" | "irrigation" | "vaccination" | "other";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  type: EventType;
  description?: string;
  farm?: string;
  crop?: string;
  priority: "high" | "medium" | "low";
  isCompleted: boolean;
  weatherDependent: boolean;
  reminder?: number; // days before
}

interface WeatherForecast {
  date: Date;
  tempHigh: number;
  tempLow: number;
  condition: "sunny" | "cloudy" | "rainy" | "stormy";
  precipitation: number;
  isGoodForPlanting: boolean;
  isGoodForHarvesting: boolean;
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
// Mock Data
// ============================================================

const mockEvents: CalendarEvent[] = [
  { id: "1", title: "Plant Maize (H614)", date: new Date(2026, 6, 28), type: "planting", farm: "Green Valley Farm", crop: "Maize", priority: "high", isCompleted: false, weatherDependent: true, reminder: 3 },
  { id: "2", title: "Harvest Tomatoes", date: new Date(2026, 6, 25), endDate: new Date(2026, 6, 27), type: "harvesting", farm: "Green Valley Farm", crop: "Tomatoes", priority: "high", isCompleted: false, weatherDependent: true },
  { id: "3", title: "Apply NPK Fertilizer", date: new Date(2026, 6, 30), type: "fertilizing", farm: "All Farms", priority: "medium", isCompleted: false, weatherDependent: true },
  { id: "4", title: "Pest Control - Aphids", date: new Date(2026, 7, 2), type: "pest_control", farm: "Sunrise Ranch", crop: "Vegetables", priority: "high", isCompleted: false, weatherDependent: true },
  { id: "5", title: "Irrigate Vegetable Garden", date: new Date(2026, 6, 26), type: "irrigation", farm: "Riverside Fields", priority: "medium", isCompleted: false, weatherDependent: false },
  { id: "6", title: "Cattle Vaccination", date: new Date(2026, 7, 5), type: "vaccination", farm: "Sunrise Ranch", priority: "medium", isCompleted: false, weatherDependent: false, reminder: 7 },
  { id: "7", title: "Plant Beans (Rose Coco)", date: new Date(2026, 7, 10), type: "planting", farm: "Green Valley Farm", crop: "Beans", priority: "medium", isCompleted: false, weatherDependent: true, reminder: 5 },
  { id: "8", title: "Harvest Kale", date: new Date(2026, 7, 1), type: "harvesting", farm: "Riverside Fields", crop: "Kale", priority: "low", isCompleted: true, weatherDependent: false },
];

// ============================================================
// Calendar Helpers
// ============================================================

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function generateWeatherForecast(year: number, month: number): WeatherForecast[] {
  const daysInMonth = getDaysInMonth(year, month);
  const forecasts: WeatherForecast[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Simulate weather patterns
    const conditions: ("sunny" | "cloudy" | "rainy" | "stormy")[] = ["sunny", "cloudy", "rainy", "sunny", "sunny"];
    const condition = conditions[day % conditions.length];
    const tempHigh = 22 + Math.floor(Math.random() * 10);
    const tempLow = 14 + Math.floor(Math.random() * 6);
    const precipitation = condition === "rainy" ? 5 + Math.floor(Math.random() * 15) : condition === "stormy" ? 20 + Math.floor(Math.random() * 20) : 0;

    forecasts.push({
      date,
      tempHigh,
      tempLow,
      condition,
      precipitation,
      isGoodForPlanting: condition !== "rainy" && condition !== "stormy" && tempHigh > 18,
      isGoodForHarvesting: condition !== "rainy" && condition !== "stormy",
    });
  }

  return forecasts;
}

// ============================================================
// Mini Calendar Component
// ============================================================

function MiniCalendar({
  year,
  month,
  events,
  weather,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  weather: WeatherForecast[];
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
    const date = new Date(year, month, day);
    return events.filter((e) => {
      const eventDate = new Date(e.date);
      return eventDate.getDate() === day && eventDate.getMonth() === month && eventDate.getFullYear() === year;
    });
  };

  const getWeatherForDay = (day: number) => {
    return weather.find((w) => w.date.getDate() === day);
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
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(year, month, day);
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            const dayEvents = getEventsForDay(day);
            const dayWeather = getWeatherForDay(day);
            const hasHighPriority = dayEvents.some((e) => e.priority === "high" && !e.isCompleted);

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

                {/* Weather indicator */}
                {dayWeather && (
                  <span className="text-[8px] leading-none mt-0.5">
                    {dayWeather.condition === "sunny" ? "☀️" : dayWeather.condition === "rainy" ? "🌧️" : dayWeather.condition === "cloudy" ? "☁️" : "⛈️"}
                  </span>
                )}

                {/* Event dots */}
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((event, idx) => (
                      <div
                        key={idx}
                        className={`w-1 h-1 rounded-full ${
                          event.isCompleted
                            ? "bg-green-400"
                            : event.priority === "high"
                            ? "bg-red-400"
                            : "bg-primary"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* High priority indicator */}
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
}: {
  events: CalendarEvent[];
  selectedDate: Date | null;
  onComplete: (id: string) => void;
}) {
  const filteredEvents = selectedDate
    ? events.filter((e) => new Date(e.date).toDateString() === selectedDate.toDateString())
    : events.filter((e) => !e.isCompleted).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
          </div>
        ) : (
          filteredEvents.map((event) => {
            const config = eventTypeConfig[event.type];
            const Icon = config.icon;
            const isOverdue = !event.isCompleted && new Date(event.date) < new Date();

            return (
              <motion.div
                key={event.id}
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
                    {event.weatherDependent && (
                      <Badge variant="outline" className="text-[10px]">
                        <Cloud className="w-2.5 h-2.5 mr-0.5" />
                        Weather
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {event.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    {event.farm && (
                      <>
                        <span>•</span>
                        <span>{event.farm}</span>
                      </>
                    )}
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
                    onClick={() => onComplete(event.id)}
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

function WeatherRecommendations({ weather }: { weather: WeatherForecast[] }) {
  const today = new Date();
  const upcomingForecast = weather.slice(today.getDate() - 1, today.getDate() + 6);

  const goodPlantingDays = upcomingForecast.filter((w) => w.isGoodForPlanting);
  const goodHarvestDays = upcomingForecast.filter((w) => w.isGoodForHarvesting);
  const rainyDays = upcomingForecast.filter((w) => w.condition === "rainy" || w.condition === "stormy");

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Cloud className="w-4 h-4 text-blue-500" />
          Weather-Based Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Planting Window */}
        <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Sprout className="w-4 h-4 text-green-600" />
            <h4 className="text-sm font-semibold text-green-700">Planting Window</h4>
          </div>
          {goodPlantingDays.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {goodPlantingDays.map((w, i) => (
                <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700">
                  {w.date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-green-700">No ideal planting days in the next 7 days</p>
          )}
        </div>

        {/* Harvest Window */}
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Scissors className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-amber-700">Harvest Window</h4>
          </div>
          {goodHarvestDays.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {goodHarvestDays.map((w, i) => (
                <Badge key={i} variant="secondary" className="bg-amber-500/10 text-amber-700">
                  {w.date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-700">No ideal harvesting days in the next 7 days</p>
          )}
        </div>

        {/* Rain Alert */}
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

        {/* 7-Day Forecast */}
        <div>
          <h4 className="text-sm font-semibold mb-2">7-Day Forecast</h4>
          <div className="grid grid-cols-7 gap-1">
            {upcomingForecast.map((w, i) => (
              <div key={i} className="text-center p-1 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground">
                  {w.date.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p className="text-sm my-0.5">
                  {w.condition === "sunny" ? "☀️" : w.condition === "rainy" ? "🌧️" : w.condition === "cloudy" ? "☁️" : "⛈️"}
                </p>
                <p className="text-[10px] font-medium">{w.tempHigh}°</p>
              </div>
            ))}
          </div>
        </div>
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
  const [events, setEvents] = useState<CalendarEvent[]>(mockEvents);
  const [filterType, setFilterType] = useState<EventType | "all">("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const weather = useMemo(() => generateWeatherForecast(year, month), [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1));
  };

  const handleCompleteEvent = (id: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, isCompleted: true } : e)));
  };

  const filteredEvents = filterType === "all" ? events : events.filter((e) => e.type === filterType);

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
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
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
          {/* Left: Calendar + Events */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <MiniCalendar
                year={year}
                month={month}
                events={filteredEvents}
                weather={weather}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
              />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <EventList
                events={filteredEvents}
                selectedDate={selectedDate}
                onComplete={handleCompleteEvent}
              />
            </motion.div>
          </div>

          {/* Right: Weather & Recommendations */}
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
              <WeatherRecommendations weather={weather} />
            </motion.div>

            {/* Quick Stats */}
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
                    <span className="text-sm text-muted-foreground">Completed This Month</span>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                      {events.filter((e) => e.isCompleted).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Weather-Dependent</span>
                    <Badge variant="secondary">{events.filter((e) => e.weatherDependent && !e.isCompleted).length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">High Priority</span>
                    <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                      {events.filter((e) => e.priority === "high" && !e.isCompleted).length}
                    </Badge>
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
