import { useState } from "react";
import { motion } from "framer-motion";
import { Beef, DollarSign, Syringe, CheckCircle2, X, ArrowLeft, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ============================================================
// Shared helpers (kept local so the component is self-contained)
// ============================================================

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

const formatDate = (timestamp?: number) => {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const parseDateInput = (dateStr: string): number | undefined => {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date.getTime();
};

// ============================================================
// Enhanced Add Livestock Modal (Multi-Step)
// ============================================================
export function AddLivestockModal({
  isOpen,
  onClose,
  farmId,
  onCreate,
  isCreating,
}: {
  isOpen: boolean;
  onClose: () => void;
  farmId: string | null;
  onCreate: (data: {
    farmId: string;
    name: string;
    type: string;
    breed?: string;
    quantity: number;
    unit: string;
    acquisitionDate: number;
    productionType?: string;
    acquisitionCost?: number;
    feedType?: string;
    dailyFeedCost?: number;
    lastVaccination?: number;
    nextVaccination?: number;
    lastCheckup?: number;
    initialHealthRecord?: {
      description: string;
      treatment: string;
      cost?: number;
    };
  }) => void;
  isCreating: boolean;
}) {
  const [step, setStep] = useState(0); // 0: basic, 1: cost, 2: health, 3: review
  const [name, setName] = useState("");
  const [type, setType] = useState("Cattle");
  const [breed, setBreed] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("head");
  const [productionType, setProductionType] = useState("");
  // Cost tracking
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [feedType, setFeedType] = useState("");
  const [dailyFeedCost, setDailyFeedCost] = useState("");
  // Vaccination scheduling
  const [lastVaccination, setLastVaccination] = useState("");
  const [nextVaccination, setNextVaccination] = useState("");
  const [lastCheckup, setLastCheckup] = useState("");
  // Initial health record
  const [hasInitialRecord, setHasInitialRecord] = useState(false);
  const [recordDescription, setRecordDescription] = useState("");
  const [recordTreatment, setRecordTreatment] = useState("");
  const [recordCost, setRecordCost] = useState("");

  if (!isOpen) return null;

  const resetForm = () => {
    setName("");
    setType("Cattle");
    setBreed("");
    setQuantity("1");
    setUnit("head");
    setProductionType("");
    setAcquisitionCost("");
    setFeedType("");
    setDailyFeedCost("");
    setLastVaccination("");
    setNextVaccination("");
    setLastCheckup("");
    setHasInitialRecord(false);
    setRecordDescription("");
    setRecordTreatment("");
    setRecordCost("");
    setStep(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const canProceedStep0 = name.trim() && quantity;
  const canProceedStep1 = true; // Cost fields are optional
  const canProceedStep2 = !hasInitialRecord || (recordDescription.trim() && recordTreatment.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !name || !quantity) return;

    const data: Parameters<typeof onCreate>[0] = {
      farmId,
      name,
      type,
      breed: breed || undefined,
      quantity: parseInt(quantity) || 1,
      unit,
      acquisitionDate: Date.now(),
      productionType: productionType || undefined,
    };

    if (acquisitionCost) data.acquisitionCost = parseFloat(acquisitionCost);
    if (feedType) data.feedType = feedType;
    if (dailyFeedCost) data.dailyFeedCost = parseFloat(dailyFeedCost);
    if (lastVaccination) data.lastVaccination = parseDateInput(lastVaccination);
    if (nextVaccination) data.nextVaccination = parseDateInput(nextVaccination);
    if (lastCheckup) data.lastCheckup = parseDateInput(lastCheckup);
    if (hasInitialRecord && recordDescription.trim() && recordTreatment.trim()) {
      data.initialHealthRecord = {
        description: recordDescription,
        treatment: recordTreatment,
        cost: recordCost ? parseFloat(recordCost) : undefined,
      };
    }

    onCreate(data);
    resetForm();
    onClose();
  };

  const steps = [
    { label: "Basic Info", icon: Beef },
    { label: "Cost & Feed", icon: DollarSign },
    { label: "Health & Vaccines", icon: Syringe },
    { label: "Review", icon: CheckCircle2 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Beef className="w-5 h-5 text-primary" />
              Add Livestock
            </h2>
            <button onClick={handleClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center gap-2 mt-4">
            {steps.map((s, i) => {
              const StepIcon = s.icon;
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                      i <= step
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < step ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-xs hidden sm:inline ${i === step ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && (
                    <div className={`w-4 h-px mx-1 ${i < step ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 min-h-[320px]">
            {/* Step 0: Basic Info */}
            {step === 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Information</h3>
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input placeholder="e.g., Holstein Dairy Herd" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Type *</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      required
                    >
                      <option value="Cattle">Cattle</option>
                      <option value="Poultry">Poultry</option>
                      <option value="Goat">Goat</option>
                      <option value="Sheep">Sheep</option>
                      <option value="Pig">Pig</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Breed</label>
                    <Input placeholder="e.g., Holstein" value={breed} onChange={(e) => setBreed(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Quantity *</label>
                    <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Unit</label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    >
                      <option value="head">head</option>
                      <option value="birds">birds</option>
                      <option value="pigs">pigs</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Production Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={productionType}
                    onChange={(e) => setProductionType(e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="milk">Milk</option>
                    <option value="meat">Meat</option>
                    <option value="eggs">Eggs</option>
                    <option value="wool">Wool</option>
                    <option value="breeding">Breeding</option>
                  </select>
                </div>
              </motion.div>
            )}

            {/* Step 1: Cost & Feed Tracking */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cost & Feed Tracking</h3>
                <div>
                  <label className="text-sm font-medium">Acquisition Cost (KES)</label>
                  <Input type="number" min="0" placeholder="e.g., 50000" value={acquisitionCost} onChange={(e) => setAcquisitionCost(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Total cost of purchasing/acquiring this livestock</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Feed Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={feedType}
                    onChange={(e) => setFeedType(e.target.value)}
                  >
                    <option value="">Select feed type</option>
                    <option value="commercial">Commercial Feed</option>
                    <option value="natural">Natural/Pasture</option>
                    <option value="mixed">Mixed</option>
                    <option value="silage">Silage</option>
                    <option value="hay">Hay</option>
                    <option value="grains">Grains</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Daily Feed Cost (KES)</label>
                  <Input type="number" min="0" step="0.01" placeholder="e.g., 500" value={dailyFeedCost} onChange={(e) => setDailyFeedCost(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Estimated daily feed cost per unit</p>
                </div>
              </motion.div>
            )}

            {/* Step 2: Health & Vaccination Scheduling */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Health & Vaccination Schedule</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Last Vaccination Date</label>
                    <Input type="date" value={lastVaccination} onChange={(e) => setLastVaccination(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Next Vaccination Date</label>
                    <Input type="date" value={nextVaccination} onChange={(e) => setNextVaccination(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Last Checkup Date</label>
                  <Input type="date" value={lastCheckup} onChange={(e) => setLastCheckup(e.target.value)} />
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id="hasInitialRecord"
                      checked={hasInitialRecord}
                      onChange={(e) => setHasInitialRecord(e.target.checked)}
                      className="rounded border-input"
                    />
                    <label htmlFor="hasInitialRecord" className="text-sm font-medium">Add initial health record</label>
                  </div>

                  {hasInitialRecord && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 pl-6 border-l-2 border-primary/20"
                    >
                      <div>
                        <label className="text-sm font-medium">Description *</label>
                        <Input placeholder="e.g., Initial health assessment" value={recordDescription} onChange={(e) => setRecordDescription(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Treatment / Notes *</label>
                        <Input placeholder="e.g., All animals in good health, dewormed" value={recordTreatment} onChange={(e) => setRecordTreatment(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Cost (KES)</label>
                        <Input type="number" min="0" placeholder="e.g., 5000" value={recordCost} onChange={(e) => setRecordCost(e.target.value)} />
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Review & Confirm</h3>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Beef className="w-4 h-4 text-amber-500" />
                      Basic Info
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Name:</span><span>{name}</span>
                      <span className="text-muted-foreground">Type:</span><span>{type}</span>
                      {breed && <><span className="text-muted-foreground">Breed:</span><span>{breed}</span></>}
                      <span className="text-muted-foreground">Quantity:</span><span>{quantity} {unit}</span>
                      {productionType && <><span className="text-muted-foreground">Production:</span><span className="capitalize">{productionType}</span></>}
                    </div>
                  </div>

                  {(acquisitionCost || feedType || dailyFeedCost) && (
                    <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        Cost & Feed
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {acquisitionCost && <><span className="text-muted-foreground">Acquisition Cost:</span><span>KES {parseFloat(acquisitionCost).toLocaleString()}</span></>}
                        {feedType && <><span className="text-muted-foreground">Feed Type:</span><span className="capitalize">{feedType}</span></>}
                        {dailyFeedCost && <><span className="text-muted-foreground">Daily Feed Cost:</span><span>KES {parseFloat(dailyFeedCost).toLocaleString()}</span></>}
                      </div>
                    </div>
                  )}

                  {(lastVaccination || nextVaccination || lastCheckup || hasInitialRecord) && (
                    <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Syringe className="w-4 h-4 text-blue-500" />
                        Health & Vaccinations
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {lastVaccination && <><span className="text-muted-foreground">Last Vaccination:</span><span>{formatDate(parseDateInput(lastVaccination))}</span></>}
                        {nextVaccination && <><span className="text-muted-foreground">Next Vaccination:</span><span>{formatDate(parseDateInput(nextVaccination))}</span></>}
                        {lastCheckup && <><span className="text-muted-foreground">Last Checkup:</span><span>{formatDate(parseDateInput(lastCheckup))}</span></>}
                        {hasInitialRecord && (
                          <>
                            <span className="text-muted-foreground">Initial Record:</span>
                            <span>{recordDescription}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border flex gap-3">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                type="button"
                className="flex-1 gradient-primary"
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 0 && !canProceedStep0) ||
                  (step === 2 && !canProceedStep2)
                }
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button type="submit" className="flex-1 gradient-primary" disabled={isCreating || !name}>
                {isCreating ? "Adding..." : "Add Livestock"}
              </Button>
            )}
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
