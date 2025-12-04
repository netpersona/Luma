import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSwipe } from "@/hooks/use-swipe";
import type { BookWithProgress } from "@shared/schema";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfReader() {
  const [, params] = useRoute("/reader/pdf/:id");
  const [, setLocation] = useLocation();
  const bookId = params?.id;
  const [zoom, setZoom] = useState(1.0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(800);
  const currentPageRef = useRef(1);
  const totalPagesRef = useRef(0);

  const { data: book, isLoading, error } = useQuery<BookWithProgress>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (data: { bookId: string; lastPosition: string; progress: number }) => {
      return apiRequest("PUT", "/api/reading-progress", data);
    },
  });

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    totalPagesRef.current = numPages;
    
    if (book?.readingProgress?.lastPosition) {
      try {
        const position = JSON.parse(book.readingProgress.lastPosition);
        if (position.page) {
          setCurrentPage(position.page);
          currentPageRef.current = position.page;
        }
      } catch (e) {
        console.error("Failed to parse reading progress", e);
      }
    }
  };


  const handlePageChange = (newPage: number) => {
    if (!bookId || totalPages === 0) return;
    const page = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(page);
    currentPageRef.current = page;

    const progress = Math.round((page / totalPages) * 100);
    const progressData = {
      bookId,
      lastPosition: JSON.stringify({ page }),
      progress,
    };

    updateProgressMutation.mutate(progressData);
  };

  const handleBackClick = () => {
    if (bookId && totalPagesRef.current > 0) {
      const progress = Math.round((currentPageRef.current / totalPagesRef.current) * 100);
      const progressData = {
        bookId,
        lastPosition: JSON.stringify({ page: currentPageRef.current }),
        progress,
      };
      fetch('/api/reading-progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData),
        keepalive: true,
      }).catch(console.error);
    }
    setLocation(`/books/${bookId}`);
  };

  const handleZoomIn = () => setZoom(Math.min(2.0, zoom + 0.1));
  const handleZoomOut = () => setZoom(Math.max(0.5, zoom - 0.1));

  // Page navigation callbacks for swipe gestures
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  }, [currentPage]);

  // Swipe gesture support for touch devices
  const { handlers: swipeHandlers } = useSwipe({
    onSwipeLeft: goToNextPage,
    onSwipeRight: goToPrevPage,
  }, { threshold: 50 });

  useEffect(() => {
    return () => {
      if (bookId && totalPagesRef.current > 0) {
        const progress = Math.round((currentPageRef.current / totalPagesRef.current) * 100);
        const progressData = {
          bookId,
          lastPosition: JSON.stringify({ page: currentPageRef.current }),
          progress,
        };
        fetch('/api/reading-progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(progressData),
          keepalive: true,
        }).catch(console.error);
      }
    };
  }, [bookId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-destructive">Failed to load PDF</p>
        <Button onClick={() => setLocation("/books")} data-testid="button-back-to-library">
          Back to Library
        </Button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">Book not found</p>
        <Button onClick={() => setLocation("/books")} data-testid="button-back-to-library">
          Back to Library
        </Button>
      </div>
    );
  }

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <div className="h-screen flex flex-col bg-muted">
      <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
        <Button
          variant="ghost"
          onClick={handleBackClick}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-4">
          <Badge variant="outline" className="hidden md:block">
            {book.title}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm tabular-nums w-16 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div 
        className="flex-1 overflow-auto flex items-start justify-center p-8 bg-muted touch-pan-y" 
        {...swipeHandlers}
        data-testid="pdf-viewer-container"
      >
        {book && (
          <Document
            file={book.filePath}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="text-muted-foreground">Loading PDF...</div>
            }
            error={
              <div className="text-destructive">Failed to load PDF</div>
            }
          >
            <Page
              pageNumber={currentPage}
              width={pageWidth}
              scale={zoom}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <div className="bg-white shadow-lg p-12">
                  <div className="text-muted-foreground">Loading page...</div>
                </div>
              }
            />
          </Document>
        )}
      </div>

      <footer className="border-t p-4 bg-background">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 flex-1 justify-center">
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
              className="w-20 text-center"
              data-testid="input-page-number"
            />
            <span className="text-sm text-muted-foreground">of {totalPages}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            data-testid="button-next-page"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
