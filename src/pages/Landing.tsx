import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useTheme, getLastLightTheme } from "@/hooks/use-theme";
import { CookieSettingsButton } from "@/components/CookiePreferences";
import {
  Sprout,
  Leaf,
  Cloud,
  Bot,
  BarChart3,
  Map,
  Shield,
  Users,
  ArrowRight,
  Check,
  Globe,
  Smartphone,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";

// ============================================================
// Hero carousel slides (decorative landscape photography)
// ============================================================

const heroSlides = [
  {
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2400&auto=format&fit=crop",
    caption: "Renewable-powered farmland",
  },
  {
    image:
      "https://images.unsplash.com/photo-1466611653911-95081537e5b7?q=80&w=2400&auto=format&fit=crop",
    caption: "Wind turbines over green fields",
  },
  {
    image:
      "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=2400&auto=format&fit=crop",
    caption: "Golden harvest season",
  },
];

// ============================================================
// Navigation
// ============================================================

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // One theme system app-wide: reuse the existing six-theme preference
  // system (dark-farm is the dark theme) instead of a separate dark-class
  // toggle, so Landing stays in sync with the app header and Settings.
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark-farm";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    // Same behavior as the app header: toggling back from Dark Farm restores
    // the user's previous light theme rather than resetting to the default.
    setTheme(isDark ? getLastLightTheme() : "dark-farm");
  };

  const overHero = !scrolled;

  const navLinks = [
    { label: "Features", to: "#features", internal: false },
    { label: "Pricing", to: "#pricing", internal: false },
    { label: "Built for Farmers", to: "#built-for-farmers", internal: false },
    { label: "About", to: "/about", internal: true },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        overHero ? "bg-transparent" : "bg-background/90 backdrop-blur-xl border-b border-border shadow-sm"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex h-16 md:h-20 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand shadow-md transition-transform group-hover:scale-105">
              <Sprout className="h-5 w-5 text-brand-foreground" />
            </div>
            <span
              className={`text-xl font-bold tracking-tight ${
                overHero ? "text-white" : "text-foreground"
              }`}
            >
              FarmBond
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.internal ? (
                <Link
                  key={link.label}
                  to={link.to}
                  className={`text-sm transition-colors ${
                    overHero
                      ? "text-white/85 hover:text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.to}
                  className={`text-sm transition-colors ${
                    overHero
                      ? "text-white/85 hover:text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </a>
              ),
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={overHero ? "text-white hover:bg-white/10 hover:text-white" : ""}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Link to="/auth" className="hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                className={
                  overHero
                    ? "text-white hover:bg-white/10 hover:text-white"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <span className="inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/30">
                Get Started
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className={`md:hidden ${overHero ? "text-white hover:bg-white/10 hover:text-white" : ""}`}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden rounded-2xl border border-border bg-background/95 backdrop-blur-xl px-4 py-4 mb-3 shadow-lg"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((link) =>
                link.internal ? (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.to}
                    className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                ),
              )}
              <Link
                to="/auth"
                className="mt-2 rounded-full bg-brand px-4 py-2.5 text-center text-sm font-semibold text-brand-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
}

// ============================================================
// Hero Section
// ============================================================

