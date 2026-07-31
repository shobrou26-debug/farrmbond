import { useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export type ThemeName =
  | "green-fields"
  | "golden-harvest"
  | "forest-grove"
  | "sunrise-farm"
  | "blue-irrigation"
  | "dark-farm";

export interface ThemeConfig {
  id: ThemeName;
  name: string;
  description: string;
  preview: string; // CSS color for the preview swatch
}

export const THEMES: ThemeConfig[] = [
  { id: "green-fields", name: "Green Fields", description: "Fresh, clean agriculture aesthetic", preview: "oklch(0.42 0.14 155)" },
  { id: "golden-harvest", name: "Golden Harvest", description: "Warm amber and gold tones", preview: "oklch(0.55 0.16 80)" },
  { id: "forest-grove", name: "Forest Grove", description: "Deep emerald forest greens", preview: "oklch(0.35 0.15 155)" },
  { id: "sunrise-farm", name: "Sunrise Farm", description: "Warm coral and orange sunrise", preview: "oklch(0.55 0.18 30)" },
  { id: "blue-irrigation", name: "Blue Irrigation", description: "Cool blue water tones", preview: "oklch(0.45 0.15 240)" },
  { id: "dark-farm", name: "Dark Farm", description: "Rich dark mode with green accents", preview: "oklch(0.58 0.18 150)" },
];

function applyThemeClass(theme: ThemeName) {
  const html = document.documentElement;
  // Remove all theme classes
  html.classList.remove(
    "theme-green-fields",
    "theme-golden-harvest",
    "theme-forest-grove",
    "theme-sunrise-farm",
    "theme-blue-irrigation",
    "theme-dark-farm",
    "dark"
  );
  // Green Fields is the default (no extra class needed)
  if (theme !== "green-fields") {
    html.classList.add(`theme-${theme}`);
  }
  // Dark mode detection for dark-farm
  if (theme === "dark-farm") {
    html.classList.add("dark");
  }
  // Persist to localStorage as fallback
  localStorage.setItem("farmbond-theme", theme);
}

function getStoredTheme(): ThemeName {
  const stored = localStorage.getItem("farmbond-theme") as ThemeName | null;
  if (stored && THEMES.some((t) => t.id === stored)) return stored;
  return "green-fields";
}

export function useTheme() {
  const prefs = useQuery(api.users.getPreferences);
  const updatePrefs = useMutation(api.users.updatePreferences);

  const currentTheme: ThemeName = useMemo(() => {
    return (prefs?.theme as ThemeName) ?? getStoredTheme();
  }, [prefs?.theme]);

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyThemeClass(currentTheme);
  }, [currentTheme]);

  const setTheme = useCallback(
    (theme: ThemeName) => {
      applyThemeClass(theme);
      // Persist to Convex if user is logged in
      updatePrefs({ theme }).catch(() => {
        // If not logged in, localStorage fallback already applied
      });
    },
    [updatePrefs]
  );

  return { theme: currentTheme, setTheme, themes: THEMES };
}


/**
 * ThemeApplier - renders at the root to apply the user's theme on page load.
 * Must be used inside a ConvexAuthProvider.
 */
export function ThemeApplier() {
  const prefs = useQuery(api.users.getPreferences);

  useEffect(() => {
    const theme: ThemeName = (prefs?.theme as ThemeName) ?? getStoredTheme();
    applyThemeClass(theme);
  }, [prefs?.theme]);

  return null; // Renders nothing, side-effect only
}
