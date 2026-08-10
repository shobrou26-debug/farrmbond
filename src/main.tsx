import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { PWAInstallPrompt, OfflineBanner } from "@/components/PWAInstallPrompt";
import { LanguageProvider } from "@/hooks/use-language";
import { ThemeApplier } from "@/hooks/use-theme";
import { AnalyticsScripts, MarketingScripts, PersonalizationScripts } from "@/components/ConsentGate";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";

// ============================================================
// Lazy loaded route components for code splitting
// ============================================================
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Farms = lazy(() => import("./pages/Farms.tsx"));
const FarmRegistration = lazy(() => import("./pages/FarmRegistration.tsx"));
const Crops = lazy(() => import("./pages/Crops.tsx"));
const Livestock = lazy(() => import("./pages/Livestock.tsx"));
const Weather = lazy(() => import("./pages/Weather.tsx"));
const AIAssistant = lazy(() => import("./pages/AIAssistant.tsx"));
const Finances = lazy(() => import("./pages/Finances.tsx"));
const Analytics = lazy(() => import("./pages/Analytics.tsx"));
const Community = lazy(() => import("./pages/Community.tsx"));
const AgronomistMarketplace = lazy(() => import("./pages/AgronomistMarketplace.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const DiseaseDetection = lazy(() => import("./pages/DiseaseDetection.tsx"));
const FarmCalendar = lazy(() => import("./pages/Calendar.tsx"));
const Irrigation = lazy(() => import("./pages/Irrigation.tsx"));
const YieldPrediction = lazy(() => import("./pages/YieldPrediction.tsx"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase.tsx"));
const FarmComparison = lazy(() => import("./pages/FarmComparison.tsx"));
const WeatherAlerts = lazy(() => import("./pages/WeatherAlerts.tsx"));
const AuditLog = lazy(() => import("./pages/AuditLog.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Security = lazy(() => import("./pages/Security.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const SeedShowcase = lazy(() => import("./pages/SeedShowcase.tsx"));
const AgriculturalCompanies = lazy(() => import("./pages/AgriculturalCompanies.tsx"));
const FarmingEvents = lazy(() => import("./pages/FarmingEvents.tsx"));
const WeeklyAIReport = lazy(() => import("./pages/WeeklyAIReport.tsx"));
const SeedManagement = lazy(() => import("./pages/SeedManagement.tsx"));
const MyConsultations = lazy(() => import("./pages/MyConsultations.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Support = lazy(() => import("./pages/Support.tsx"));
const Messages = lazy(() => import("./pages/Messages.tsx"));

// ============================================================
// Loading fallback
// ============================================================
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary animate-pulse" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

// ============================================================
// Error Boundaries
// ============================================================
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn("[VlyToolbar] Caught error:", err.message); }
  render() { return this.state.hasError ? null : this.props.children; }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "Unknown error", stack: error.stack || "" };
  }
  componentDidCatch(err: Error) { console.error("[FarmBond] Root crash:", err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Something went wrong</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">{this.state.message}</p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
            <button
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// Convex Client
// ============================================================
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// ============================================================
// App Render
// ============================================================
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <LanguageProvider>
          <ThemeApplier />
        <BrowserRouter>
          <PWAInstallPrompt />
          <OfflineBanner />
          <AnalyticsScripts />
          <MarketingScripts />
          <PersonalizationScripts />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/security" element={<Security />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/about" element={<About />} />
              <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
              <Route path="/payment-history" element={<RequireAuth><PaymentHistory /></RequireAuth>} />

              {/* Protected Farmer Routes */}
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/farms" element={<RequireAuth><Farms /></RequireAuth>} />
              <Route path="/farms/new" element={<RequireAuth><FarmRegistration /></RequireAuth>} />
              <Route path="/crops" element={<RequireAuth><Crops /></RequireAuth>} />
              <Route path="/livestock" element={<RequireAuth><Livestock /></RequireAuth>} />
              <Route path="/weather" element={<RequireAuth><Weather /></RequireAuth>} />
              <Route path="/ai-assistant" element={<RequireAuth><AIAssistant /></RequireAuth>} />
              <Route path="/finances" element={<RequireAuth><Finances /></RequireAuth>} />
              <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
              <Route path="/community" element={<RequireAuth><Community /></RequireAuth>} />
              <Route path="/calendar" element={<RequireAuth><FarmCalendar /></RequireAuth>} />
              <Route path="/disease-detection" element={<RequireAuth><DiseaseDetection /></RequireAuth>} />
              <Route path="/irrigation" element={<RequireAuth><Irrigation /></RequireAuth>} />
              <Route path="/yield-prediction" element={<RequireAuth><YieldPrediction /></RequireAuth>} />
              <Route path="/knowledge" element={<RequireAuth><KnowledgeBase /></RequireAuth>} />
              <Route path="/farm-comparison" element={<RequireAuth><FarmComparison /></RequireAuth>} />
              <Route path="/weather-alerts" element={<RequireAuth><WeatherAlerts /></RequireAuth>} />
              <Route path="/audit-log" element={<RequireAuth><AuditLog /></RequireAuth>} />
              <Route path="/seeds" element={<RequireAuth><SeedShowcase /></RequireAuth>} />
              <Route path="/companies" element={<RequireAuth><AgriculturalCompanies /></RequireAuth>} />
              <Route path="/events" element={<RequireAuth><FarmingEvents /></RequireAuth>} />
              <Route path="/weekly-report" element={<RequireAuth><WeeklyAIReport /></RequireAuth>} />

              {/* Agronomist Routes */}
              <Route path="/marketplace" element={<RequireAuth><AgronomistMarketplace /></RequireAuth>} />
              <Route path="/my-consultations" element={<RequireAuth><MyConsultations /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/consultations" element={<RequireAuth><MyConsultations /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
              <Route path="/support" element={<RequireAuth><Support /></RequireAuth>} />

              {/* Admin Routes */}
              <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/users" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/subscriptions" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/support" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/content" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/audit" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/settings" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/seeds" element={<RequireAuth><SeedManagement /></RequireAuth>} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
        </LanguageProvider>
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
