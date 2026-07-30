import { useState } from "react";
import { motion } from "framer-motion";
import {
  Syringe,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface LivestockDoc {
  _id: string;
  name: string;
  type: string;
  breed?: string;
  quantity: number;
  unit: string;
  status: string;
  farmId: string;
  nextVaccination?: number;
  lastVaccination?: number;
}

interface VaccinationScheduleTabProps {
  livestock: LivestockDoc[];
  scheduleVaccination: (args: any) => Promise<any>;
  completeVaccination: (args: any) => Promise<any>;
}

export function VaccinationScheduleTab({
  livestock,
  scheduleVaccination,
  completeVaccination,
}: VaccinationScheduleTabProps) {
  const [animalToSchedule, setAnimalToSchedule] = useState<LivestockDoc | null>(null);
  const [animalToComplete, setAnimalToComplete] = useState<LivestockDoc | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeCost, setCompleteCost] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const now = Date.now();
  const upcomingVaccinations = livestock
    .filter((l) => l.nextVaccination && l.nextVaccination > now)
    .sort((a, b) => (a.nextVaccination || 0) - (b.nextVaccination || 0));

  const overdueVaccinations = livestock
    .filter((l) => l.nextVaccination && l.nextVaccination <= now)
    .sort((a, b) => (a.nextVaccination || 0) - (b.nextVaccination || 0));

  const unscheduled = livestock.filter(
    (l) => !l.nextVaccination && l.status !== "harvested"
  );

  const handleSchedule = async () => {
    if (!animalToSchedule || !scheduleDate) return;
    setIsSubmitting(true);
    try {
      await scheduleVaccination({
        livestockId: animalToSchedule._id,
        scheduledDate: new Date(scheduleDate).getTime(),
      });
      toast.success(`Vaccination scheduled for ${animalToSchedule.name}`);
      setAnimalToSchedule(null);
      setScheduleDate("");
    } catch (error) {
      console.error("Failed to schedule vaccination:", error);
      toast.error("Failed to schedule vaccination");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!animalToComplete) return;
    setIsSubmitting(true);
    try {
      await completeVaccination({
        livestockId: animalToComplete._id,
        notes: completeNotes || undefined,
        cost: completeCost ? parseFloat(completeCost) : undefined,
      });
      toast.success(`Vaccination completed for ${animalToComplete.name}`);
      setAnimalToComplete(null);
      setCompleteNotes("");
      setCompleteCost("");
    } catch (error) {
      console.error("Failed to complete vaccination:", error);
      toast.error("Failed to complete vaccination");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDaysUntil = (timestamp: number) => {
    const days = Math.ceil((timestamp - now) / (24 * 60 * 60 * 1000));
    return days;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingVaccinations.length}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overdueVaccinations.length}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Syringe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unscheduled.length}</p>
                <p className="text-xs text-muted-foreground">Unscheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Vaccinations */}
      {overdueVaccinations.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-600 text-base">
              <AlertTriangle className="w-5 h-5" />
              Overdue Vaccinations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueVaccinations.map((animal) => {
              const daysOverdue = Math.abs(getDaysUntil(animal.nextVaccination!));
              return (
                <div
                  key={animal._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100"
                >
                  <div className="flex items-center gap-3">
                    <Syringe className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="font-medium">{animal.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {animal.type} · {animal.quantity} {animal.unit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">{daysOverdue}d overdue</Badge>
                    <Button
                      size="sm"
                      onClick={() => setAnimalToComplete(animal)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Complete
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Vaccinations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-5 h-5 text-emerald-600" />
            Upcoming Vaccinations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingVaccinations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Syringe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No upcoming vaccinations scheduled</p>
            </div>
          ) : (
            upcomingVaccinations.map((animal) => {
              const daysUntil = getDaysUntil(animal.nextVaccination!);
              const isUrgent = daysUntil <= 3;
              return (
                <div
                  key={animal._id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isUrgent ? "bg-amber-50 border-amber-200" : "bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Syringe className={`w-4 h-4 ${isUrgent ? "text-amber-600" : "text-emerald-600"}`} />
                    <div>
                      <p className="font-medium">{animal.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {animal.type} · Due{" "}
                        {new Date(animal.nextVaccination!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={isUrgent ? "destructive" : "secondary"}>
                      {daysUntil === 0 ? "Today" : `${daysUntil}d`}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAnimalToSchedule(animal)}
                    >
                      <Calendar className="w-4 h-4 mr-1" />
                      Reschedule
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setAnimalToComplete(animal)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Complete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Unscheduled Animals */}
      {unscheduled.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Syringe className="w-5 h-5 text-blue-600" />
              Animals Without Vaccination Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unscheduled.slice(0, 10).map((animal) => (
              <div
                key={animal._id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Syringe className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="font-medium">{animal.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {animal.type} · {animal.quantity} {animal.unit}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAnimalToSchedule(animal)}
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Schedule
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Schedule Vaccination Dialog */}
      <Dialog
        open={animalToSchedule !== null}
        onOpenChange={() => setAnimalToSchedule(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Schedule Vaccination — {animalToSchedule?.name}
            </DialogTitle>
            <DialogDescription>
              Set the next vaccination date for this animal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="schedule-date">Vaccination Date *</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnimalToSchedule(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={isSubmitting || !scheduleDate}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Vaccination Dialog */}
      <Dialog
        open={animalToComplete !== null}
        onOpenChange={() => setAnimalToComplete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Complete Vaccination — {animalToComplete?.name}
            </DialogTitle>
            <DialogDescription>
              Mark this vaccination as completed. The next vaccination will be auto-scheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="complete-notes">Notes (optional)</Label>
              <Input
                id="complete-notes"
                placeholder="e.g. Given Ivermectin 10ml"
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="complete-cost">Cost (optional)</Label>
              <Input
                id="complete-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={completeCost}
                onChange={(e) => setCompleteCost(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnimalToComplete(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
