// A cursor-paged list shown a page at a time: it reads the server's pages as the person pages
// forward (or jumps to the last page), and slices what it has. The server answers its own total.
import { type QueryKey, keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";

/** The most a read asks for; the server's own limit is 200. */
export const READ_PAGE = 100;

type Page<T> = { items: T[]; next_cursor?: string; total: number };

export function useCursorList<T, P extends Page<T>>(
  queryKey: QueryKey,
  read: (cursor: string | undefined, signal: AbortSignal) => Promise<P>,
  { offset, pageSize, enabled }: { offset: number; pageSize: number; enabled: boolean },
) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => read(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor || undefined,
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
  const loaded = query.data?.pages.flatMap((page) => page.items) ?? [];
  const short = offset + pageSize > loaded.length && query.hasNextPage;
  const { fetchNextPage, isFetchingNextPage } = query;
  useEffect(() => {
    if (short && !isFetchingNextPage) void fetchNextPage();
  }, [short, isFetchingNextPage, fetchNextPage]);
  const first = query.data?.pages[0];
  // Read as one query's page: the rows on show, with the total the server sends on every page.
  return {
    data: first ? { ...first, items: loaded.slice(offset, offset + pageSize) } : undefined,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isLoading: query.isLoading,
    isPlaceholderData: query.isPlaceholderData || short,
  };
}
