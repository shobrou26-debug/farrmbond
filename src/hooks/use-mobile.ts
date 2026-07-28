import * as React from "react";

// ============================================================
// Breakpoint Definitions
// ============================================================

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

// ============================================================
// Core Mobile Detection
// ============================================================

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

// ============================================================
// Enhanced Breakpoint Hook
// ============================================================

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>("sm");

  React.useEffect(() => {
    const checkBreakpoint = () => {
      const w = window.innerWidth;
      if (w >= BREAKPOINTS["2xl"]) setBreakpoint("2xl");
      else if (w >= BREAKPOINTS.xl) setBreakpoint("xl");
      else if (w >= BREAKPOINTS.lg) setBreakpoint("lg");
      else if (w >= BREAKPOINTS.md) setBreakpoint("md");
      else setBreakpoint("sm");
    };

    checkBreakpoint();
    window.addEventListener("resize", checkBreakpoint);
    return () => window.removeEventListener("resize", checkBreakpoint);
  }, []);

  return {
    breakpoint,
    isSm: breakpoint === "sm",
    isMd: breakpoint === "md",
    isLg: breakpoint === "lg",
    isXl: breakpoint === "xl",
    is2Xl: breakpoint === "2xl",
    isMobile: breakpoint === "sm",
    isTablet: breakpoint === "md",
    isDesktop: breakpoint === "lg" || breakpoint === "xl" || breakpoint === "2xl",
    width: typeof window !== "undefined" ? window.innerWidth : 0,
  };
}

// ============================================================
// Touch Device Detection
// ============================================================

export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      setIsTouch(
        "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia("(pointer: coarse)").matches,
      );
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isTouch;
}

// ============================================================
// Screen Orientation
// ============================================================

export function useOrientation() {
  const [orientation, setOrientation] = React.useState<"portrait" | "landscape">(
    "portrait",
  );

  React.useEffect(() => {
    const check = () => {
      setOrientation(
        window.innerHeight > window.innerWidth ? "portrait" : "landscape",
      );
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", () => {
      setTimeout(check, 100);
    });
    return () => {
      window.removeEventListener("resize", check);
    };
  }, []);

  return {
    orientation,
    isPortrait: orientation === "portrait",
    isLandscape: orientation === "landscape",
  };
}

// ============================================================
// Safe Area Insets (for notched devices)
// ============================================================

export function useSafeAreaInsets() {
  const [insets, setInsets] = React.useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  React.useEffect(() => {
    const updateInsets = () => {
      const style = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(style.getPropertyValue("env(safe-area-inset-top)") || "0", 10),
        right: parseInt(style.getPropertyValue("env(safe-area-inset-right)") || "0", 10),
        bottom: parseInt(style.getPropertyValue("env(safe-area-inset-bottom)") || "0", 10),
        left: parseInt(style.getPropertyValue("env(safe-area-inset-left)") || "0", 10),
      });
    };
    updateInsets();
    window.addEventListener("resize", updateInsets);
    return () => window.removeEventListener("resize", updateInsets);
  }, []);

  return insets;
}

// ============================================================
// Swipe Gesture Hook
// ============================================================

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeGesture(ref: React.RefObject<HTMLElement | null>, options: SwipeOptions) {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50, enabled = true } = options;
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);
  const touchEnd = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!enabled || !ref.current) return;

    const el = ref.current;

    const handleTouchStart = (e: TouchEvent) => {
      touchStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      touchEnd.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEnd.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const handleTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) return;

      const dx = touchEnd.current.x - touchStart.current.x;
      const dy = touchEnd.current.y - touchStart.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < threshold) return;

      if (absDx > absDy) {
        if (dx > 0) onSwipeRight?.();
        else onSwipeLeft?.();
      } else {
        if (dy > 0) onSwipeDown?.();
        else onSwipeUp?.();
      }

      touchStart.current = null;
      touchEnd.current = null;
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, enabled, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);
}

// ============================================================
// Pull to Refresh Hook
// ============================================================

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  enabled?: boolean;
}

export function usePullToRefresh(options: PullToRefreshOptions) {
  const { onRefresh, threshold = 80, enabled = true } = options;
  const [isPulling, setIsPulling] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const startY = React.useRef(0);

  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || isRefreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY === 0) {
        setIsPulling(dy > threshold);
      }
    },
    [enabled, isRefreshing, threshold],
  );

  const handleTouchEnd = React.useCallback(async () => {
    if (isPulling && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setIsPulling(false);
      }
    } else {
      setIsPulling(false);
    }
  }, [isPulling, isRefreshing, onRefresh]);

  return {
    isPulling,
    isRefreshing,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

// ============================================================
// Haptic Feedback (for supported devices)
// ============================================================

export function useHaptic() {
  const vibrate = React.useCallback((pattern?: number | number[]) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern ?? 10);
    }
  }, []);

  return {
    light: () => vibrate(10),
    medium: () => vibrate(20),
    heavy: () => vibrate(40),
    success: () => vibrate([10, 50, 20]),
    error: () => vibrate([30, 100, 30, 100, 30]),
    selection: () => vibrate(5),
    vibrate,
  };
}

// ============================================================
// Scroll Direction Detection
// ============================================================

export function useScrollDirection() {
  const [scrollDir, setScrollDir] = React.useState<"up" | "down" | null>(null);
  const [isAtTop, setIsAtTop] = React.useState(true);

  React.useEffect(() => {
    let lastScroll = window.scrollY;

    const handleScroll = () => {
      const current = window.scrollY;
      setIsAtTop(current < 10);
      if (current > lastScroll) setScrollDir("down");
      else if (current < lastScroll) setScrollDir("up");
      lastScroll = current;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return { scrollDir, isAtTop, isHidden: scrollDir === "down" && !isAtTop };
}

// ============================================================
// Viewport Height (for mobile keyboards)
// ============================================================

export function useViewportHeight() {
  const [height, setHeight] = React.useState(
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  React.useEffect(() => {
    const update = () => {
      setHeight(window.innerHeight);
    };

    window.addEventListener("resize", update);
    // VisualViewport API for mobile keyboard detection
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", update);
    }

    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return height;
}

// ============================================================
// Long Press Hook
// ============================================================

interface LongPressOptions {
  onLongPress: () => void;
  delay?: number;
}

export function useLongPress(options: LongPressOptions) {
  const { onLongPress, delay = 500 } = options;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = React.useCallback(() => {
    timerRef.current = setTimeout(() => {
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const clear = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}
