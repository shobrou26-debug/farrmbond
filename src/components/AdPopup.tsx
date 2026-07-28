import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  ExternalLink,
  Sparkles,
  Star,
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
      "Get unlimited AI assistant queries, satellite monitoring, and advanced analytics for just $5/month.",
    ctaText: "Upgrade Now",
    ctaUrl: "/settings?tab=subscription",
    gradient: "from-emerald-500 to-green-600",
    icon: Crown,
    badge: "Special Offer",
    badgeColor: "bg-amber-500/20 text-amber-700",
    features: ["Unlimited AI Queries", "Satellite NDVI Monitoring", "Priority Support"],
  },
  {
    id: "demo_seed_supplier",
    adType: "sponsor" as const,
    title: "Premium Seeds for Every Season",
    description:
      "Discover high-yield seed varieties from AgriSeeds Co. Perfect for East African climates.",
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
    title: "🌧️ Rainy Season Special — 20% Off",
    description:
      "Prepare your farm for the rainy season with our exclusive irrigation equipment sale.",
    ctaText: "View Deals",
    ctaUrl: "#",
    gradient: "from-purple-500 to-pink-600",
    icon: Percent,
    badge: "Limited Time",
    badgeColor: "bg-purple-500/20 text-purple-700",
    features: ["Drip Irrigation Kits", "Water Pumps", "Scheduling Systems"],
  },
  {
    id: "demo_insurance",
    adType: "cross_sell" as const,
    title: "Protect Your Farm with Insurance",
    description:
      "Get comprehensive crop and livestock insurance starting at just $2/month.",
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
// Ad Popup Component
// ============================================================

export function AdPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [currentAd, setCurrentAd] = useState<any>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Query backend ads
  const backendAds = useQuery(api.ads?.getActiveAds, user ? {} : "skip");
  const recordImpression = useMutation(api.ads?.recordImpression);

  // Determine which ads to show
  const ads =
    backendAds && backendAds.length > 0 ? backendAds : demoAds;

  // Smart ad selection logic
  const selectAd = useCallback(() => {
    if (!ads || ads.length === 0) return null;

    // Randomly select an ad with weighted priority
    const weights = ads.map((ad: any) => ad.priority || 1);
    const totalWeight = weights.reduce((sum: number, w: number) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < ads.length; i++) {
      random -= weights[i];
      if (random <= 0) return ads[i];
    }

    return ads[0];
  }, [ads]);

  // Show popup after delay (30 seconds after page load)
  useEffect(() => {
    if (!user) return;

    // Check if user has seen an ad recently (stored in sessionStorage)
    const lastAdTime = sessionStorage.getItem("farmbond_last_ad_time");
    const now = Date.now();
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes cooldown

    if (lastAdTime && now - parseInt(lastAdTime) < cooldownPeriod) {
      return;
    }

    const timer = setTimeout(() => {
      const ad = selectAd();
      if (ad) {
        setCurrentAd(ad);
        setIsOpen(true);
        sessionStorage.setItem("farmbond_last_ad_time", now.toString());

        // Record impression if backend ad (has _id from Convex)
        if ("_id" in ad && ad._id && recordImpression) {
          recordImpression({ adId: (ad as any)._id }).catch(console.error);
        }
      }
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, [user, selectAd, recordImpression]);

  // Close handler with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      setCurrentAd(null);
    }, 300);
  }, []);

  // CTA handler
  const handleCta = useCallback(() => {
    if (currentAd?.ctaUrl) {
      if (currentAd.ctaUrl.startsWith("http")) {
        window.open(currentAd.ctaUrl, "_blank", "noopener,noreferrer");
      } else {
        navigate(currentAd.ctaUrl);
      }
    }
    handleClose();
  }, [currentAd, navigate, handleClose]);

  if (!currentAd) return null;

  const config = adTypeConfigs[currentAd.adType] || adTypeConfigs.sponsor;
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isClosing ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Popup Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{
              opacity: isClosing ? 0 : 1,
              scale: isClosing ? 0.95 : 1,
              y: isClosing ? 10 : 0,
            }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Gradient */}
              <div
                className={cn(
                  "relative h-32 bg-gradient-to-br flex items-center justify-center",
                  currentAd.gradient || config.gradient
                )}
              >
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors"
                  aria-label="Close ad"
                >
                  <X className="w-4 h-4 text-white" />
                </button>

                {/* Badge */}
                <div className="absolute top-3 left-3">
                  <Badge
                    className={cn(
                      "border-0 text-[10px] font-semibold",
                      currentAd.badgeColor || config.badgeColor
                    )}
                  >
                    {currentAd.badge || config.badgeLabel}
                  </Badge>
                </div>

                {/* Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm"
                >
                  <Icon className="w-10 h-10 text-white" />
                </motion.div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold tracking-tight">
                    {currentAd.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentAd.description}
                  </p>
                </div>

                {/* Features */}
                {currentAd.features && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {currentAd.features.map((feature: string, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                      >
                        <Badge
                          variant="secondary"
                          className="text-xs"
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          {feature}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Sponsor Name */}
                {currentAd.sponsorName && (
                  <p className="text-center text-xs text-muted-foreground">
                    by <span className="font-medium">{currentAd.sponsorName}</span>
                  </p>
                )}

                {/* CTA Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Button
                    onClick={handleCta}
                    className={cn(
                      "w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r text-white shadow-lg hover:shadow-xl transition-shadow",
                      currentAd.gradient || config.gradient
                    )}
                  >
                    {currentAd.ctaText}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>

                {/* Dismiss */}
                <button
                  onClick={handleClose}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  No thanks, maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </>
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

  // Rotate ad every 30 seconds
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
      {/* Header */}
      <div className={cn("h-2 bg-gradient-to-r", currentAd.gradient || config.gradient)} />

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br shrink-0", currentAd.gradient || config.gradient)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn("text-[9px] border-0 px-1.5 py-0", currentAd.badgeColor || config.badgeColor)}>
                {currentAd.badge || config.badgeLabel}
              </Badge>
            </div>
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
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{currentAd.title}</h4>
            <Badge className={cn("text-[9px] border-0 px-1.5 py-0", currentAd.badgeColor || config.badgeColor)}>
              {currentAd.badge || config.badgeLabel}
            </Badge>
          </div>
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
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}

export default AdPopup;
