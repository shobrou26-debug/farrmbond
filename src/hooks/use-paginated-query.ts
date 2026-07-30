import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { type FunctionReference } from "convex/server";

// ============================================================
// Types
// ============================================================

/** The shape returned by Convex paginated queries */
interface PaginatedResult<T> {
  page: T[];
  isDone: boolean;
  continueCursor: string | null;
}

/** Options for the usePaginatedQuery hook */
interface UsePaginatedQueryOptions {
  /** Number of items per page. Default: 20 */
  numItems?: number;
  /** Enable/disable the query. Default: true */
  enabled?: boolean;
}

/** Return type of the usePaginatedQuery hook */
interface UsePaginatedQueryReturn<T> {
  /** All accumulated results across all loaded pages */
  results: T[];
  /** Whether the initial load is in progress (no data yet) */
  isLoading: boolean;
  /** Whether more pages are being loaded */
  isLoadingMore: boolean;
  /** Whether all pages have been loaded */
  isDone: boolean;
  /** Function to load the next page */
  loadMore: () => void;
  /** Whether loadMore can be called (more pages exist and not currently loading) */
  canLoadMore: boolean;
  /** Ref to attach to a sentinel element for infinite scroll */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Total count of loaded items */
  count: number;
}

// ============================================================
// useInfiniteScroll Hook
// ============================================================

/**
 * Creates an IntersectionObserver that fires a callback when the
 * observed element enters the viewport. Used for infinite scroll.
 */
export function useInfiniteScroll(
  callback: () => void,
  options: {
    enabled?: boolean;
    rootMargin?: string;
    threshold?: number;
  } = {}
) {
  const { enabled = true, rootMargin = "200px", threshold = 0 } = options;
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const node = sentinelRef.current;
    if (!node) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          callbackRef.current();
        }
      },
      { rootMargin, threshold }
    );

    observerRef.current.observe(node);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [enabled, rootMargin, threshold]);

  return sentinelRef;
}

// ============================================================
// usePaginatedQuery Hook
// ============================================================

/**
 * A reusable hook for paginated Convex queries with infinite scroll support.
 *
 * Usage:
 * ```tsx
 * const { results, loadMore, canLoadMore, sentinelRef, isLoading } =
 *   usePaginatedQuery(api.farms.listUserFarms, {});
 *
 * return (
 *   <div>
 *     {results.map(farm => <FarmCard key={farm._id} farm={farm} />)}
 *     {canLoadMore && <div ref={sentinelRef} />}
 *     {isLoadingMore && <Spinner />}
 *   </div>
 * );
 * ```
 */
export function usePaginatedQuery<T>(
  queryFn: FunctionReference<"query">,
  args: Record<string, unknown> = {},
  options: UsePaginatedQueryOptions = {}
): UsePaginatedQueryReturn<T> {
  const { numItems = 20, enabled = true } = options;

  // Pagination state
  const [cursor, setCursor] = useState<string | null>(null);
  const [accumulatedResults, setAccumulatedResults] = useState<T[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Reset accumulated results when args change (e.g., filter change)
  const argsKey = useMemo(() => JSON.stringify(args), [args]);
  const prevArgsKeyRef = useRef(argsKey);
  useEffect(() => {
    if (prevArgsKeyRef.current !== argsKey) {
      prevArgsKeyRef.current = argsKey;
      setAccumulatedResults([]);
      setCursor(null);
      setIsDone(false);
      setIsInitialized(false);
    }
  }, [argsKey]);

  // Query args with pagination
  const queryArgs = useMemo(
    () => ({
      ...args,
      paginationOpts: {
        numItems,
        cursor,
      },
    }),
    [args, numItems, cursor]
  );

  // Convex reactive query
  const data = useQuery(
    enabled ? queryFn : "skip" as unknown as FunctionReference<"query">,
    queryArgs
  ) as PaginatedResult<T> | undefined;

  // Process incoming page data
  useEffect(() => {
    if (!data) return;

    if (cursor === null) {
      // First page loaded
      setAccumulatedResults(data.page);
      setIsDone(data.isDone);
      setIsInitialized(true);
    } else {
      // Subsequent page loaded
      setAccumulatedResults((prev) => [...prev, ...data.page]);
      setIsDone(data.isDone);
      setIsLoadingMore(false);
    }
  }, [data, cursor]);

  // Load more function
  const loadMore = useCallback(() => {
    if (isDone || isLoadingMore || !data?.continueCursor) return;

    setIsLoadingMore(true);
    setCursor(data.continueCursor);
  }, [isDone, isLoadingMore, data?.continueCursor]);

  // Infinite scroll sentinel
  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: enabled && !isDone && !isLoadingMore && isInitialized,
  });

  return {
    results: accumulatedResults,
    isLoading: !isInitialized && enabled,
    isLoadingMore,
    isDone,
    loadMore,
    canLoadMore: !isDone && !isLoadingMore && isInitialized,
    sentinelRef,
    count: accumulatedResults.length,
  };
}
