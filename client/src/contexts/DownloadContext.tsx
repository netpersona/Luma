import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface DownloadItem {
  id: string;
  title: string;
  author: string;
  format: string;
  cover_url?: string;
  isbn?: string;
  status: "pending" | "downloading" | "completed" | "failed";
  error?: string;
  startedAt: Date;
}

interface DownloadContextType {
  downloads: DownloadItem[];
  activeDownloads: DownloadItem[];
  addDownload: (item: Omit<DownloadItem, "status" | "startedAt">) => Promise<void>;
  isDownloading: (id: string) => boolean;
  clearCompleted: () => void;
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

export function useDownloads() {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error("useDownloads must be used within a DownloadProvider");
  }
  return context;
}

interface DownloadProviderProps {
  children: ReactNode;
}

export function DownloadProvider({ children }: DownloadProviderProps) {
  const { toast } = useToast();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  const activeDownloads = downloads.filter(
    (d) => d.status === "pending" || d.status === "downloading"
  );

  const isDownloading = useCallback(
    (id: string) => {
      return downloads.some(
        (d) => d.id === id && (d.status === "pending" || d.status === "downloading")
      );
    },
    [downloads]
  );

  const updateDownload = useCallback((id: string, updates: Partial<DownloadItem>) => {
    setDownloads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  }, []);

  const addDownload = useCallback(
    async (item: Omit<DownloadItem, "status" | "startedAt">): Promise<void> => {
      if (isDownloading(item.id)) {
        return;
      }

      const newDownload: DownloadItem = {
        ...item,
        status: "downloading",
        startedAt: new Date(),
      };

      setDownloads((prev) => [...prev, newDownload]);
      setIsMinimized(false);

      try {
        await apiRequest("POST", "/api/integrations/annas-archive/download", {
          md5: item.id,
          title: item.title,
          author: item.author,
          format: item.format,
          cover_url: item.cover_url,
          isbn: item.isbn,
        });

        updateDownload(item.id, { status: "completed" });
        queryClient.invalidateQueries({ queryKey: ["/api/books"] });

        toast({
          title: "Download complete",
          description: `"${item.title}" has been added to your library`,
        });
      } catch (error: any) {
        updateDownload(item.id, {
          status: "failed",
          error: error.message || "Download failed",
        });

        toast({
          title: "Download failed",
          description: error.message || `Failed to download "${item.title}"`,
          variant: "destructive",
        });
        
        throw error;
      }
    },
    [isDownloading, updateDownload, toast]
  );

  const clearCompleted = useCallback(() => {
    setDownloads((prev) =>
      prev.filter((d) => d.status === "pending" || d.status === "downloading")
    );
  }, []);

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        activeDownloads,
        addDownload,
        isDownloading,
        clearCompleted,
        isMinimized,
        setIsMinimized,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
}
