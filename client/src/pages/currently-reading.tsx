import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MediaCard } from "@/components/media-card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Headphones } from "lucide-react";
import type { BookWithProgress, AudiobookWithProgress } from "@shared/schema";

export default function CurrentlyReading() {
  const [, setLocation] = useLocation();

  const { data: books = [], isLoading: booksLoading } = useQuery<BookWithProgress[]>({
    queryKey: ["/api/books"],
  });

  const { data: audiobooks = [], isLoading: audiobooksLoading } = useQuery<AudiobookWithProgress[]>({
    queryKey: ["/api/audiobooks"],
  });

  const isLoading = booksLoading || audiobooksLoading;

  // Filter items with progress
  const inProgressBooks = books
    .filter((book) => book.progress && book.progress.progress > 0 && !book.progress.completed)
    .map((book) => ({ ...book, type: "book" as const }));

  const inProgressAudiobooks = audiobooks
    .filter(
      (audiobook) =>
        audiobook.progress &&
        audiobook.progress.progress > 0 &&
        !audiobook.progress.completed
    )
    .map((audiobook) => ({ ...audiobook, type: "audiobook" as const }));

  const allInProgress = [...inProgressBooks, ...inProgressAudiobooks].sort((a, b) => {
    const aDate = a.progress?.lastReadAt || a.progress?.lastListenedAt;
    const bDate = b.progress?.lastReadAt || b.progress?.lastListenedAt;
    if (!aDate || !bDate) return 0;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  const handleItemClick = (item: typeof allInProgress[0]) => {
    setLocation(`/${item.type}s/${item.id}`);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Currently Reading & Listening</h1>

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
        ) : allInProgress.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
            <div className="flex gap-4">
              <BookOpen className="h-16 w-16 text-muted-foreground" />
              <Headphones className="h-16 w-16 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Nothing in progress</h2>
              <p className="text-muted-foreground max-w-md">
                Start reading or listening to something from your library to see it here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {allInProgress.map((item) => (
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
