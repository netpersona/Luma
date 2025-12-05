import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Headphones,
  Search,
  ChevronRight,
  Library,
  CheckCircle2,
  Clock,
  BookMarked,
} from "lucide-react";
import type { Book, Audiobook } from "@shared/schema";

interface SeriesGroup {
  name: string;
  books: (Book & { type: "book" })[];
  audiobooks: (Audiobook & { type: "audiobook" })[];
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  coverUrl?: string;
}

export default function Series() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: books, isLoading: booksLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const { data: audiobooks, isLoading: audiobooksLoading } = useQuery<Audiobook[]>({
    queryKey: ["/api/audiobooks"],
  });

  const { data: progress } = useQuery<any[]>({
    queryKey: ["/api/progress"],
  });

  const isLoading = booksLoading || audiobooksLoading;

  const seriesGroups = useMemo(() => {
    if (!books && !audiobooks) return [];

    const groups = new Map<string, SeriesGroup>();

    const allBooks = books || [];
    const allAudiobooks = audiobooks || [];
    const allProgress = progress || [];

    const progressMap = new Map<string, any>();
    for (const p of allProgress) {
      const key = `${p.bookType}-${p.bookId}`;
      progressMap.set(key, p);
    }

    for (const book of allBooks) {
      if (!book.series) continue;

      const seriesName = book.series.trim();
      if (!groups.has(seriesName)) {
        groups.set(seriesName, {
          name: seriesName,
          books: [],
          audiobooks: [],
          totalItems: 0,
          completedItems: 0,
          inProgressItems: 0,
        });
      }

      const group = groups.get(seriesName)!;
      group.books.push({ ...book, type: "book" });
      group.totalItems++;

      const progressEntry = progressMap.get(`book-${book.id}`);
      if (progressEntry) {
        if (progressEntry.percentage >= 95) {
          group.completedItems++;
        } else if (progressEntry.percentage > 0) {
          group.inProgressItems++;
        }
      }

      if (!group.coverUrl && book.coverUrl) {
        group.coverUrl = book.coverUrl;
      }
    }

    for (const audiobook of allAudiobooks) {
      if (!audiobook.series) continue;

      const seriesName = audiobook.series.trim();
      if (!groups.has(seriesName)) {
        groups.set(seriesName, {
          name: seriesName,
          books: [],
          audiobooks: [],
          totalItems: 0,
          completedItems: 0,
          inProgressItems: 0,
        });
      }

      const group = groups.get(seriesName)!;
      group.audiobooks.push({ ...audiobook, type: "audiobook" });
      group.totalItems++;

      const progressEntry = progressMap.get(`audiobook-${audiobook.id}`);
      if (progressEntry) {
        if (progressEntry.percentage >= 95) {
          group.completedItems++;
        } else if (progressEntry.percentage > 0) {
          group.inProgressItems++;
        }
      }

      if (!group.coverUrl && audiobook.coverUrl) {
        group.coverUrl = audiobook.coverUrl;
      }
    }

    const groupsArray = Array.from(groups.values());
    for (const group of groupsArray) {
      group.books.sort((a: Book & { type: "book" }, b: Book & { type: "book" }) => {
        const indexA = a.seriesIndex ?? Infinity;
        const indexB = b.seriesIndex ?? Infinity;
        return indexA - indexB;
      });
      group.audiobooks.sort((a: Audiobook & { type: "audiobook" }, b: Audiobook & { type: "audiobook" }) => {
        const indexA = a.seriesIndex ?? Infinity;
        const indexB = b.seriesIndex ?? Infinity;
        return indexA - indexB;
      });
    }

    return groupsArray.sort((a: SeriesGroup, b: SeriesGroup) => {
      const progressA = a.completedItems / a.totalItems;
      const progressB = b.completedItems / b.totalItems;
      if (a.inProgressItems > 0 && b.inProgressItems === 0) return -1;
      if (b.inProgressItems > 0 && a.inProgressItems === 0) return 1;
      return progressB - progressA;
    });
  }, [books, audiobooks, progress]);

  const filteredSeries = useMemo(() => {
    if (!searchQuery.trim()) return seriesGroups;
    const query = searchQuery.toLowerCase();
    return seriesGroups.filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.books.some(
          (b) =>
            b.title.toLowerCase().includes(query) ||
            (b.author?.toLowerCase()?.includes(query) ?? false)
        ) ||
        group.audiobooks.some(
          (a) =>
            a.title.toLowerCase().includes(query) ||
            (a.author?.toLowerCase()?.includes(query) ?? false)
        )
    );
  }, [seriesGroups, searchQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen overflow-auto bg-background texture-paper">
        <div className="container max-w-7xl mx-auto p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-auto bg-background texture-paper">
      <div className="container max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Library className="h-7 w-7" />
            Series
          </h1>
          <p className="text-muted-foreground">
            {seriesGroups.length} series in your library
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search series, books, or authors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-series"
          />
        </div>

        {filteredSeries.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
            <BookMarked className="h-16 w-16 text-muted-foreground opacity-40" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {searchQuery ? "No matching series found" : "No series in your library"}
              </h3>
              <p className="text-muted-foreground max-w-md">
                {searchQuery
                  ? "Try a different search term"
                  : "Books and audiobooks with series metadata will appear here grouped together"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSeries.map((group) => (
              <SeriesCard key={group.name} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SeriesCard({ group }: { group: SeriesGroup }) {
  const progressPercentage =
    group.totalItems > 0
      ? Math.round((group.completedItems / group.totalItems) * 100)
      : 0;

  const allItems = [
    ...group.books.map((b) => ({ ...b, itemType: "book" as const })),
    ...group.audiobooks.map((a) => ({ ...a, itemType: "audiobook" as const })),
  ].sort((a, b) => {
    const indexA = a.seriesIndex ?? Infinity;
    const indexB = b.seriesIndex ?? Infinity;
    return indexA - indexB;
  });

  const displayItems = allItems.slice(0, 4);
  const remainingCount = allItems.length - displayItems.length;

  return (
    <Card
      className="flex flex-col overflow-hidden hover-elevate transition-all"
      data-testid={`card-series-${group.name.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-2">{group.name}</CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {group.totalItems} {group.totalItems === 1 ? "item" : "items"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {group.completedItems}/{group.totalItems} completed
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {group.books.length > 0 && (
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span>{group.books.length}</span>
            </div>
          )}
          {group.audiobooks.length > 0 && (
            <div className="flex items-center gap-1">
              <Headphones className="h-4 w-4" />
              <span>{group.audiobooks.length}</span>
            </div>
          )}
          {group.inProgressItems > 0 && (
            <div className="flex items-center gap-1 text-primary">
              <Clock className="h-4 w-4" />
              <span>{group.inProgressItems} in progress</span>
            </div>
          )}
        </div>

        <ScrollArea className="h-[140px]">
          <div className="space-y-2">
            {displayItems.map((item) => (
              <Link
                key={`${item.itemType}-${item.id}`}
                href={
                  item.itemType === "book"
                    ? `/books/${item.id}`
                    : `/audiobooks/${item.id}`
                }
              >
                <div
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer group"
                  data-testid={`item-${item.itemType}-${item.id}`}
                >
                  <div className="w-8 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {item.itemType === "book" ? (
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Headphones className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.seriesIndex && (
                        <span className="text-xs text-muted-foreground font-medium">
                          #{item.seriesIndex}
                        </span>
                      )}
                      <span className="text-sm font-medium truncate">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.author || "Unknown Author"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
            {remainingCount > 0 && (
              <div className="text-center text-sm text-muted-foreground py-2">
                +{remainingCount} more
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
