import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { FilterBar, type AdvancedFilters } from "@/components/filter-bar";
import { MediaCard } from "@/components/media-card";
import { MediaListItem } from "@/components/media-list-item";
import { BulkActions, SelectableItem } from "@/components/bulk-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, Headphones, Upload, Loader2 } from "lucide-react";
import { ObjectUploader } from "@/components/object-uploader";
import { DropZone } from "@/components/drop-zone";
import { RecentBooks } from "@/components/recent-books";
import { useToast } from "@/hooks/use-toast";
import { parseJsonArray } from "@/lib/utils";
import type { BookWithProgress, AudiobookWithProgress, UserRating } from "@shared/schema";

const defaultFilters: AdvancedFilters = {
  readStatus: "all",
  format: [],
  dateRange: "all",
  rating: "all",
  tags: [],
};

export default function Library() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("library-view-mode") as "grid" | "list") || "grid";
    }
    return "grid";
  });
  const [filterType, setFilterType] = useState<"all" | "book" | "audiobook">("all");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(defaultFilters);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  // Handle tag query parameter from URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const tagParam = params.get("tag");
    if (tagParam) {
      setAdvancedFilters((prev) => ({
        ...prev,
        tags: [tagParam],
      }));
      // Clear the URL parameter after applying the filter
      setLocation("/", { replace: true });
    }
  }, [searchParams, setLocation]);

  useEffect(() => {
    localStorage.setItem("library-view-mode", viewMode);
  }, [viewMode]);

  const { data: books = [], isLoading: booksLoading } = useQuery<BookWithProgress[]>({
    queryKey: ["/api/books"],
  });

  const { data: audiobooks = [], isLoading: audiobooksLoading } = useQuery<AudiobookWithProgress[]>({
    queryKey: ["/api/audiobooks"],
  });

  const { data: ratings = [] } = useQuery<UserRating[]>({
    queryKey: ["/api/ratings"],
  });

  const isLoading = booksLoading || audiobooksLoading;

  // Create ratings map for quick lookup (normalize itemType to lowercase)
  const ratingsMap = useMemo(() => {
    const map = new Map<string, number>();
    ratings.forEach((rating) => {
      const normalizedType = rating.itemType.toLowerCase();
      map.set(`${normalizedType}-${rating.itemId}`, rating.rating);
    });
    return map;
  }, [ratings]);

  // Extract unique formats and tags from all items
  const availableFormats = useMemo(() => {
    const formats = new Set<string>();
    books.forEach((book) => {
      if (book.format) formats.add(book.format.toLowerCase());
    });
    audiobooks.forEach((audiobook) => {
      if (audiobook.format) formats.add(audiobook.format.toLowerCase());
    });
    return Array.from(formats).sort();
  }, [books, audiobooks]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    books.forEach((book) => {
      parseJsonArray(book.tags).forEach((tag) => tags.add(tag));
    });
    audiobooks.forEach((audiobook) => {
      parseJsonArray(audiobook.tags).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [books, audiobooks]);

  // Combine and filter items
  const allItems = [
    ...books.map((book) => ({ ...book, type: "book" as const })),
    ...audiobooks.map((audiobook) => ({ ...audiobook, type: "audiobook" as const })),
  ];

  const filteredItems = allItems.filter((item) => {
    // Filter by type
    if (filterType !== "all" && item.type !== filterType) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !item.title.toLowerCase().includes(query) &&
        !item.author?.toLowerCase().includes(query) &&
        !item.narrator?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // Read/Listen status filter
    if (advancedFilters.readStatus !== "all") {
      const progress = item.progress?.progress || 0;
      const completed = item.progress?.completed || false;

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
      if (!advancedFilters.format.includes(item.format?.toLowerCase() || "")) {
        return false;
      }
    }

    // Date range filter
    if (advancedFilters.dateRange !== "all") {
      const addedAt = new Date(item.addedAt);
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
      const itemRating = ratingsMap.get(`${item.type}-${item.id}`);

      if (advancedFilters.rating === "unrated") {
        if (itemRating !== undefined) return false;
      } else {
        const minRating = parseInt(advancedFilters.rating);
        if (!itemRating || itemRating < minRating) return false;
      }
    }

    // Tags filter
    if (advancedFilters.tags.length > 0) {
      const itemTags = parseJsonArray(item.tags);
      if (itemTags.length === 0 || !advancedFilters.tags.some((tag) => itemTags.includes(tag))) {
        return false;
      }
    }

    return true;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title);
      case "author":
        return (a.author || "").localeCompare(b.author || "");
      case "published":
        const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
        const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
        return dateB - dateA;
      case "progress":
        return (b.progress?.progress || 0) - (a.progress?.progress || 0);
      case "recent":
      default:
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }
  });

  const handleItemClick = (item: typeof sortedItems[0]) => {
    if (!selectionMode) {
      setLocation(`/${item.type}s/${item.id}`);
    }
  };

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = sortedItems.map((item) => `${item.type}-${item.id}`);
    setSelectedIds(new Set(allIds));
  }, [sortedItems]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode((prev) => !prev);
  }, [selectionMode]);

  const uploadIdsRef = useState<string[]>([])[0];

  const handleGetUploadParameters = async () => {
    const res = await fetch("/api/objects/upload", { method: "POST" });
    const { uploadURL, uploadId } = await res.json();
    // Store the upload ID so we can send it to process-uploads later
    uploadIdsRef.push(uploadId);
    console.log('[Upload] Got upload ID:', uploadId);
    return { method: "PUT" as const, url: uploadURL };
  };

  const handleUploadComplete = async (result: any) => {
    try {
      console.log('[Upload] Complete with', result.successful?.length, 'successful files');
      console.log('[Upload] Upload IDs to process:', uploadIdsRef);
      
      if (!result.successful || result.successful.length === 0) {
        console.warn('[Upload] No successful uploads');
        uploadIdsRef.length = 0; // Clear the array
        return;
      }
      
      if (uploadIdsRef.length === 0) {
        console.error('[Upload] No upload IDs stored!');
        alert('Upload failed: No upload IDs found. Please try again.');
        return;
      }

      // Call backend to process uploads and extract metadata using upload IDs
      const response = await fetch("/api/process-uploads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uploadIds: [...uploadIdsRef] }),
      });

      if (!response.ok) {
        throw new Error("Failed to process uploads");
      }

      const data = await response.json();
      console.log("Processing results:", data.results);

      // Clear upload IDs
      uploadIdsRef.length = 0;

      // Refresh the page to show new items
      window.location.reload();
    } catch (error) {
      console.error("Error processing uploads:", error);
      uploadIdsRef.length = 0; // Clear on error too
      alert('Upload failed. Check console for details.');
    }
  };

  const handleFilesDropped = async (files: File[]) => {
    if (isUploading) return;
    
    setIsUploading(true);
    const dropUploadIds: string[] = [];
    
    toast({
      title: "Uploading files",
      description: `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`,
    });

    try {
      for (const file of files) {
        const res = await fetch("/api/objects/upload", { method: "POST" });
        if (!res.ok) throw new Error("Failed to get upload URL");
        
        const { uploadURL, uploadId } = await res.json();
        dropUploadIds.push(uploadId);
        
        const uploadRes = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });
        
        if (!uploadRes.ok) throw new Error(`Failed to upload ${file.name}`);
      }
      
      if (dropUploadIds.length === 0) {
        throw new Error("No files were uploaded");
      }
      
      toast({
        title: "Processing files",
        description: "Extracting metadata from uploaded files...",
      });
      
      const response = await fetch("/api/process-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIds: dropUploadIds }),
      });
      
      if (!response.ok) throw new Error("Failed to process uploads");
      
      const data = await response.json();
      
      toast({
        title: "Upload complete",
        description: `Successfully added ${data.results?.length || files.length} item${(data.results?.length || files.length) > 1 ? 's' : ''} to your library!`,
      });
      
      window.location.reload();
    } catch (error) {
      console.error("Drop upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DropZone onFilesDropped={handleFilesDropped} disabled={isUploading} className="flex-1 overflow-auto">
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" data-testid="upload-progress-overlay">
          <div className="flex flex-col items-center gap-4 p-8 bg-card rounded-xl shadow-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Uploading files...</p>
          </div>
        </div>
      )}
      <div className="bg-background texture-paper min-h-full">
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={setAdvancedFilters}
        availableFormats={availableFormats}
        availableTags={availableTags}
      />

      <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-2 border-b bg-background">
        <BulkActions
          selectedIds={selectedIds}
          itemType="mixed"
          selectionMode={selectionMode}
          onToggleSelectionMode={toggleSelectionMode}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          totalCount={sortedItems.length}
        />
      </div>

      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        {!searchQuery && !isLoading && sortedItems.length > 0 && (
          <RecentBooks />
        )}
        {isLoading ? (
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[500px] md:min-h-[600px] text-center space-y-8 px-4">
            <div className="flex gap-6 opacity-40">
              <BookOpen className="h-20 w-20 md:h-24 md:w-24 text-muted-foreground" />
              <Headphones className="h-20 w-20 md:h-24 md:w-24 text-muted-foreground" />
            </div>
            <div className="space-y-3 max-w-lg">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                {searchQuery ? "No results found" : "Your library is empty"}
              </h2>
              <p className="text-muted-foreground text-sm md:text-base">
                {searchQuery
                  ? "No items match your search. Try a different query or clear the search to see all items."
                  : "Start building your digital library by uploading your favorite books and audiobooks. Supports EPUB, PDF, M4B, MP3, and more."}
              </p>
            </div>
            {!searchQuery && (
              <ObjectUploader
                maxNumberOfFiles={20}
                allowedFileTypes={[".epub", ".pdf", ".mobi", ".cbz", ".cbr", ".m4b", ".mp3", ".m4a"]}
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonVariant="default"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </ObjectUploader>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {sortedItems.map((item) => {
              const itemKey = `${item.type}-${item.id}`;
              return (
                <SelectableItem
                  key={itemKey}
                  id={itemKey}
                  selected={selectedIds.has(itemKey)}
                  onToggle={toggleSelection}
                  selectionMode={selectionMode}
                >
                  <MediaCard
                    item={item}
                    type={item.type}
                    onClick={() => handleItemClick(item)}
                  />
                </SelectableItem>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {sortedItems.map((item) => {
              const itemKey = `${item.type}-${item.id}`;
              return (
                <SelectableItem
                  key={itemKey}
                  id={itemKey}
                  selected={selectedIds.has(itemKey)}
                  onToggle={toggleSelection}
                  selectionMode={selectionMode}
                >
                  <MediaListItem
                    item={item}
                    type={item.type}
                    onClick={() => handleItemClick(item)}
                  />
                </SelectableItem>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </DropZone>
  );
}
