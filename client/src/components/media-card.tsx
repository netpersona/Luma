import { BookOpen, Headphones, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LazyImage } from "@/components/lazy-image";
import type { BookWithProgress, AudiobookWithProgress } from "@shared/schema";

type MediaItem = BookWithProgress | AudiobookWithProgress;

interface MediaCardProps {
  item: MediaItem;
  type: "book" | "audiobook";
  onClick?: () => void;
}

export function MediaCard({ item, type, onClick }: MediaCardProps) {
  const progress = item.progress?.progress || 0;
  const hasProgress = progress > 0;
  const progressLabel = hasProgress ? `, ${Math.round(progress)}% complete` : "";
  const ariaLabel = `${item.title}${item.author ? ` by ${item.author}` : ""}${progressLabel}. Click to ${type === "audiobook" ? "listen" : "read"}.`;

  return (
    <Card
      className="group cursor-pointer overflow-visible p-0 hover-elevate active-elevate-2"
      onClick={onClick}
      data-testid={`card-${type}-${item.id}`}
      role="article"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Cover Image */}
      <div className="relative aspect-[2/3] bg-muted overflow-hidden rounded-2xl">
        {item.coverUrl ? (
          <LazyImage
            src={item.coverUrl}
            alt={`Cover for ${item.title}`}
            className="w-full h-full"
            fallback={
              <div 
                className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10"
                role="img"
                aria-label={`No cover available for ${item.title}`}
              >
                {type === "audiobook" ? (
                  <Headphones className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/60" aria-hidden="true" />
                ) : (
                  <BookOpen className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/60" aria-hidden="true" />
                )}
              </div>
            }
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10"
            role="img"
            aria-label={`No cover available for ${item.title}`}
          >
            {type === "audiobook" ? (
              <Headphones className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/60" aria-hidden="true" />
            ) : (
              <BookOpen className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/60" aria-hidden="true" />
            )}
          </div>
        )}

        {/* Progress Indicator */}
        {hasProgress && (
          <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
            <Progress 
              value={progress} 
              className="h-1.5 bg-white/20" 
              aria-label={`Reading progress: ${Math.round(progress)}%`}
            />
          </div>
        )}

        {/* Hover Overlay */}
        <div 
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center backdrop-blur-[2px]"
          aria-hidden="true"
        >
          <Badge variant="secondary" className="text-sm font-medium px-4 py-2">
            {type === "audiobook" ? "Listen" : "Read"}
          </Badge>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-1">
        <h3
          className="font-semibold text-sm md:text-base line-clamp-2 leading-tight tracking-tight"
          title={item.title}
        >
          {item.title}
        </h3>
        {item.author && (
          <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
            {item.author}
          </p>
        )}
        {hasProgress && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5" aria-hidden="true">
            <Clock className="h-3 w-3" />
            <span>{Math.round(progress)}% complete</span>
          </div>
        )}
      </div>
    </Card>
  );
}
