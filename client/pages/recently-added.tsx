import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MediaCard } from "@/components/media-card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Headphones } from "lucide-react";
import type { BookWithProgress, AudiobookWithProgress } from "@shared/schema";

export default function RecentlyAdded() {
  const [, setLocation] = useLocation();

  const { data: books = [], isLoading: booksLoading } = useQuery<BookWithProgress[]>({
    queryKey: ["/api/books"],
  });

  const { data: audiobooks = [], isLoading: audiobooksLoading } = useQuery<AudiobookWithProgress[]>({
    queryKey: ["/api/audiobooks"],
  });

  const isLoading = booksLoading || audiobooksLoading;

  // Combine and sort by added date
  const allItems = [
    ...books.map((book) => ({ ...book, type: "book" as const })),
    ...audiobooks.map((audiobook) => ({ ...audiobook, type: "audiobook" as const })),
  ].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  // Take the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentItems = allItems.filter(
    (item) => new Date(item.addedAt) > thirtyDaysAgo
  );

  const handleItemClick = (item: typeof allItems[0]) => {
    setLocation(`/${item.type}s/${item.id}`);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Recently Added</h1>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : recentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
            <div className="flex gap-4">
              <BookOpen className="h-16 w-16 text-muted-foreground" />
              <Headphones className="h-16 w-16 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">No recent additions</h2>
              <p className="text-muted-foreground max-w-md">
                Items added in the last 30 days will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {recentItems.map((item) => (
              <MediaCard
                key={`${item.type}-${item.id}`}
                item={item}
                type={item.type}
                onClick={() => handleItemClick(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
