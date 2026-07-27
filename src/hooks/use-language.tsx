import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  type Locale,
  locales,
  setLocale as setI18nLocale,
  getLocale,
  initLocale,
  t,
} from "@/lib/i18n";

// ============================================================
// Types
// ============================================================

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locales: typeof locales;
}

// ============================================================
// Context
// ============================================================

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// ============================================================
// Provider
// ============================================================

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const detected = initLocale();
    setLocaleState(detected);
  }, []);

  const setLocale = (newLocale: Locale) => {
    setI18nLocale(newLocale);
    setLocaleState(newLocale);
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, locales }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

// ============================================================
// Translation Hook (convenience)
// ============================================================

export function useTranslation() {
  const { locale, setLocale, t } = useLanguage();
  return { locale, setLocale, t };
}
