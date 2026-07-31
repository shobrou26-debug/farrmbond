import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Clock, Video, MessageSquare, MapPin,
  ChevronLeft, ChevronRight, CheckCircle2, User, X, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AgronomistInfo {
  _id: Id<"users">;
  name: string;
  title?: string;
  specializations?: string[];
  services?: Array<{
    name: string;
    description: string;
    price: number;
    duration: number;
    type: "chat" | "video" | "field_visit";
  }>;
  availableDays?: string[];
  availableHours?: { start: string; end: string };
  averageRating?: number;
  totalReviews?: number;
  image?: string | null;
}

interface Props {
  agronomist: AgronomistInfo;
  onClose: () => void;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function generateTimeSlots(startHour: number, endHour: number, durationMinutes: number) {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += durationMinutes) {
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return slots;
}

function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

export default function ConsultationBooking({ agronomist, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedService, setSelectedService] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bookConsultation = useMutation(api.marketplace.bookConsultation);

  const services = agronomist.services || [];
  const currentService = services[selectedService];
  const calendarDays = generateCalendarDays(calYear, calMonth);
  const startHour = parseInt((agronomist.availableHours?.start || "09:00").split(":")[0]);
  const endHour = parseInt((agronomist.availableHours?.end || "17:00").split(":")[0]);
  const timeSlots = useMemo(() => {
    if (!currentService) return [];
    return generateTimeSlots(startHour, endHour, currentService.duration);
  }, [startHour, endHour, currentService]);

  const isDayAvailable = (day: number) => {
    if (!agronomist.availableDays || agronomist.availableDays.length === 0) return true;
    const date = new Date(calYear, calMonth, day);
    return agronomist.availableDays.includes(dayNames[date.getDay()].toLowerCase());
  };

  const isDatePast = (day: number) => {
    const date = new Date(calYear, calMonth, day);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const serviceTypeIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="w-4 h-4" />;
      case "field_visit": return <MapPin className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime || !currentService) return;
    setIsSubmitting(true);
    try {
      const [h, m] = selectedTime.split(":").map(Number);
      const scheduledAt = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), h, m).getTime();
      await bookConsultation({
        agronomistId: agronomist._id,
        serviceType: currentService.name,
        scheduledAt,
        duration: currentService.duration,
        notes: notes || undefined,
      });
      setStep(4);
    } catch (err) {
      console.error("Booking failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl">
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            {step > 1 && step < 4 && <Button variant="ghost" size="icon" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}><ChevronLeft className="w-4 h-4" /></Button>}
            <div>
              <h2 className="font-semibold text-lg">Book Consultation</h2>
              <p className="text-sm text-muted-foreground">with {agronomist.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {step < 4 && (
          <div className="px-6 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
                  <span className={`text-xs hidden sm:inline ${step >= s ? "text-foreground" : "text-muted-foreground"}`}>{s === 1 ? "Service" : s === 2 ? "Schedule" : "Confirm"}</span>
                  {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? "bg-primary" : "bg-muted"}`} />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="font-semibold">Select a Service</h3>
                {services.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No services available for this agronomist.</p>
                ) : (
                  <div className="space-y-3">
                    {services.map((svc, i) => (
                      <button key={i} onClick={() => setSelectedService(i)} className={`w-full text-left p-4 rounded-xl border transition-all ${selectedService === i ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${selectedService === i ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{serviceTypeIcon(svc.type)}</div>
                            <div>
                              <h4 className="font-medium">{svc.name}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{svc.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {svc.duration} min</span>
                                <Badge variant="outline" className="text-xs capitalize">{svc.type.replace("_", " ")}</Badge>
                              </div>
                            </div>
                          </div>
                          <p className="text-lg font-bold text-primary">KES {svc.price.toLocaleString()}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-end pt-4">
                  <Button onClick={() => setStep(2)} disabled={services.length === 0} className="gradient-primary">Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="font-semibold">Select Date &amp; Time</h3>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <Button variant="ghost" size="icon" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}><ChevronLeft className="w-4 h-4" /></Button>
                      <span className="font-medium">{new Date(calYear, calMonth).toLocaleString("default", { month: "long", year: "numeric" })}</span>
                      <Button variant="ghost" size="icon" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {dayShort.map((d) => (<div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, i) => {
                        if (day === null) return <div key={i} />;
                        const available = isDayAvailable(day) && !isDatePast(day);
                        const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === calMonth && selectedDate?.getFullYear() === calYear;
                        return <button key={i} disabled={!available} onClick={() => { setSelectedDate(new Date(calYear, calMonth, day)); setSelectedTime(null); }} className={`h-9 rounded-lg text-sm font-medium transition-all ${isSelected ? "bg-primary text-primary-foreground" : available ? "hover:bg-muted text-foreground" : "text-muted-foreground/30 cursor-not-allowed"}`}>{day}</button>;
                      })}
                    </div>
                  </CardContent>
                </Card>

                {selectedDate && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Available Times for {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {timeSlots.map((slot) => (
                        <button key={slot} onClick={() => setSelectedTime(slot)} className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${selectedTime === slot ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>{slot}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                  <textarea placeholder="Describe your farming issue or what you need help with..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
                  <Button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime} className="gradient-primary">Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <h3 className="font-semibold">Confirm Booking</h3>
                <Card className="border-border/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                        {agronomist.image ? <img src={agronomist.image} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-primary" />}
                      </div>
                      <div>
                        <p className="font-medium">{agronomist.name}</p>
                        <p className="text-sm text-muted-foreground">{agronomist.title || "Agronomist"}</p>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3 space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Service</span><span className="font-medium">{currentService?.name}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{currentService?.type.replace("_", " ")}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date</span><span className="font-medium">{selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Time</span><span className="font-medium">{selectedTime}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Duration</span><span className="font-medium">{currentService?.duration} minutes</span></div>
                      {notes && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Notes</span><span className="font-medium text-right max-w-[60%]">{notes}</span></div>}
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between">
                      <span className="font-medium">Total</span>
                      <span className="text-xl font-bold text-primary">KES {currentService?.price.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="bg-muted/50 rounded-xl p-4">
                  <p className="text-sm text-muted-foreground"><strong>Note:</strong> Payment will be processed after the agronomist confirms your booking. You will receive a notification with payment instructions.</p>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
                  <Button onClick={handleBooking} disabled={isSubmitting} className="gradient-primary">
                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Booking...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Booking</>}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold">Booking Confirmed!</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Your consultation with <strong>{agronomist.name}</strong> has been booked for <strong>{selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong> at <strong>{selectedTime}</strong>.
                </p>
                <div className="bg-muted/50 rounded-xl p-4 max-w-sm mx-auto text-sm text-muted-foreground">
                  <p>You will receive a notification when the agronomist confirms your booking. Payment instructions will be provided at that time.</p>
                </div>
                <Button onClick={onClose} className="gradient-primary mt-4">Done</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
