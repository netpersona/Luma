import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpen, Headphones, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LazyImage } from "@/components/lazy-image";
import type { BookWithProgress, AudiobookWithProgress } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface RecentItemsResponse {
  books: BookWithProgress[];
  audiobooks: AudiobookWithProgress[];
}

type RecentItem = (BookWithProgress & { type: "book" }) | (AudiobookWithProgress & { type: "audiobook" });

export function ContinueReadingBanner() {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery<RecentItemsResponse>({
    queryKey: ["/api/recent?limit=1"],
  });

  if (isLoading || dismissed) {
    return null;
  }

  const allItems: RecentItem[] = [
    ...(data?.books?.map((book) => ({ ...book, type: "book" as const })) || []),
    ...(data?.audiobooks?.map((audiobook) => ({ ...audiobook, type: "audiobook" as const })) || []),
  ];

  allItems.sort((a, b) => {
    const aDate = a.type === "book" 
      ? new Date(a.progress?.lastReadAt || 0) 
      : new Date(a.progress?.lastListenedAt || 0);
    const bDate = b.type === "book" 
      ? new Date(b.progress?.lastReadAt || 0) 
      : new Date(b.progress?.lastListenedAt || 0);
    return bDate.getTime() - aDate.getTime();
  });

  const mostRecent = allItems[0];

  if (!mostRecent) {
    return null;
  }

  const handleResume = () => {
    if (mostRecent.type === "book") {
      setLocation(`/reader/${mostRecent.id}`);
    } else {
      setLocation(`/audiobook/${mostRecent.id}`);
    }
  };

  const getLastAccessedTime = (): string => {
    const date = mostRecent.type === "book" 
      ? mostRecent.progress?.lastReadAt 
      : mostRecent.progress?.lastListenedAt;
    if (!date) return "";
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const progressPercent = Math.round(mostRecent.progress?.progress || 0);

  return (
    <div 
      className="relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b"
      data-testid="continue-reading-banner"
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-4">
          <div 
            className="relative h-16 w-12 flex-shrink-0 rounded-md overflow-hidden bg-muted shadow-md cursor-pointer"
            onClick={handleResume}
          >
            {mostRecent.coverUrl ? (
              <LazyImage
                src={mostRecent.coverUrl}
                alt={mostRecent.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                {mostRecent.type === "book" ? (
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                ) : (
                  <Headphones className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
              <span className="font-medium text-primary">Continue {mostRecent.type === "book" ? "Reading" : "Listening"}</span>
              <span>·</span>
              <span>{getLastAccessedTime()}</span>
            </div>
            <h3 
              className="font-semibold text-sm md:text-base truncate cursor-pointer hover:text-primary transition-colors"
              onClick={handleResume}
              title={mostRecent.title}
            >
              {mostRecent.title}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {mostRecent.author || "Unknown Author"}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <Progress 
                value={progressPercent} 
                className="h-1.5 flex-1 max-w-[200px]" 
              />
              <span className="text-xs text-muted-foreground font-medium">
                {progressPercent}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleResume}
              className="gap-2"
              data-testid="button-continue-reading"
            >
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Resume</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setDismissed(true)}
              data-testid="button-dismiss-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
