import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { FilterBar, type AdvancedFilters } from "@/components/filter-bar";
import { MediaCard } from "@/components/media-card";
import { MediaListItem } from "@/components/media-list-item";
import { BulkActions, SelectableItem } from "@/components/bulk-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Headphones } from "lucide-react";
import { parseJsonArray } from "@/lib/utils";
import type { AudiobookWithProgress, UserRating } from "@shared/schema";

const defaultFilters: AdvancedFilters = {
  readStatus: "all",
  format: [],
  dateRange: "all",
  rating: "all",
  tags: [],
};

export default function Audiobooks() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("audiobooks-view-mode") as "grid" | "list") || "grid";
    }
    return "grid";
  });
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(defaultFilters);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem("audiobooks-view-mode", viewMode);
  }, [viewMode]);

  const { data: audiobooks = [], isLoading } = useQuery<AudiobookWithProgress[]>({
    queryKey: ["/api/audiobooks"],
  });

  const { data: ratings = [] } = useQuery<UserRating[]>({
    queryKey: ["/api/ratings"],
  });

  // Create ratings map for quick lookup
  const ratingsMap = useMemo(() => {
    const map = new Map<string, number>();
    ratings.forEach((rating) => {
      if (rating.itemType === "audiobook") {
        map.set(rating.itemId, rating.rating);
      }
    });
    return map;
  }, [ratings]);

  // Extract unique formats and tags
  const availableFormats = useMemo(() => {
    const formats = new Set<string>();
    audiobooks.forEach((audiobook) => {
      if (audiobook.format) formats.add(audiobook.format.toLowerCase());
    });
    return Array.from(formats).sort();
  }, [audiobooks]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    audiobooks.forEach((audiobook) => {
      parseJsonArray(audiobook.tags).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [audiobooks]);

  // Filter audiobooks
  const filteredAudiobooks = audiobooks.filter((audiobook) => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !audiobook.title.toLowerCase().includes(query) &&
        !audiobook.author?.toLowerCase().includes(query) &&
        !audiobook.narrator?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Listen status filter (uses readStatus for UI consistency)
    if (advancedFilters.readStatus !== "all") {
      const progress = audiobook.progress?.progress || 0;
      const completed = audiobook.progress?.completed || false;

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
      if (!advancedFilters.format.includes(audiobook.format?.toLowerCase() || "")) {
        return false;
      }
    }

    // Date range filter
    if (advancedFilters.dateRange !== "all") {
      const addedAt = new Date(audiobook.addedAt);
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
      const audiobookRating = ratingsMap.get(audiobook.id);

      if (advancedFilters.rating === "unrated") {
        if (audiobookRating !== undefined) return false;
      } else {
        const minRating = parseInt(advancedFilters.rating);
        if (!audiobookRating || audiobookRating < minRating) return false;
      }
    }

    // Tags filter
    if (advancedFilters.tags.length > 0) {
      const audiobookTags = parseJsonArray(audiobook.tags);
      if (audiobookTags.length === 0 || !advancedFilters.tags.some((tag) => audiobookTags.includes(tag))) {
        return false;
      }
    }

    return true;
  });

  // Sort audiobooks
  const sortedAudiobooks = [...filteredAudiobooks].sort((a, b) => {
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

  const handleAudiobookClick = (audiobook: AudiobookWithProgress) => {
    if (!selectionMode) {
      setLocation(`/audiobooks/${audiobook.id}`);
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
    const allIds = sortedAudiobooks.map((ab) => `audiobook-${ab.id}`);
    setSelectedIds(new Set(allIds));
  }, [sortedAudiobooks]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode((prev) => !prev);
  }, [selectionMode]);

  const getItemKey = (id: string) => `audiobook-${id}`;

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
          itemType="audiobook"
          selectionMode={selectionMode}
          onToggleSelectionMode={toggleSelectionMode}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          totalCount={sortedAudiobooks.length}
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
        ) : sortedAudiobooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
            <Headphones className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">
                {searchQuery ? "No audiobooks found" : "No audiobooks yet"}
              </h2>
              <p className="text-muted-foreground max-w-md">
                {searchQuery
                  ? "Try a different search query."
                  : "Upload audiobooks to start building your library."}
              </p>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {sortedAudiobooks.map((audiobook) => {
              const itemKey = getItemKey(audiobook.id);
              return (
                <SelectableItem
                  key={audiobook.id}
                  id={itemKey}
                  selected={selectedIds.has(itemKey)}
                  onToggle={toggleSelection}
                  selectionMode={selectionMode}
                >
                  <MediaCard
                    item={audiobook}
                    type="audiobook"
                    onClick={() => handleAudiobookClick(audiobook)}
                  />
                </SelectableItem>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {sortedAudiobooks.map((audiobook) => {
              const itemKey = getItemKey(audiobook.id);
              return (
                <SelectableItem
                  key={audiobook.id}
                  id={itemKey}
                  selected={selectedIds.has(itemKey)}
                  onToggle={toggleSelection}
                  selectionMode={selectionMode}
                >
                  <MediaListItem
                    item={audiobook}
                    type="audiobook"
                    onClick={() => handleAudiobookClick(audiobook)}
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
