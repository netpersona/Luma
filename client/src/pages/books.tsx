import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { FilterBar, type AdvancedFilters } from "@/components/filter-bar";
import { MediaCard } from "@/components/media-card";
import { MediaListItem } from "@/components/media-list-item";
import { BulkActions, SelectableItem } from "@/components/bulk-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen } from "lucide-react";
import { parseJsonArray } from "@/lib/utils";
import type { BookWithProgress, UserRating } from "@shared/schema";

const defaultFilters: AdvancedFilters = {
  readStatus: "all",
  format: [],
  dateRange: "all",
  rating: "all",
  tags: [],
};

export default function Books() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("books-view-mode") as "grid" | "list") || "grid";
    }
    return "grid";
  });
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(defaultFilters);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Read URL parameters on mount (for author filter links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authorParam = params.get("author");
    if (authorParam) {
      setSearchQuery(authorParam);
      // Clear the URL parameter after setting the search
      window.history.replaceState({}, "", "/books");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("books-view-mode", viewMode);
  }, [viewMode]);

  const { data: books = [], isLoading } = useQuery<BookWithProgress[]>({
    queryKey: ["/api/books"],
  });

  const { data: ratings = [] } = useQuery<UserRating[]>({
    queryKey: ["/api/ratings"],
  });

  // Create ratings map for quick lookup
  const ratingsMap = useMemo(() => {
    const map = new Map<string, number>();
    ratings.forEach((rating) => {
      if (rating.itemType === "book") {
        map.set(rating.itemId, rating.rating);
      }
    });
    return map;
  }, [ratings]);

  // Extract unique formats and tags
  const availableFormats = useMemo(() => {
    const formats = new Set<string>();
    books.forEach((book) => {
      if (book.format) formats.add(book.format.toLowerCase());
    });
    return Array.from(formats).sort();
  }, [books]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    books.forEach((book) => {
      parseJsonArray(book.tags).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [books]);

  // Filter books
  const filteredBooks = books.filter((book) => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !book.title.toLowerCase().includes(query) &&
        !book.author?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Read status filter
    if (advancedFilters.readStatus !== "all") {
      const progress = book.progress?.progress || 0;
      const completed = book.progress?.completed || false;

      switch (advancedFilters.readStatus) {
        case "unread":
          if (progress > 0 || completed) return false;
          break;
        case "reading":
          if (progress === 0 || completed) return false;
          break;
        case "completed":
          if (!completed) return false;
          break;
      }
    }

    // Format filter
    if (advancedFilters.format.length > 0) {
      if (!advancedFilters.format.includes(book.format?.toLowerCase() || "")) {
        return false;
      }
    }

    // Date range filter
    if (advancedFilters.dateRange !== "all") {
      const addedAt = new Date(book.addedAt);
      const now = new Date();

      switch (advancedFilters.dateRange) {
        case "7days":
          if (now.getTime() - addedAt.getTime() > 7 * 24 * 60 * 60 * 1000) return false;
          break;
        case "30days":
          if (now.getTime() - addedAt.getTime() > 30 * 24 * 60 * 60 * 1000) return false;
          break;
        case "year":
          if (addedAt.getFullYear() !== now.getFullYear()) return false;
          break;
      }
    }

    // Rating filter
    if (advancedFilters.rating !== "all") {
      const bookRating = ratingsMap.get(book.id);

      if (advancedFilters.rating === "unrated") {
        if (bookRating !== undefined) return false;
      } else {
        const minRating = parseInt(advancedFilters.rating);
        if (!bookRating || bookRating < minRating) return false;
      }
    }

    // Tags filter
    if (advancedFilters.tags.length > 0) {
      const bookTags = parseJsonArray(book.tags);
      if (bookTags.length === 0 || !advancedFilters.tags.some((tag) => bookTags.includes(tag))) {
        return false;
      }
    }

    return true;
  });

  // Sort books
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title);
      case "author":
        return (a.author || "").localeCompare(b.author || "");
      case "progress":
        return (b.progress?.progress || 0) - (a.progress?.progress || 0);
      case "recent":
      default:
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
  });

  const handleBookClick = (book: BookWithProgress) => {
    if (!selectionMode) {
      setLocation(`/books/${book.id}`);
    }
  };

  const toggleSelection = useCallback((prefixedId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(prefixedId)) {
        next.delete(prefixedId);
      } else {
        next.add(prefixedId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = sortedBooks.map((book) => `book-${book.id}`);
    setSelectedIds(new Set(allIds));
  }, [sortedBooks]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode((prev) => !prev);
  }, [selectionMode]);

  const getItemKey = (id: string) => `book-${id}`;

  return (
    <div className="flex-1 overflow-auto bg-background texture-paper">
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={setAdvancedFilters}
        availableFormats={availableFormats}
        availableTags={availableTags}
      />

      <div className="flex items-center justify-between px-6 py-2 border-b bg-background">
        <BulkActions
          selectedIds={selectedIds}
          itemType="book"
          selectionMode={selectionMode}
          onToggleSelectionMode={toggleSelectionMode}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          totalCount={sortedBooks.length}
        />
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : sortedBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
            <BookOpen className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">
                {searchQuery ? "No books found" : "No books yet"}
              </h2>
              <p className="text-muted-foreground max-w-md">
                {searchQuery
                  ? "Try a different search query."
                  : "Upload books to start building your library."}
              </p>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {sortedBooks.map((book) => {
              const itemKey = getItemKey(book.id);
              return (
                <SelectableItem
                  key={book.id}
                  id={itemKey}
                  selected={selectedIds.has(itemKey)}
                  onToggle={toggleSelection}
                  selectionMode={selectionMode}
                >
                  <MediaCard
                    item={book}
                    type="book"
                    onClick={() => handleBookClick(book)}
                  />
                </SelectableItem>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {sortedBooks.map((book) => {
              const itemKey = getItemKey(book.id);
              return (
                <SelectableItem
                  key={book.id}
                  id={itemKey}
                  selected={selectedIds.has(itemKey)}
                  onToggle={toggleSelection}
                  selectionMode={selectionMode}
                >
                  <MediaListItem
                    item={book}
                    type="book"
                    onClick={() => handleBookClick(book)}
                  />
                </SelectableItem>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
