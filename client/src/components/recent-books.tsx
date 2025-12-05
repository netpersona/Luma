import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpen, Headphones, Play, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { LazyImage } from "@/components/lazy-image";
import type { BookWithProgress, AudiobookWithProgress } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface RecentItemsResponse {
  books: BookWithProgress[];
  audiobooks: AudiobookWithProgress[];
}

type RecentItem = (BookWithProgress & { type: "book" }) | (AudiobookWithProgress & { type: "audiobook" });

export function RecentBooks() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<RecentItemsResponse>({
    queryKey: ["/api/recent?limit=5"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Continue Reading
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-16 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const allItems: RecentItem[] = [
    ...(data?.books?.map((book) => ({ ...book, type: "book" as const })) || []),
    ...(data?.audiobooks?.map((audiobook) => ({ ...audiobook, type: "audiobook" as const })) || []),
  ];

  // Sort by last accessed date
  allItems.sort((a, b) => {
    const aDate = a.type === "book" 
      ? new Date(a.progress?.lastReadAt || 0) 
      : new Date(a.progress?.lastListenedAt || 0);
    const bDate = b.type === "book" 
      ? new Date(b.progress?.lastReadAt || 0) 
      : new Date(b.progress?.lastListenedAt || 0);
    return bDate.getTime() - aDate.getTime();
  });

  // Take top 5
  const recentItems = allItems.slice(0, 5);

  if (recentItems.length === 0) {
    return null;
  }

  const handleResumeClick = (item: RecentItem) => {
    if (item.type === "book") {
      setLocation(`/reader/${item.id}`);
    } else {
      setLocation(`/audiobook/${item.id}`);
    }
  };

  const getLastAccessedTime = (item: RecentItem): string => {
    const date = item.type === "book" 
      ? item.progress?.lastReadAt 
      : item.progress?.lastListenedAt;
    if (!date) return "";
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Continue Reading
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentItems.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover-elevate cursor-pointer"
              onClick={() => handleResumeClick(item)}
              data-testid={`recent-item-${item.type}-${item.id}`}
            >
              <div className="relative h-16 w-12 flex-shrink-0 rounded overflow-hidden bg-muted">
                {item.coverUrl ? (
                  <LazyImage
                    src={item.coverUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    {item.type === "book" ? (
                      <BookOpen className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <Headphones className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="absolute top-1 right-1">
                  {item.type === "audiobook" && (
                    <div className="p-0.5 rounded-full bg-primary/90">
                      <Headphones className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate" title={item.title}>
                  {item.title}
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {item.author || "Unknown Author"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress 
                    value={item.progress?.progress || 0} 
                    className="h-1.5 flex-1" 
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {Math.round(item.progress?.progress || 0)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getLastAccessedTime(item)}
                </p>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResumeClick(item);
                }}
                data-testid={`button-resume-${item.type}-${item.id}`}
              >
                <Play className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
