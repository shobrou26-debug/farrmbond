import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  X,
  Sparkles,
  TrendingUp,
  Megaphone,
  Crown,
  ArrowRight,
  Zap,
  Gift,
  Percent,
  Shield,
  Sprout,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Ad Type Configurations
// ============================================================

interface AdConfig {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  badgeColor: string;
  badgeLabel: string;
}

const adTypeConfigs: Record<string, AdConfig> = {
  pro_upgrade: {
    icon: Crown,
    gradient: "from-emerald-500 to-green-600",
    badgeColor: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    badgeLabel: "Upgrade",
  },
  sponsor: {
    icon: Megaphone,
    gradient: "from-blue-500 to-indigo-600",
    badgeColor: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    badgeLabel: "Sponsored",
  },
  seasonal: {
    icon: Gift,
    gradient: "from-purple-500 to-pink-600",
    badgeColor: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
    badgeLabel: "Limited Time",
  },
  cross_sell: {
    icon: Zap,
    gradient: "from-orange-500 to-red-600",
    badgeColor: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    badgeLabel: "Recommended",
  },
};

// ============================================================
// Fallback Demo Ads (shown when no backend ads exist)
// ============================================================

const demoAds = [
  {
    id: "demo_pro_upgrade",
    adType: "pro_upgrade" as const,
    title: "Unlock FarmBond Pro",
    description:
      "Get unlimited AI assistant, satellite monitoring, and advanced analytics for just $5/month.",
    ctaText: "Upgrade Now",
    ctaUrl: "/settings?tab=subscription",
    gradient: "from-emerald-500 to-green-600",
    icon: Crown,
    badge: "Special Offer",
    badgeColor: "bg-amber-500/20 text-amber-700",
    features: ["Unlimited AI Queries", "Satellite NDVI", "Priority Support"],
  },
  {
    id: "demo_seed_supplier",
    adType: "sponsor" as const,
    title: "Premium Seeds for Every Season",
    description:
      "High-yield seed varieties from AgriSeeds Co. Perfect for East African climates.",
    ctaText: "Shop Seeds",
    ctaUrl: "#",
    gradient: "from-blue-500 to-indigo-600",
    icon: Sprout,
    badge: "Sponsored",
    badgeColor: "bg-blue-500/20 text-blue-700",
    sponsorName: "AgriSeeds Co.",
    features: ["Certified Seeds", "Climate-Resistant", "Free Delivery"],
  },
  {
    id: "demo_fertilizer",
    adType: "sponsor" as const,
    title: "Boost Your Harvest by 40%",
    description:
      "GreenGrow fertilizers are scientifically formulated for maximum crop yield.",
    ctaText: "Learn More",
    ctaUrl: "#",
    gradient: "from-green-500 to-emerald-600",
    icon: TrendingUp,
    badge: "Sponsored",
    badgeColor: "bg-green-500/20 text-green-700",
    sponsorName: "GreenGrow Fertilizers",
    features: ["Organic Options", "Lab Tested", "Bulk Discounts"],
  },
  {
    id: "demo_seasonal",
    adType: "seasonal" as const,
    title: "Rainy Season Special — 20% Off",
    description:
      "Prepare your farm with our exclusive irrigation equipment sale.",
    ctaText: "View Deals",
    ctaUrl: "#",
    gradient: "from-purple-500 to-pink-600",
    icon: Percent,
    badge: "Limited Time",
    badgeColor: "bg-purple-500/20 text-purple-700",
    features: ["Drip Irrigation Kits", "Water Pumps", "Scheduling"],
  },
  {
    id: "demo_insurance",
    adType: "cross_sell" as const,
    title: "Protect Your Farm with Insurance",
    description:
      "Comprehensive crop and livestock insurance starting at just $2/month.",
    ctaText: "Get Protected",
    ctaUrl: "#",
    gradient: "from-orange-500 to-red-600",
    icon: Shield,
    badge: "Recommended",
    badgeColor: "bg-orange-500/20 text-orange-700",
    sponsorName: "FarmShield Insurance",
    features: ["Weather Protection", "Pest Coverage", "Fast Claims"],
  },
];

// ============================================================
// Top Banner Ad Component (auto-dismisses after 30 seconds)
// ============================================================

