import { useState, useCallback, useRef, type ReactNode, type DragEvent } from "react";
import { Upload, FileUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DropZoneProps {
  children: ReactNode;
  onFilesDropped: (files: File[]) => void;
  allowedFileTypes?: string[];
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

const ALLOWED_EXTENSIONS = [".epub", ".pdf", ".mobi", ".cbz", ".cbr", ".m4b", ".mp3", ".m4a"];

export function DropZone({
  children,
  onFilesDropped,
  allowedFileTypes = ALLOWED_EXTENSIONS,
  maxFiles = 20,
  disabled = false,
  className,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (allowedFileTypes.includes(ext)) {
          valid.push(file);
        } else {
          errors.push(`${file.name}: Unsupported format`);
        }
      }

      if (valid.length > maxFiles) {
        errors.push(`Too many files. Maximum ${maxFiles} allowed.`);
        return { valid: valid.slice(0, maxFiles), errors };
      }

      return { valid, errors };
    },
    [allowedFileTypes, maxFiles]
  );

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      dragCounter.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
        setDragError(null);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      dragCounter.current = 0;

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const { valid, errors } = validateFiles(files);

      if (errors.length > 0) {
        setDragError(errors.join(", "));
        setTimeout(() => setDragError(null), 5000);
      }

      if (valid.length > 0) {
        onFilesDropped(valid);
      }
    },
    [disabled, validateFiles, onFilesDropped]
  );

  const dismissError = useCallback(() => {
    setDragError(null);
  }, []);

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          data-testid="drop-zone-overlay"
        >
          <div className="flex flex-col items-center gap-6 p-12 border-4 border-dashed border-primary rounded-3xl bg-card/90 shadow-2xl max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 rounded-full bg-primary/10">
              <FileUp className="h-16 w-16 text-primary animate-bounce" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold">Drop files here</h3>
              <p className="text-muted-foreground">
                Release to upload your books and audiobooks
              </p>
              <p className="text-sm text-muted-foreground">
                Supported: EPUB, PDF, MOBI, CBZ, CBR, M4B, MP3, M4A
              </p>
            </div>
          </div>
        </div>
      )}

      {dragError && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-destructive text-destructive-foreground rounded-lg shadow-lg animate-in slide-in-from-bottom-4 duration-300"
          data-testid="drop-zone-error"
        >
          <Upload className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{dragError}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-destructive-foreground/20"
            onClick={dismissError}
            data-testid="button-dismiss-error"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
