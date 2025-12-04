import { useState } from "react";
import { Search, SlidersHorizontal, Grid3x3, List, X, Star, Calendar, BookOpen, FileType, Tags } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/components/ui/drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

export type ReadStatus = "all" | "unread" | "reading" | "completed";
export type DateRange = "all" | "7days" | "30days" | "year";
export type RatingFilter = "all" | "unrated" | "1" | "2" | "3" | "4" | "5";

export interface AdvancedFilters {
  readStatus: ReadStatus;
  format: string[];
  dateRange: DateRange;
  rating: RatingFilter;
  tags: string[];
}

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  filterType?: "all" | "book" | "audiobook";
  onFilterTypeChange?: (type: "all" | "book" | "audiobook") => void;
  advancedFilters?: AdvancedFilters;
  onAdvancedFiltersChange?: (filters: AdvancedFilters) => void;
  availableFormats?: string[];
  availableTags?: string[];
}

const defaultAdvancedFilters: AdvancedFilters = {
  readStatus: "all",
  format: [],
  dateRange: "all",
  rating: "all",
  tags: [],
};

interface FilterContentProps {
  advancedFilters: AdvancedFilters;
  updateFilter: <K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
  availableFormats: string[];
  availableTags: string[];
  toggleFormat: (format: string) => void;
  toggleTag: (tag: string) => void;
}

