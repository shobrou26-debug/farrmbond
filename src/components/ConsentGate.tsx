import { useEffect, useRef, useState } from "react";
import { useCookieConsent } from "@/hooks/use-cookie-consent";

// ============================================================
// ConsentGate Component
// Wraps third-party scripts and only renders them when the
// appropriate consent category is enabled.
// ============================================================

interface ConsentGateProps {
  /** Which consent category is required to render children */
  category: "analytics" | "marketing" | "personalization";
  /** The content to render when consent is granted */
  children: React.ReactNode;
  /** Content to render when consent is not granted (optional) */
  fallback?: React.ReactNode;
}

export function ConsentGate({ category, children, fallback = null }: ConsentGateProps) {
  const { consent, hasInteracted } = useCookieConsent();

  // Don't render anything until user has made a choice
  if (!hasInteracted) return <>{fallback}</>;

  // Check if the specific category is enabled
  if (!consent[category]) return <>{fallback}</>;

  return <>{children}</>;
}

// ============================================================
// ScriptLoader Component
// Dynamically loads a script tag only when consent is granted
// ============================================================

interface ScriptLoaderProps {
  category: "analytics" | "marketing" | "personalization";
  src: string;
  async?: boolean;
  id?: string;
  onLoad?: () => void;
}

export function ScriptLoader({ category, src, async = true, id, onLoad }: ScriptLoaderProps) {
  const { consent, hasInteracted } = useCookieConsent();
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Don't load if user hasn't interacted or category is disabled
    if (!hasInteracted || !consent[category]) {
      // Remove existing script if consent was revoked
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
        scriptRef.current = null;
        setLoaded(false);
      }
      return;
    }

    // Don't load if already loaded
    if (loaded) return;

    // Check if script already exists
    const existing = id ? document.getElementById(id) : document.querySelector(`script[src="${src}"]`);
    if (existing) {
      setLoaded(true);
      return;
    }

    // Create and inject the script
    const script = document.createElement("script");
    script.src = src;
    script.async = async;
    if (id) script.id = id;

    script.onload = () => {
      setLoaded(true);
      onLoad?.();
    };

    document.head.appendChild(script);
    scriptRef.current = script;

    return () => {
      // Cleanup on unmount or consent change
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
        scriptRef.current = null;
        setLoaded(false);
      }
    };
  }, [consent[category], hasInteracted, loaded, src, async, id, onLoad, category]);

  return null;
}

// ============================================================
// useConsentCategory Hook
// Easy way to check if a consent category is enabled
// ============================================================

export function useConsentCategory(category: "analytics" | "marketing" | "personalization") {
  const { consent, hasInteracted } = useCookieConsent();
  return hasInteracted && consent[category];
}

// ============================================================
// Analytics Component
// Example: Google Analytics wrapper
// ============================================================

export function AnalyticsScripts() {
  const analyticsEnabled = useConsentCategory("analytics");

  if (!analyticsEnabled) return null;

  return (
    <>
      {/* Example: Google Analytics 4 */}
      {/* <ScriptLoader
        category="analytics"
        id="ga4-script"
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
      />
      <ScriptLoader
        category="analytics"
        id="ga4-config"
        src=""
        onLoad={() => {
          // @ts-expect-error - gtag is loaded by the script above
          window.gtag("js", new Date());
          // @ts-expect-error - gtag is loaded by the script above
          window.gtag("config", "G-XXXXXXXXXX", { anonymize_ip: true });
        }}
      /> */}

      {/* Example: Plausible Analytics (privacy-focused) */}
      {/* <ScriptLoader
        category="analytics"
        id="plausible"
        src="https://plausible.io/js/script.js"
      /> */}

      {/* Placeholder for when analytics are enabled */}
      {analyticsEnabled && (
        <div data-consent="analytics" className="hidden" aria-hidden="true" />
      )}
    </>
  );
}

// ============================================================
// MarketingScripts Component
// Example: Ad pixels and retargeting
// ============================================================

export function MarketingScripts() {
  const marketingEnabled = useConsentCategory("marketing");

  if (!marketingEnabled) return null;

  return (
    <>
      {/* Example: Facebook Pixel */}
      {/* <ScriptLoader
        category="marketing"
        id="fb-pixel"
        src="https://connect.facebook.net/en_US/fbevents.js"
      /> */}

      {/* Example: LinkedIn Insight Tag */}
      {/* <ScriptLoader
        category="marketing"
        id="linkedin-insight"
        src="https://snap.licdn.com/li.lms-analytics/insight.min.js"
      /> */}

      {marketingEnabled && (
        <div data-consent="marketing" className="hidden" aria-hidden="true" />
      )}
    </>
  );
}

// ============================================================
// PersonalizationScripts Component
// Example: Chat widgets, A/B testing
// ============================================================

export function PersonalizationScripts() {
  const personalizationEnabled = useConsentCategory("personalization");

  if (!personalizationEnabled) return null;

  return (
    <>
      {/* Example: Intercom Chat */}
      {/* <ScriptLoader
        category="personalization"
        id="intercom"
        src="https://widget.intercom.io/widget/YOUR_APP_ID"
      /> */}

      {personalizationEnabled && (
        <div data-consent="personalization" className="hidden" aria-hidden="true" />
      )}
    </>
  );
}
