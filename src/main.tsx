import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { PWAInstallPrompt, OfflineBanner } from "@/components/PWAInstallPrompt";
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
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

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
        <BrowserRouter>
          <PWAInstallPrompt />
          <OfflineBanner />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />

              {/* Protected Farmer Routes */}
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/farms" element={<RequireAuth><Farms /></RequireAuth>} />
              <Route path="/crops" element={<RequireAuth><Crops /></RequireAuth>} />
              <Route path="/livestock" element={<RequireAuth><Livestock /></RequireAuth>} />
              <Route path="/weather" element={<RequireAuth><Weather /></RequireAuth>} />
              <Route path="/ai-assistant" element={<RequireAuth><AIAssistant /></RequireAuth>} />
              <Route path="/finances" element={<RequireAuth><Finances /></RequireAuth>} />
              <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
              <Route path="/community" element={<RequireAuth><Community /></RequireAuth>} />
              <Route path="/calendar" element={<RequireAuth><FarmCalendar /></RequireAuth>} />
              <Route path="/disease-detection" element={<RequireAuth><DiseaseDetection /></RequireAuth>} />

              {/* Agronomist Routes */}
              <Route path="/marketplace" element={<RequireAuth><AgronomistMarketplace /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/consultations" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/messages" element={<RequireAuth><Community /></RequireAuth>} />
              <Route path="/knowledge" element={<RequireAuth><Community /></RequireAuth>} />

              {/* Admin Routes */}
              <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/users" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/subscriptions" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/support" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/content" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/audit" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/settings" element={<RequireAuth><AdminDashboard /></RequireAuth>} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
