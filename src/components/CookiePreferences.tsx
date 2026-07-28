import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Cookie,
  Shield,
  BarChart3,
  Megaphone,
  User,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import {
  useCookieConsent,
  COOKIE_CATEGORIES,
} from "@/hooks/use-cookie-consent";

// ============================================================
// Category Icons & Colors
// ============================================================

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  necessary: Shield,
  analytics: BarChart3,
  marketing: Megaphone,
  personalization: User,
};

const categoryColors: Record<string, string> = {
  necessary: "bg-green-500/10 text-green-600",
  analytics: "bg-blue-500/10 text-blue-600",
  marketing: "bg-purple-500/10 text-purple-600",
  personalization: "bg-amber-500/10 text-amber-600",
};

// ============================================================
// Cookie Preferences Modal
// ============================================================

export function CookiePreferencesModal() {
  const {
    consent,
    showPreferences,
    closePreferences,
    savePreferences,
    acceptAll,
    rejectAll,
  } = useCookieConsent();

  const [localPrefs, setLocalPrefs] = useState({
    necessary: true,
    analytics: consent.analytics,
    marketing: consent.marketing,
    personalization: consent.personalization,
  });

  useEffect(() => {
    setLocalPrefs({
      necessary: true,
      analytics: consent.analytics,
      marketing: consent.marketing,
      personalization: consent.personalization,
    });
  }, [consent, showPreferences]);

  const handleToggle = (categoryId: string) => {
    if (categoryId === "necessary") return;
    setLocalPrefs((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId as keyof typeof prev],
    }));
  };

  const handleSave = () => {
    savePreferences(localPrefs);
  };

  const handleAcceptAll = () => {
    setLocalPrefs({
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true,
    });
    acceptAll();
  };

  return (
    <Dialog open={showPreferences} onOpenChange={(open) => !open && closePreferences()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Cookie className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Cookie Preferences</DialogTitle>
              <DialogDescription>
                Manage your cookie settings and privacy preferences
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
            <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground mb-1">Your privacy matters</p>
              <p>
                We use cookies to improve your farming experience. You can customize which
                cookies you allow below. Necessary cookies are always active as they are
                essential for the platform to function.
              </p>
            </div>
          </div>

          {/* Cookie categories */}
          <div className="space-y-3">
            {COOKIE_CATEGORIES.map((category) => {
              const Icon = categoryIcons[category.id] || Cookie;
              const colorClass = categoryColors[category.id] || "bg-muted text-muted-foreground";
              const isEnabled = localPrefs[category.id as keyof typeof localPrefs];

              return (
                <motion.div
                  key={category.id}
                  layout
                  className={`p-4 rounded-xl border transition-colors ${
                    isEnabled
                      ? "border-primary/20 bg-primary/5"
                      : "border-border/50 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-xl ${colorClass} shrink-0`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold">{category.label}</h4>
                          {category.required && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Always Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                          {category.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {category.examples.map((example, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80 bg-muted/50 px-2 py-0.5 rounded-full"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 text-primary/60" />
                              {example}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggle(category.id)}
                      disabled={category.required}
                      className="mt-1 shrink-0"
                      aria-label={`Toggle ${category.label}`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Last updated */}
          {consent.timestamp && (
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Last updated:{" "}
              {new Date(consent.timestamp).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={rejectAll} className="flex-1 sm:flex-none">
              Reject All
            </Button>
            <Button variant="outline" onClick={handleAcceptAll} className="flex-1 sm:flex-none">
              Accept All
            </Button>
          </div>
          <Button onClick={handleSave} className="gradient-primary flex-1 sm:flex-none">
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Cookie Consent Banner
// ============================================================

export function CookieConsentBanner() {
  const { showBanner, acceptAll, rejectAll, openPreferences } = useCookieConsent();

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
        >
          <div className="max-w-4xl mx-auto">
            <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
                    <Cookie className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">We value your privacy</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      We use cookies to enhance your farming experience, analyze platform
                      usage, and assist in our marketing efforts. You can customize your
                      preferences or accept/reject all cookies.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                  <Button variant="outline" size="sm" onClick={rejectAll}>
                    Reject All
                  </Button>
                  <Button variant="outline" size="sm" onClick={openPreferences}>
                    Customize
                  </Button>
                  <Button size="sm" onClick={acceptAll} className="gradient-primary">
                    Accept All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Cookie Settings Button
// ============================================================

export function CookieSettingsButton({
  variant = "ghost",
  size = "sm",
  className = "",
}: {
  variant?: "ghost" | "outline" | "link";
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const { openPreferences } = useCookieConsent();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={openPreferences}
      className={className}
    >
      <Cookie className="w-4 h-4 mr-1.5" />
      Cookie Settings
    </Button>
  );
}
