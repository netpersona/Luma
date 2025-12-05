import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Download,
  ExternalLink,
  Star,
  Library,
  Search,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SimilarBook {
  source: "openlibrary" | "googlebooks" | "annas-archive";
  id: string;
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  isbn?: string;
  publishedYear?: number;
  publisher?: string;
  subjects?: string[];
  rating?: number;
  pageCount?: number;
  format?: string;
  downloadable?: boolean;
  md5?: string;
}

interface MoreLikeThisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  author?: string;
  subjects?: string[];
  isbn?: string;
}

const sourceLabels: Record<string, { label: string; color: string }> = {
  openlibrary: { label: "Open Library", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  googlebooks: { label: "Google Books", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  "annas-archive": { label: "Anna's Archive", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
};

export function MoreLikeThisModal({
  open,
  onOpenChange,
  title,
  author,
  subjects,
  isbn,
}: MoreLikeThisModalProps) {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<{
    query: { title: string; author?: string; subjects: string[] };
    total: number;
    results: SimilarBook[];
  }>({
    queryKey: ["/api/similar-books", title, author, subjects?.join(","), isbn],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("title", title);
      if (author) params.set("author", author);
      if (subjects?.length) params.set("subjects", subjects.join(","));
      if (isbn) params.set("isbn", isbn);
      
      const response = await fetch(`/api/similar-books?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch similar books");
      return response.json();
    },
    enabled: open && !!title,
    staleTime: 5 * 60 * 1000,
  });

  const downloadMutation = useMutation({
    mutationFn: async (book: SimilarBook) => {
      if (book.source !== "annas-archive" || !book.md5) {
        throw new Error("This book is not available for download");
      }

      const response = await apiRequest("POST", "/api/integrations/annas-archive/download", {
        md5: book.md5,
        title: book.title,
        author: book.author,
        format: book.format || "epub",
        cover_url: book.coverUrl,
        isbn: book.isbn,
      });

      return response;
    },
    onSuccess: (_, book) => {
      setDownloadedIds(prev => new Set(prev).add(book.id));
      toast({
        title: "Download Complete",
        description: `"${book.title}" has been added to your library.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download the book",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDownloadingId(null);
    },
  });

  const handleDownload = async (book: SimilarBook) => {
    setDownloadingId(book.id);
    downloadMutation.mutate(book);
  };

  const results = data?.results || [];
  const downloadableBooks = results.filter(b => b.downloadable);
  const referenceBooks = results.filter(b => !b.downloadable);

  const renderBookCard = (book: SimilarBook) => {
    const isDownloading = downloadingId === book.id;
    const isDownloaded = downloadedIds.has(book.id);
    const sourceInfo = sourceLabels[book.source];

    return (
      <div
        key={`${book.source}-${book.id}`}
        className="flex gap-4 p-4 border rounded-lg hover-elevate"
        data-testid={`similar-book-${book.id}`}
      >
        {/* Cover Image */}
        <div className="flex-shrink-0 w-20 h-28 rounded overflow-hidden bg-muted">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Book Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm line-clamp-2">{book.title}</h4>
            <Badge variant="secondary" className={`flex-shrink-0 text-xs ${sourceInfo.color}`}>
              {sourceInfo.label}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-1">{book.author}</p>

          <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
            {book.publishedYear && <span>{book.publishedYear}</span>}
            {book.pageCount && <span>{book.pageCount} pages</span>}
            {book.rating && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {book.rating.toFixed(1)}
              </span>
            )}
            {book.format && (
              <Badge variant="outline" className="text-xs uppercase">
                {book.format}
              </Badge>
            )}
          </div>

          {book.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {book.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {book.downloadable && book.md5 ? (
              <Button
                size="sm"
                onClick={() => handleDownload(book)}
                disabled={isDownloading || isDownloaded}
                data-testid={`button-download-${book.id}`}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Downloading...
                  </>
                ) : isDownloaded ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Added to Library
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const searchQuery = encodeURIComponent(`${book.title} ${book.author}`);
                  if (book.source === "openlibrary") {
                    window.open(`https://openlibrary.org${book.id}`, "_blank");
                  } else if (book.source === "googlebooks") {
                    window.open(`https://books.google.com/books?id=${book.id}`, "_blank");
                  }
                }}
                data-testid={`button-view-${book.id}`}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View Details
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            More Like "{title}"
          </DialogTitle>
          <DialogDescription>
            Find similar books from multiple sources
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4 p-4 border rounded-lg">
                <Skeleton className="w-20 h-28 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground">Failed to load similar books</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error).message}
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Library className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No similar books found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting the search criteria
            </p>
          </div>
        ) : (
          <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({results.length})
              </TabsTrigger>
              <TabsTrigger value="downloadable" data-testid="tab-downloadable">
                <Download className="h-4 w-4 mr-1" />
                Downloadable ({downloadableBooks.length})
              </TabsTrigger>
              <TabsTrigger value="reference" data-testid="tab-reference">
                <BookOpen className="h-4 w-4 mr-1" />
                Reference ({referenceBooks.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-4 overflow-y-auto min-h-0">
              <TabsContent value="all" className="space-y-3 m-0 pr-2">
                {results.map(renderBookCard)}
              </TabsContent>
              <TabsContent value="downloadable" className="space-y-3 m-0 pr-2">
                {downloadableBooks.length > 0 ? (
                  downloadableBooks.map(renderBookCard)
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No downloadable books found</p>
                    <p className="text-sm mt-1">Configure Anna's Archive in Settings to enable downloads</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="reference" className="space-y-3 m-0 pr-2">
                {referenceBooks.length > 0 ? (
                  referenceBooks.map(renderBookCard)
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No reference books found
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