function HeroSection() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % heroSlides.length), 7000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      {/* Photo backgrounds with crossfade */}
      {heroSlides.map((slide, i) => (
        <img
          key={slide.image}
          src={slide.image}
          alt=""
          aria-hidden={i !== active}
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1400ms] ease-out ${
            i === active ? "scale-105 opacity-100" : "scale-100 opacity-0"
          }`}
        />
      ))}

      {/* Readability overlays */}
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/45" />

      {/* Hero content */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pt-28 pb-28">
        <div className="flex flex-1 flex-col justify-center pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-brand/60 bg-black/30 px-4 py-1.5 text-sm font-medium text-brand backdrop-blur-sm"
          >
            <span aria-hidden>◆</span>
            Future-Ready Farming
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl xl:text-7xl"
          >
            Smart. <span className="text-brand">Sustainable.</span>
            <br />
            <span className="text-brand">Future-Ready</span> Farming.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-white/85 md:text-xl"
          >
            Harnessing AI, satellite intelligence, and climate-smart agronomy with a rural
            vision — unlocking productivity &amp; profitability while protecting the planet.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex items-center gap-4"
          >
            <Link
              to="/auth"
              className="inline-flex h-12 items-center rounded-full bg-white px-8 text-base font-semibold text-black transition-all hover:bg-white/90 hover:shadow-xl"
            >
              Get Started
            </Link>
            <Link
              to="/auth"
              aria-label="Get started with FarmBond"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:shadow-xl"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Bottom controls: carousel dashes + thumbnails */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto flex w-full max-w-7xl items-end justify-between px-6 pb-7">
          <div className="flex items-center gap-2.5" role="tablist" aria-label="Hero slides">
            {heroSlides.map((slide, i) => (
              <button
                key={slide.image}
                role="tab"
                aria-selected={i === active}
                aria-label={`Show slide: ${slide.caption}`}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === active ? "w-12 bg-white" : "w-7 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {heroSlides.map((slide, i) => (
              <button
                key={slide.image}
                onClick={() => setActive(i)}
                aria-label={`Show slide: ${slide.caption}`}
                className={`h-14 w-20 overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                  i === active
                    ? "border-brand opacity-100 shadow-lg"
                    : "border-white/30 opacity-60 hover:opacity-100"
                }`}
              >
                <img src={slide.image} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Capability Strip (honest feature labels, no fake claims)
// ============================================================

const capabilities = [
  "Satellite Monitoring",
  "Weather Intelligence",
  "AI Farming Assistant",
  "Crop & Livestock Management",
  "Market Prices",
  "Farm Finances",
  "Irrigation Planning",
  "Community & Agronomists",
];

function CapabilityStrip() {
  return (
    <section className="border-b border-border/70 bg-background py-5">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          {capabilities.map((item) => (
            <span
              key={item}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Features Section
// ============================================================

const features = [
  {
    icon: Bot,
    title: "AI Farming Assistant",
    description: "Get personalized advice on crop health, pest control, and farming best practices powered by advanced AI.",
  },
  {
    icon: Cloud,
    title: "Weather Intelligence",
    description: "Real-time weather forecasts with agricultural-specific alerts for planting, irrigation, and harvesting.",
  },
  {
    icon: Map,
    title: "Satellite Monitoring",
    description: "NDVI vegetation analysis and satellite imagery to monitor crop health across your farms.",
  },
  {
    icon: BarChart3,
    title: "Farm Analytics",
    description: "Comprehensive dashboards tracking revenue, expenses, yield predictions, and farm performance.",
  },
  {
    icon: Leaf,
    title: "Crop Management",
    description: "Track planting, growth stages, health scores, and harvest predictions for all your crops.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Enterprise-grade security with encrypted data storage and role-based access control.",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 bg-brand-soft/40 dark:bg-brand-soft/10">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="mb-4 inline-flex items-center rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-sm font-medium text-brand-foreground dark:text-brand">
              Features
            </span>
            <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              Everything You Need to <span className="text-brand">Succeed</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              A complete agricultural operating system designed to help you grow smarter and harvest more.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group rounded-2xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand-foreground transition-transform group-hover:scale-110 dark:text-brand">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Pricing Section
// ============================================================

const plans = [
  {
    name: "Free",
    price: "0",
    period: "forever",
    description: "Perfect for small farms getting started",
    features: [
      "1 farm",
      "5 crops",
      "5 livestock entries",
      "Basic weather",
      "Community access",
      "Limited AI (5/day)",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "5",
    period: "month",
    description: "For serious farmers who want to grow",
    features: [
      "Unlimited farms",
      "Unlimited crops & livestock",
      "Satellite monitoring",
      "Unlimited AI assistant",
      "Advanced analytics",
      "PDF & Excel exports",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    popular: true,
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="mb-4 inline-flex items-center rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-sm font-medium text-brand-foreground dark:text-brand">
              Pricing
            </span>
            <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              Simple, <span className="text-brand">Transparent</span> Pricing
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Start free and upgrade as your farm grows. No hidden fees.
            </p>
          </motion.div>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border bg-card p-8 ${
                plan.popular
                  ? "border-brand shadow-xl ring-1 ring-brand/30"
                  : "border-border/60"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-xs font-bold text-brand-foreground">
                  Most Popular
                </span>
              )}
              <h3 className="mb-1 text-xl font-bold">{plan.name}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/{plan.period}</span>
              </div>
              <ul className="mb-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-brand" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block">
                <Button
                  className={`w-full rounded-full ${
                    plan.popular
                      ? "bg-brand text-brand-foreground hover:bg-brand/90"
                      : ""
                  }`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Built for Farmers Section
// ============================================================

// Data honesty: capability cards describing what FarmBond is designed
// to help farmers accomplish. No customer testimonials, names, or
// invented results — real user stories will be added only when they
// exist and can be verified.
const farmerOutcomes = [
  {
    icon: Leaf,
    title: "Spot Crop Problems Early",
    description: "Use AI-assisted diagnosis and satellite vegetation analysis to identify crop stress, disease, and pest issues before they spread.",
  },
  {
    icon: Cloud,
    title: "Plan Around the Weather",
    description: "Access real-time forecasts and agricultural alerts for planting, irrigation, and harvesting — tuned to your farm's location.",
  },
  {
    icon: BarChart3,
    title: "Track Costs & Income",
    description: "Record expenses, sales, and yields so you can see what's working financially and plan the next season with real numbers.",
  },
  {
    icon: Bot,
    title: "Get Answers Anytime",
    description: "Ask the AI farming assistant questions about crops, livestock, and best practices — day or night.",
  },
  {
    icon: Users,
    title: "Connect with Agronomists",
    description: "Find reviewed agronomists, book consultations, and get expert advice tailored to your farm.",
  },
  {
    icon: Map,
    title: "Keep Every Farm Organized",
    description: "Manage crops, livestock, irrigation, and calendar events for all your farms in one place.",
  },
];

function BuiltForFarmersSection() {
  return (
    <section id="built-for-farmers" className="py-24 bg-brand-soft/40 dark:bg-brand-soft/10">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="mb-4 inline-flex items-center rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-sm font-medium text-brand-foreground dark:text-brand">
              Built for Farmers
            </span>
            <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              What FarmBond <span className="text-brand">Helps You Do</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              FarmBond is designed to help farmers make better decisions with better information.
            </p>
          </motion.div>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {farmerOutcomes.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-border/60 bg-card p-6 transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand-foreground dark:text-brand">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CTA Section
// ============================================================

function CTASection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-brand-deep p-12 text-center text-white md:p-16"
        >
          <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-brand/20" />
          <div className="relative">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Ready to Transform Your Farm?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-white/80">
              Start farming smarter. Track your crops, plan around the weather, and get expert
              help when you need it — all in one place.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/auth">
                <span className="inline-flex h-12 items-center rounded-full bg-white px-8 text-base font-semibold text-brand-deep transition-all hover:bg-white/90 hover:shadow-xl">
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </span>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================
// Footer
// ============================================================

function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-8 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
                <Sprout className="h-4 w-4 text-brand-foreground" />
              </div>
              <span className="font-bold">FarmBond</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered smart farming for a sustainable future.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="transition-colors hover:text-foreground">Features</a></li>
              <li><a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="transition-colors hover:text-foreground">About</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link></li>
              <li><Link to="/terms" className="transition-colors hover:text-foreground">Terms</Link></li>
              <li><Link to="/security" className="transition-colors hover:text-foreground">Security</Link></li>
              <li>
                <CookieSettingsButton variant="link" size="sm" className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground" />
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 FarmBond. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================
// Main Landing Page
// ============================================================

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <CapabilityStrip />
      <FeaturesSection />
      <PricingSection />
      <BuiltForFarmersSection />
      <CTASection />
      <Footer />
    </div>
  );
}
