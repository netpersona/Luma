import { useDownloads } from "@/contexts/DownloadContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, X, Check, AlertCircle, Minimize2, Maximize2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function DownloadProgress() {
  const { downloads, activeDownloads, clearCompleted, isMinimized, setIsMinimized } = useDownloads();

  const hasDownloads = downloads.length > 0;
  const hasActiveDownloads = activeDownloads.length > 0;
  const completedCount = downloads.filter((d) => d.status === "completed").length;
  const failedCount = downloads.filter((d) => d.status === "failed").length;

  if (!hasDownloads) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50" data-testid="download-progress-minimized">
        <Button
          onClick={() => setIsMinimized(false)}
          className="gap-2 shadow-lg"
          variant="default"
          data-testid="button-expand-downloads"
        >
          <Download className={cn("h-4 w-4", hasActiveDownloads && "animate-bounce")} />
          {hasActiveDownloads ? (
            <span>{activeDownloads.length} downloading...</span>
          ) : (
            <span>
              {completedCount > 0 && `${completedCount} complete`}
              {failedCount > 0 && completedCount > 0 && ", "}
              {failedCount > 0 && `${failedCount} failed`}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80" data-testid="download-progress-panel">
      <Card className="shadow-xl border-2">
        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Download className={cn("h-4 w-4", hasActiveDownloads && "animate-bounce")} />
            Downloads
            {hasActiveDownloads && (
              <Badge variant="secondary" className="text-xs">
                {activeDownloads.length} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {!hasActiveDownloads && downloads.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={clearCompleted}
                title="Clear all"
                data-testid="button-clear-downloads"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsMinimized(true)}
              title="Minimize"
              data-testid="button-minimize-downloads"
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {downloads.map((download) => (
                <div
                  key={download.id}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded-md",
                    download.status === "downloading" && "bg-muted/50",
                    download.status === "completed" && "bg-green-500/10",
                    download.status === "failed" && "bg-destructive/10"
                  )}
                  data-testid={`download-item-${download.id}`}
                >
                  <div className="h-10 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {download.cover_url ? (
                      <img
                        src={download.cover_url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" title={download.title}>
                      {download.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {download.author}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {download.status === "downloading" && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Download className="h-3 w-3 animate-bounce" />
                          Downloading...
                        </Badge>
                      )}
                      {download.status === "completed" && (
                        <Badge variant="default" className="text-xs gap-1 bg-green-600">
                          <Check className="h-3 w-3" />
                          Complete
                        </Badge>
                      )}
                      {download.status === "failed" && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {download.format.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
