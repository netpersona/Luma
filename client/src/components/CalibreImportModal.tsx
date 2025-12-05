import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, 
  FolderOpen, 
  BookOpen, 
  Check, 
  AlertCircle,
  Library,
  RefreshCw
} from "lucide-react";

interface CalibreBook {
  id: number;
  title: string;
  author: string | null;
  formats: { format: string; filename: string; size: number }[];
  tags: string[];
}

interface ScanResult {
  success: boolean;
  libraryName?: string;
  books?: CalibreBook[];
  totalBooks?: number;
  error?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface CalibreImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "path" | "preview" | "importing" | "complete";

export function CalibreImportModal({ isOpen, onClose }: CalibreImportModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("path");
  const [libraryPath, setLibraryPath] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedBooks, setSelectedBooks] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const validateMutation = useMutation({
    mutationFn: async (path: string) => {
      const response = await apiRequest("POST", "/api/calibre/validate", { libraryPath: path });
      return response.json();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (path: string) => {
      const response = await apiRequest("POST", "/api/calibre/scan", { libraryPath: path });
      return response.json() as Promise<ScanResult>;
    },
    onSuccess: (data) => {
      setScanResult(data);
      if (data.books) {
        setSelectedBooks(new Set(data.books.map(b => b.id)));
      }
      setStep("preview");
    },
    onError: (error: Error) => {
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to scan Calibre library",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/calibre/import", {
        libraryPath,
        bookIds: Array.from(selectedBooks),
      });
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      
      if (data.imported > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully imported ${data.imported} book(s)`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import books",
        variant: "destructive",
      });
    },
  });

  const handleScan = async () => {
    if (!libraryPath.trim()) {
      toast({
        title: "Path Required",
        description: "Please enter the path to your Calibre library",
        variant: "destructive",
      });
      return;
    }

    const validation = await validateMutation.mutateAsync(libraryPath);
    if (!validation.valid) {
      toast({
        title: "Invalid Path",
        description: validation.error || "Invalid Calibre library path",
        variant: "destructive",
      });
      return;
    }

    scanMutation.mutate(libraryPath);
  };

  const handleImport = () => {
    if (selectedBooks.size === 0) {
      toast({
        title: "No Books Selected",
        description: "Please select at least one book to import",
        variant: "destructive",
      });
      return;
    }
    setStep("importing");
    importMutation.mutate();
  };

  const toggleBook = (bookId: number) => {
    const newSet = new Set(selectedBooks);
    if (newSet.has(bookId)) {
      newSet.delete(bookId);
    } else {
      newSet.add(bookId);
    }
    setSelectedBooks(newSet);
  };

  const toggleAll = () => {
    if (scanResult?.books) {
      if (selectedBooks.size === scanResult.books.length) {
        setSelectedBooks(new Set());
      } else {
        setSelectedBooks(new Set(scanResult.books.map(b => b.id)));
      }
    }
  };

  const handleClose = () => {
    setStep("path");
    setLibraryPath("");
    setScanResult(null);
    setSelectedBooks(new Set());
    setImportResult(null);
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isScanning = validateMutation.isPending || scanMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Import from Calibre
          </DialogTitle>
          <DialogDescription>
            {step === "path" && "Enter the path to your Calibre library folder"}
            {step === "preview" && `Found ${scanResult?.totalBooks || 0} books in your library`}
            {step === "importing" && "Importing selected books..."}
            {step === "complete" && "Import complete!"}
          </DialogDescription>
        </DialogHeader>

        {step === "path" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="library-path">Calibre Library Path</Label>
              <div className="flex gap-2">
                <Input
                  id="library-path"
                  data-testid="input-calibre-path"
                  placeholder="/path/to/Calibre Library"
                  value={libraryPath}
                  onChange={(e) => setLibraryPath(e.target.value)}
                  disabled={isScanning}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the full path to your Calibre library directory (contains metadata.db)
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleScan} 
                disabled={isScanning}
                data-testid="button-scan-library"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Scan Library
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && scanResult?.books && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedBooks.size === scanResult.books.length}
                  onCheckedChange={toggleAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm">
                  Select All ({selectedBooks.size} of {scanResult.books.length} selected)
                </span>
              </div>
            </div>

            <ScrollArea className="h-[300px] rounded-md border p-2">
              <div className="space-y-2">
                {scanResult.books.map((book) => {
                  const preferredFormat = book.formats[0];
                  return (
                    <div
                      key={book.id}
                      className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleBook(book.id)}
                      data-testid={`book-item-${book.id}`}
                    >
                      <Checkbox 
                        checked={selectedBooks.has(book.id)}
                        onCheckedChange={() => toggleBook(book.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{book.title}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {book.author || "Unknown Author"}
                        </div>
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          {preferredFormat && (
                            <span className="bg-muted px-1.5 py-0.5 rounded">
                              {preferredFormat.format}
                            </span>
                          )}
                          {preferredFormat && (
                            <span>{formatFileSize(preferredFormat.size)}</span>
                          )}
                          {book.tags.length > 0 && (
                            <span>{book.tags.slice(0, 2).join(", ")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep("path")}>
                Back
              </Button>
              <Button 
                onClick={handleImport}
                disabled={selectedBooks.size === 0}
                data-testid="button-import-books"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Import {selectedBooks.size} Book(s)
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Importing {selectedBooks.size} books...
              </p>
              <Progress value={50} className="w-full" />
            </div>
          </div>
        )}

        {step === "complete" && importResult && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-4 py-4">
              {importResult.imported > 0 ? (
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="rounded-full bg-yellow-100 dark:bg-yellow-900 p-3">
                  <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              )}
              
              <div className="text-center">
                <h3 className="font-semibold text-lg">Import Complete</h3>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p>Imported: {importResult.imported} book(s)</p>
                  <p>Skipped: {importResult.skipped} (already in library)</p>
                  {importResult.failed > 0 && (
                    <p className="text-red-500">Failed: {importResult.failed}</p>
                  )}
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <ScrollArea className="h-[100px] w-full rounded-md border p-2">
                  <div className="text-xs text-red-500 space-y-1">
                    {importResult.errors.map((error, idx) => (
                      <p key={idx}>{error}</p>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("path")}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Import More
              </Button>
              <Button onClick={handleClose} data-testid="button-close-import">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