function FilterContent({
  advancedFilters,
  updateFilter,
  clearAllFilters,
  hasActiveFilters,
  availableFormats,
  availableTags,
  toggleFormat,
  toggleTag,
}: FilterContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Filters</h4>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-auto p-1 text-muted-foreground hover:text-foreground"
            data-testid="button-clear-filters"
          >
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>
      
      <Separator />

      {/* Read Status Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          Read Status
        </div>
        <Select 
          value={advancedFilters.readStatus} 
          onValueChange={(value: ReadStatus) => updateFilter("readStatus", value)}
        >
          <SelectTrigger className="w-full" data-testid="select-read-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="reading">Reading</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Format Filter */}
      {availableFormats.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileType className="h-4 w-4" />
            Format
          </div>
          <div className="flex flex-wrap gap-2">
            {availableFormats.map((format) => (
              <Badge
                key={format}
                variant={advancedFilters.format.includes(format) ? "default" : "outline"}
                className="cursor-pointer uppercase"
                onClick={() => toggleFormat(format)}
                data-testid={`filter-format-${format}`}
              >
                {format}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Date Added Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4" />
          Date Added
        </div>
        <Select 
          value={advancedFilters.dateRange} 
          onValueChange={(value: DateRange) => updateFilter("dateRange", value)}
        >
          <SelectTrigger className="w-full" data-testid="select-date-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rating Filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Star className="h-4 w-4" />
          Minimum Rating
        </div>
        <Select 
          value={advancedFilters.rating} 
          onValueChange={(value: RatingFilter) => updateFilter("rating", value)}
        >
          <SelectTrigger className="w-full" data-testid="select-rating">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Rating</SelectItem>
            <SelectItem value="unrated">Unrated Only</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4 Stars or Higher</SelectItem>
            <SelectItem value="3">3 Stars or Higher</SelectItem>
            <SelectItem value="2">2 Stars or Higher</SelectItem>
            <SelectItem value="1">1 Star or Higher</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags Filter */}
      {availableTags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tags className="h-4 w-4" />
            Tags
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                variant={advancedFilters.tags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTag(tag)}
                data-testid={`filter-tag-${tag}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  filterType = "all",
  onFilterTypeChange,
  advancedFilters = defaultAdvancedFilters,
  onAdvancedFiltersChange,
  availableFormats = [],
  availableTags = [],
}: FilterBarProps) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hasActiveFilters = 
    advancedFilters.readStatus !== "all" ||
    advancedFilters.format.length > 0 ||
    advancedFilters.dateRange !== "all" ||
    advancedFilters.rating !== "all" ||
    advancedFilters.tags.length > 0;

  const activeFilterCount = 
    (advancedFilters.readStatus !== "all" ? 1 : 0) +
    (advancedFilters.format.length > 0 ? 1 : 0) +
    (advancedFilters.dateRange !== "all" ? 1 : 0) +
    (advancedFilters.rating !== "all" ? 1 : 0) +
    (advancedFilters.tags.length > 0 ? 1 : 0);

  const updateFilter = <K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) => {
    if (onAdvancedFiltersChange) {
      onAdvancedFiltersChange({ ...advancedFilters, [key]: value });
    }
  };

  const clearAllFilters = () => {
    if (onAdvancedFiltersChange) {
      onAdvancedFiltersChange({
        readStatus: "all",
        format: [],
        dateRange: "all",
        rating: "all",
        tags: [],
      });
    }
  };

  const toggleFormat = (format: string) => {
    const newFormats = advancedFilters.format.includes(format)
      ? advancedFilters.format.filter(f => f !== format)
      : [...advancedFilters.format, format];
    updateFilter("format", newFormats);
  };

  const toggleTag = (tag: string) => {
    const newTags = advancedFilters.tags.includes(tag)
      ? advancedFilters.tags.filter(t => t !== tag)
      : [...advancedFilters.tags, tag];
    updateFilter("tags", newTags);
  };

  const filterContentProps: FilterContentProps = {
    advancedFilters,
    updateFilter,
    clearAllFilters,
    hasActiveFilters,
    availableFormats,
    availableTags,
    toggleFormat,
    toggleTag,
  };

  const filterButton = (
    <Button 
      variant={hasActiveFilters ? "default" : "outline"} 
      size="default"
      className="gap-2"
      data-testid="button-advanced-filters"
    >
      <SlidersHorizontal className="h-4 w-4" />
      <span className="hidden sm:inline">Filters</span>
      {activeFilterCount > 0 && (
        <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
          {activeFilterCount}
        </Badge>
      )}
    </Button>
  );

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4 space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search titles, authors, narrators..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-full md:w-[180px]" data-testid="select-sort">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently Added</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="author">Author</SelectItem>
              <SelectItem value="published">Publication Date</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
            </SelectContent>
          </Select>

          {onAdvancedFiltersChange && (
            <>
              {/* Mobile: Use Drawer for bottom sheet experience */}
              {isMobile ? (
                <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <DrawerTrigger asChild>
                    {filterButton}
                  </DrawerTrigger>
                  <DrawerContent data-testid="drawer-advanced-filters">
                    <DrawerHeader>
                      <DrawerTitle>Filters</DrawerTitle>
                    </DrawerHeader>
                    <ScrollArea className="max-h-[60vh] px-4 pb-4">
                      <FilterContent {...filterContentProps} />
                    </ScrollArea>
                    <div className="p-4 border-t">
                      <DrawerClose asChild>
                        <Button className="w-full" data-testid="button-apply-filters">
                          Apply Filters
                        </Button>
                      </DrawerClose>
                    </div>
                  </DrawerContent>
                </Drawer>
              ) : (
                /* Desktop: Use Popover */
                <Popover>
                  <PopoverTrigger asChild>
                    {filterButton}
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end" data-testid="popover-advanced-filters">
                    <FilterContent {...filterContentProps} />
                  </PopoverContent>
                </Popover>
              )}
            </>
          )}

          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onViewModeChange("grid")}
              data-testid="button-view-grid"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onViewModeChange("list")}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {onFilterTypeChange && (
        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={filterType === "all" ? "default" : "outline"}
            className="cursor-pointer hover-elevate active-elevate-2"
            onClick={() => onFilterTypeChange("all")}
            data-testid="filter-all"
          >
            All
          </Badge>
          <Badge
            variant={filterType === "book" ? "default" : "outline"}
            className="cursor-pointer hover-elevate active-elevate-2"
            onClick={() => onFilterTypeChange("book")}
            data-testid="filter-books"
          >
            Books
          </Badge>
          <Badge
            variant={filterType === "audiobook" ? "default" : "outline"}
            className="cursor-pointer hover-elevate active-elevate-2"
            onClick={() => onFilterTypeChange("audiobook")}
            data-testid="filter-audiobooks"
          >
            Audiobooks
          </Badge>
        </div>
      )}
    </div>
  );
}
