import { useState, useEffect } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Returns `true` when the user's OS-level prefers-reduced-motion
 * setting is "reduce". Falls back to `false` (animations enabled)
 * when the API is unavailable (e.g. SSR).
 */
export function useMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}
