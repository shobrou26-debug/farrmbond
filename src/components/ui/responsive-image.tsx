import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

// ============================================================
// ResponsiveImage Component
// Lazy loading, blur placeholder, responsive srcSet, error handling
// ============================================================

export interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  /** Placeholder blur hash or color (default: muted bg) */
  placeholder?: string;
  /** Aspect ratio class (default: aspect-video) */
  aspectRatio?: string;
  /** Object fit class */
  objectFit?: string;
  /** Loading strategy: lazy (default) or eager */
  loading?: "lazy" | "eager";
  /** Show a subtle loading shimmer */
  showShimmer?: boolean;
  /** Fallback icon when image fails */
  fallbackIcon?: React.ReactNode;
  /** Callback when image loads successfully */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: () => void;
  /** sizes attribute for responsive images */
  sizes?: string;
  /** Additional img attributes */
  draggable?: boolean;
  decoding?: "async" | "sync" | "auto";
}

export function ResponsiveImage({
  src,
  alt,
  className,
  containerClassName,
  placeholder,
  aspectRatio = "aspect-video",
  objectFit = "object-cover",
  loading = "lazy",
  showShimmer = true,
  fallbackIcon,
  onLoad,
  onError,
  sizes,
  draggable = false,
  decoding = "async",
}: ResponsiveImageProps) {
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(
    "loading"
  );
  const imgRef = useRef<HTMLImageElement>(null);

  const handleLoad = useCallback(() => {
    setLoadState("loaded");
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setLoadState("error");
    onError?.();
  }, [onError]);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        aspectRatio,
        containerClassName
      )}
    >
      {/* Loading shimmer */}
      {showShimmer && loadState === "loading" && (
        <div className="absolute inset-0 shimmer-bg">
          {placeholder && (
            <div
              className="absolute inset-0 blur-xl scale-110"
              style={{ background: placeholder }}
            />
          )}
        </div>
      )}

      {/* Error fallback */}
      {loadState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/50 text-muted-foreground">
          {fallbackIcon || <ImageIcon className="w-8 h-8 opacity-40" />}
          <span className="text-xs opacity-60">Failed to load image</span>
        </div>
      )}

      {/* Actual image */}
      {loadState !== "error" && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={draggable}
          decoding={decoding}
          loading={loading}
          sizes={sizes}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            objectFit,
            "w-full h-full transition-opacity duration-500",
            loadState === "loaded" ? "opacity-100" : "opacity-0",
            className
          )}
        />
      )}
    </div>
  );
}

// ============================================================
// Optimized Image Sources for Unsplash
// Unsplash supports width param for responsive sizing
// ============================================================

export function getOptimizedImageUrl(
  url: string,
  width: number,
  quality = 80
): string {
  // Only optimize Unsplash URLs
  if (!url.includes("unsplash.com")) return url;

  const baseUrl = url.split("?")[0];
  return `${baseUrl}?w=${width}&q=${quality}&auto=format&fit=crop`;
}

// ============================================================
// Farm-specific optimized image helper
// Returns responsive srcSet for farm cover images
// ============================================================

export function getFarmImageSrcSet(url: string): string {
  if (!url.includes("unsplash.com")) return "";

  const baseUrl = url.split("?")[0];
  return [
    `${baseUrl}?w=400&q=70&auto=format&fit=crop 400w`,
    `${baseUrl}?w=600&q=75&auto=format&fit=crop 600w`,
    `${baseUrl}?w=800&q=80&auto=format&fit=crop 800w`,
    `${baseUrl}?w=1200&q=80&auto=format&fit=crop 1200w`,
  ].join(", ");
}

// ============================================================
// Shimmer CSS animation (added via inline style tag)
// ============================================================

const SHIMMER_STYLE_ID = "responsive-image-shimmer";

function ensureShimmerStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    .shimmer-bg {
      background: linear-gradient(
        110deg,
        oklch(0.93 0.01 145) 30%,
        oklch(0.96 0.005 145) 50%,
        oklch(0.93 0.01 145) 70%
      );
      background-size: 200% 100%;
      animation: shimmer-slide 1.5s ease-in-out infinite;
    }
    .dark .shimmer-bg {
      background: linear-gradient(
        110deg,
        oklch(0.22 0.02 155) 30%,
        oklch(0.25 0.015 155) 50%,
        oklch(0.22 0.02 155) 70%
      );
      background-size: 200% 100%;
    }
    @keyframes shimmer-slide {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

// Auto-initialize shimmer style
if (typeof window !== "undefined") {
  ensureShimmerStyle();
}
