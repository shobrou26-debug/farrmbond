import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sprout, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

type ServiceType = "chat" | "video" | "field_visit";

interface ServiceRow {
  name: string;
  description: string;
  price: string;
  duration: string;
  type: ServiceType;
}

/**
 * Real application journey: the user submits an application that is created
 * with status "pending". Approval is ONLY possible via the admin review
 * mutation — this UI can never self-approve.
 */
export function AgronomistApplyCard() {
  const { user } = useAuth();
  const application = useQuery(api.marketplace.getMyAgronomistApplication);
  const applyAsAgronomist = useMutation(api.marketplace.applyAsAgronomist);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("Agronomist");
  const [specializations, setSpecializations] = useState("");
  const [experience, setExperience] = useState("3");
  const [timezone, setTimezone] = useState("Africa/Nairobi");
  const [hoursStart, setHoursStart] = useState("09:00");
  const [hoursEnd, setHoursEnd] = useState("17:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [services, setServices] = useState<ServiceRow[]>([
    { name: "", description: "", price: "", duration: "60", type: "chat" },
  ]);

  if (!user) return null;

  const status = application?.status;

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const updateService = (idx: number, field: keyof ServiceRow, value: string) => {
    setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const addService = () => {
    if (services.length >= 3) return;
    setServices((prev) => [...prev, { name: "", description: "", price: "", duration: "60", type: "chat" }]);
  };

  const handleSubmit = async () => {
    const cleanedServices = services
      .filter((s) => s.name.trim() && s.description.trim())
      .map((s) => ({
        name: s.name.trim(),
        description: s.description.trim(),
        price: parseFloat(s.price) || 0,
        duration: parseInt(s.duration, 10) || 60,
        type: s.type,
      }));
    if (cleanedServices.length === 0) {
      toast.error("Add at least one service with a name and description");
      return;
    }
    if (!specializations.trim()) {
      toast.error("Enter at least one specialization (comma separated)");
      return;
    }
    setSubmitting(true);
    try {
      await applyAsAgronomist({
        title: title.trim(),
        specializations: specializations.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
        experience: parseFloat(experience) || 0,
        services: cleanedServices,
        availableDays: selectedDays,
        availableHours: { start: hoursStart, end: hoursEnd },
        timezone: timezone.trim(),
      });
      toast.success("Application submitted — an admin will review your profile.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/50 mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Sprout className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Become an Agronomist</CardTitle>
            <CardDescription>
              Offer expert consultations to farmers across FarmBond
            </CardDescription>
          </div>
          {status === "approved" && (
            <Badge className="bg-green-500/10 text-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
            </Badge>
          )}
          {status === "pending" && (
            <Badge className="bg-amber-500/10 text-amber-600">
              <Clock className="w-3 h-3 mr-1" /> Under review
            </Badge>
          )}
          {status === "rejected" && (
            <Badge className="bg-red-500/10 text-red-600">
              <XCircle className="w-3 h-3 mr-1" /> Rejected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "approved" ? (
          <p className="text-sm text-muted-foreground">
            Your agronomist profile is live in the marketplace. Farmers can now book
            consultations with you.
          </p>
        ) : status === "pending" ? (
          <p className="text-sm text-muted-foreground">
            Your application is being reviewed by the FarmBond team. You'll be able to
            offer consultations once it's approved.
          </p>
        ) : status === "rejected" ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your application was not approved
              {application?.rejectionReason ? `: ${application.rejectionReason}` : "."}
              {" "}You're welcome to improve your profile and re-apply.
            </p>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Re-apply
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Submit your expertise, services and availability. Applications are reviewed
              and approved by the FarmBond team.
            </p>
            <Button size="sm" className="gradient-primary shrink-0" onClick={() => setOpen(true)}>
              Apply Now
            </Button>
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agronomist Application</DialogTitle>
              <DialogDescription>
                Your application is submitted for admin review — approval is required before
                your profile appears in the marketplace.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Professional title</Label>
                  <Select value={title} onValueChange={setTitle}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Agronomist", "Soil Scientist", "Crop Specialist", "Livestock Expert", "Irrigation Engineer", "Pest Control Specialist"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Experience (years)</Label>
                  <Input type="number" min={0} max={80} value={experience} onChange={(e) => setExperience(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Specializations (comma separated)</Label>
                <Input
                  value={specializations}
                  onChange={(e) => setSpecializations(e.target.value)}
                  placeholder="e.g., Crop Management, Soil Science, Irrigation"
                />
              </div>

              <div className="space-y-2">
                <Label>Services</Label>
                {services.map((s, idx) => (
                  <div key={idx} className="space-y-2 p-3 rounded-xl border border-border/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input placeholder="Service name (e.g., Farm Assessment)" value={s.name} onChange={(e) => updateService(idx, "name", e.target.value)} />
                      <Input placeholder="Price (local currency)" type="number" min={0} value={s.price} onChange={(e) => updateService(idx, "price", e.target.value)} />
                    </div>
                    <Input placeholder="Description" value={s.description} onChange={(e) => updateService(idx, "description", e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={s.type} onValueChange={(v) => updateService(idx, "type", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chat">Chat</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="field_visit">Field Visit</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="Duration (minutes)" type="number" min={15} value={s.duration} onChange={(e) => updateService(idx, "duration", e.target.value)} />
                    </div>
                  </div>
                ))}
                {services.length < 3 && (
                  <Button type="button" variant="ghost" size="sm" onClick={addService}>
                    + Add another service
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Available days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                        selectedDays.includes(day)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Start hour</Label>
                  <Input type="time" value={hoursStart} onChange={(e) => setHoursStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End hour</Label>
                  <Input type="time" value={hoursEnd} onChange={(e) => setHoursEnd(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="gradient-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