export function AdPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [currentAd, setCurrentAd] = useState<any>(null);
  const [progress, setProgress] = useState(100);

  // Query backend ads
  const backendAds = useQuery(api.ads?.getActiveAds, user ? {} : "skip");
  const recordImpression = useMutation(api.ads?.recordImpression);

  // Determine which ads to show
  const ads = backendAds && backendAds.length > 0 ? backendAds : demoAds;

  // Show banner after 30 seconds
  useEffect(() => {
    if (!user) return;

    const lastAdTime = sessionStorage.getItem("farmbond_last_ad_time");
    const now = Date.now();
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes cooldown

    if (lastAdTime && now - parseInt(lastAdTime) < cooldownPeriod) {
      return;
    }

    const timer = setTimeout(() => {
      if (!ads || ads.length === 0) return;
      const idx = Math.floor(Math.random() * ads.length);
      const ad = ads[idx];
      setCurrentAd(ad);
      setIsVisible(true);
      sessionStorage.setItem("farmbond_last_ad_time", now.toString());

      // Record impression if backend ad
      if ("_id" in ad && ad._id && recordImpression) {
        recordImpression({ adId: (ad as any)._id }).catch(console.error);
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [user, ads, recordImpression]);

  // Auto-dismiss after 30 seconds with progress bar
  useEffect(() => {
    if (!isVisible) return;

    const duration = 30000;
    const interval = 100;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += interval;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));

      if (elapsed >= duration) {
        clearInterval(timer);
        setIsVisible(false);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isVisible]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleCta = useCallback(() => {
    if (currentAd?.ctaUrl) {
      if (currentAd.ctaUrl.startsWith("http")) {
        window.open(currentAd.ctaUrl, "_blank", "noopener,noreferrer");
      } else {
        navigate(currentAd.ctaUrl);
      }
    }
    setIsVisible(false);
  }, [currentAd, navigate]);

  if (!currentAd) return null;

  const config = adTypeConfigs[currentAd.adType] || adTypeConfigs.sponsor;
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] pointer-events-auto"
        >
          {/* Progress bar at top */}
          <div className="h-1 bg-black/10">
            <motion.div
              className={cn("h-full bg-gradient-to-r", currentAd.gradient || config.gradient)}
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 30, ease: "linear" }}
            />
          </div>

          {/* Banner content */}
          <div
            className={cn(
              "bg-gradient-to-r shadow-lg border-b",
              currentAd.gradient || config.gradient
            )}
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
              {/* Icon */}
              <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
                <Icon className="w-5 h-5 text-white" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white truncate">
                    {currentAd.title}
                  </h4>
                  <span className="hidden sm:inline text-[10px] font-medium text-white/70 bg-white/20 px-2 py-0.5 rounded-full">
                    {currentAd.badge || config.badgeLabel}
                  </span>
                </div>
                <p className="text-xs text-white/80 truncate mt-0.5">
                  {currentAd.description}
                </p>
              </div>

              {/* CTA */}
              <Button
                size="sm"
                className="shrink-0 bg-white text-foreground hover:bg-white/90 font-semibold shadow-md"
                onClick={handleCta}
              >
                {currentAd.ctaText}
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>

              {/* Close */}
              <button
                onClick={handleClose}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                aria-label="Close ad"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Sidebar Ad Banner (non-intrusive)
// ============================================================

export function SidebarAdBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentAd, setCurrentAd] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const backendAds = useQuery(api.ads?.getActiveAds, user ? {} : "skip");
  const ads = backendAds && backendAds.length > 0 ? backendAds : demoAds;

  useEffect(() => {
    if (isDismissed || !ads || ads.length === 0) return;

    const selectRandomAd = () => {
      const idx = Math.floor(Math.random() * ads.length);
      setCurrentAd(ads[idx]);
    };

    selectRandomAd();
    const interval = setInterval(selectRandomAd, 30000);
    return () => clearInterval(interval);
  }, [ads, isDismissed]);

  if (isDismissed || !currentAd) return null;

  const config = adTypeConfigs[currentAd.adType] || adTypeConfigs.sponsor;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className={cn("h-2 bg-gradient-to-r", currentAd.gradient || config.gradient)} />

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br shrink-0", currentAd.gradient || config.gradient)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold leading-tight line-clamp-1">
              {currentAd.title}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {currentAd.description}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className={cn("flex-1 h-8 text-xs font-semibold text-white bg-gradient-to-r", currentAd.gradient || config.gradient)}
            onClick={() => {
              if (currentAd.ctaUrl?.startsWith("http")) {
                window.open(currentAd.ctaUrl, "_blank");
              } else {
                navigate(currentAd.ctaUrl || "/");
              }
            }}
          >
            {currentAd.ctaText}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setIsDismissed(true)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Inline Ad Banner (for page content)
// ============================================================

export function InlineAdBanner({ className }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentAd, setCurrentAd] = useState<any>(null);

  const backendAds = useQuery(api.ads?.getActiveAds, user ? {} : "skip");
  const ads = backendAds && backendAds.length > 0 ? backendAds : demoAds;

  useEffect(() => {
    if (!ads || ads.length === 0) return;
    const idx = Math.floor(Math.random() * ads.length);
    setCurrentAd(ads[idx]);
  }, [ads]);

  if (!currentAd) return null;

  const config = adTypeConfigs[currentAd.adType] || adTypeConfigs.sponsor;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-r from-muted/30 to-muted/50",
        className
      )}
    >
      <div className="flex items-center gap-4 p-4">
        <div className={cn("flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br shrink-0", currentAd.gradient || config.gradient)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold">{currentAd.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {currentAd.description}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => {
            if (currentAd.ctaUrl?.startsWith("http")) {
              window.open(currentAd.ctaUrl, "_blank");
            } else {
              navigate(currentAd.ctaUrl || "/");
            }
          }}
        >
          {currentAd.ctaText}
        </Button>
      </div>
    </motion.div>
  );
}

export default AdPopup;
