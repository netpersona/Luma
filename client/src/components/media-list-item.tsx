import { BookOpen, Headphones, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LazyImage } from "@/components/lazy-image";
import type { BookWithProgress, AudiobookWithProgress } from "@shared/schema";

type MediaItem = BookWithProgress | AudiobookWithProgress;

interface MediaListItemProps {
  item: MediaItem;
  type: "book" | "audiobook";
  onClick?: () => void;
}

export function MediaListItem({ item, type, onClick }: MediaListItemProps) {
  const progress = item.progress?.progress || 0;
  const hasProgress = progress > 0;

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return null;
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div
      className="flex gap-4 p-4 border rounded-lg cursor-pointer hover-elevate active-elevate-2 bg-card"
      onClick={onClick}
      data-testid={`list-item-${type}-${item.id}`}
    >
      <div className="flex-shrink-0 w-16 h-24 bg-muted rounded-md overflow-hidden">
        {item.coverUrl ? (
          <LazyImage
            src={item.coverUrl}
            alt={item.title}
            className="w-full h-full"
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10">
                {type === "audiobook" ? (
                  <Headphones className="h-6 w-6 text-muted-foreground/60" />
                ) : (
                  <BookOpen className="h-6 w-6 text-muted-foreground/60" />
                )}
              </div>
            }
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10">
            {type === "audiobook" ? (
              <Headphones className="h-6 w-6 text-muted-foreground/60" />
            ) : (
              <BookOpen className="h-6 w-6 text-muted-foreground/60" />
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-base line-clamp-1" title={item.title}>
            {item.title}
          </h3>
          {item.author && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              by {item.author}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            {item.format}
          </Badge>
          {item.fileSize && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(item.fileSize)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Added {formatDate(item.addedAt)}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 w-32 flex flex-col justify-center items-end gap-2">
        {hasProgress ? (
          <>
            <div className="w-full">
              <Progress value={progress} className="h-2" />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{Math.round(progress)}%</span>
            </div>
          </>
        ) : (
          <Badge variant="secondary" className="text-xs">
            {type === "audiobook" ? "Not started" : "Unread"}
          </Badge>
        )}
      </div>
    </div>
  );
}
