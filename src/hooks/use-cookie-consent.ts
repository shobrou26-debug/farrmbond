import { useState, useEffect, useCallback } from "react";

// ============================================================
// Types
// ============================================================

export interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
  timestamp: string;
  version: string;
}

export interface CookieCategory {
  id: keyof Omit<CookieConsent, "timestamp" | "version">;
  label: string;
  description: string;
  required: boolean;
  examples: string[];
}

// ============================================================
// Cookie Categories Configuration
// ============================================================

export const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: "necessary",
    label: "Strictly Necessary",
    description:
      "These cookies are essential for the website to function properly. They enable core features like security, account access, and remembering your preferences. The website cannot function properly without these cookies, and they cannot be disabled.",
    required: true,
    examples: [
      "Session management and authentication",
      "Security tokens and fraud prevention",
      "Load balancing and performance",
      "Remembering your cookie consent choices",
    ],
  },
  {
    id: "analytics",
    label: "Analytics & Performance",
    description:
      "These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve the website experience and farming insights for all users.",
    required: false,
    examples: [
      "Page views and feature usage tracking",
      "Error logging and performance monitoring",
      "A/B testing for new features",
      "Weather data accuracy reporting",
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Advertising",
    description:
      "These cookies are used to track visitors across websites to display relevant advertisements. They help us measure the effectiveness of our marketing campaigns and provide personalized offers for farming products and services.",
    required: false,
    examples: [
      "Targeted advertising for farm equipment",
      "Campaign performance measurement",
      "Social media integration pixels",
      "Retargeting for premium subscriptions",
    ],
  },
  {
    id: "personalization",
    label: "Personalization",
    description:
      "These cookies allow the website to remember choices you make and provide enhanced, more personal features. They may be set by us or by third-party providers whose services we have added to our pages.",
    required: false,
    examples: [
      "Remembering your preferred language and region",
      "Customizing your dashboard layout",
      "Saving your preferred weather units",
      "Tailoring AI recommendations to your crops",
    ],
  },
];

// ============================================================
// Default Consent State
// ============================================================

const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
  personalization: false,
  timestamp: "",
  version: "1.0",
};

const CONSENT_STORAGE_KEY = "farmbond_cookie_consent";
const CONSENT_VERSION = "1.0";

// ============================================================
// Hook
// ============================================================

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent>(DEFAULT_CONSENT);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // Load consent from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CookieConsent;
        // Check if consent version has changed
        if (parsed.version === CONSENT_VERSION) {
          setConsent(parsed);
          setHasInteracted(true);
          return;
        }
      }
      // No valid consent found — show banner
      setShowBanner(true);
    } catch {
      setShowBanner(true);
    }
  }, []);

  // Save consent to localStorage
  const saveConsent = useCallback((newConsent: CookieConsent) => {
    const withTimestamp: CookieConsent = {
      ...newConsent,
      necessary: true, // Always true
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };

    setConsent(withTimestamp);
    setHasInteracted(true);
    setShowBanner(false);
    setShowPreferences(false);

    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(withTimestamp));
    } catch {
      console.warn("Failed to save cookie consent to localStorage");
    }

    // Dispatch custom event for other components to react
    window.dispatchEvent(
      new CustomEvent("cookie-consent-updated", {
        detail: withTimestamp,
      })
    );
  }, []);

  // Accept all cookies
  const acceptAll = useCallback(() => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true,
      timestamp: "",
      version: CONSENT_VERSION,
    });
  }, [saveConsent]);

  // Accept only necessary cookies
  const rejectAll = useCallback(() => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false,
      timestamp: "",
      version: CONSENT_VERSION,
    });
  }, [saveConsent]);

  // Save custom preferences
  const savePreferences = useCallback(
    (preferences: Omit<CookieConsent, "timestamp" | "version">) => {
      saveConsent({
        ...preferences,
        necessary: true, // Always enabled
        timestamp: "",
        version: CONSENT_VERSION,
      });
    },
    [saveConsent]
  );

  // Open preferences modal
  const openPreferences = useCallback(() => {
    setShowPreferences(true);
  }, []);

  // Close preferences modal
  const closePreferences = useCallback(() => {
    setShowPreferences(false);
  }, []);

  // Reset consent (for testing or user request)
  const resetConsent = useCallback(() => {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    setConsent(DEFAULT_CONSENT);
    setHasInteracted(false);
    setShowBanner(true);
  }, []);

  return {
    consent,
    hasInteracted,
    showBanner,
    showPreferences,
    acceptAll,
    rejectAll,
    savePreferences,
    openPreferences,
    closePreferences,
    resetConsent,
  };
}
