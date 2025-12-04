import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Check, ImageIcon, RefreshCw, AlertCircle } from "lucide-react";

interface CoverOption {
  url: string;
  source: "openlibrary" | "googlebooks";
  previewUrl: string;
  workTitle?: string;
  workId?: string;
}

interface CoverSearchResult {
  success: boolean;
  covers: CoverOption[];
  error?: string;
}

interface CoverPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemType: "book" | "audiobook";
  itemTitle: string;
  currentCover?: string | null;
  onCoverUpdated?: () => void;
}

export function CoverPickerModal({
  open,
  onOpenChange,
  itemId,
  itemType,
  itemTitle,
  currentCover,
  onCoverUpdated,
}: CoverPickerModalProps) {
  const { toast } = useToast();
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("search");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBase = itemType === "book" ? "/api/books" : "/api/audiobooks";

  const {
    data: searchResult,
    isLoading: isSearching,
    refetch: refetchCovers,
    isRefetching,
  } = useQuery<CoverSearchResult>({
    queryKey: [`${apiBase}/${itemId}/covers`],
    enabled: open,
    staleTime: 30000,
  });

  const selectCoverMutation = useMutation({
    mutationFn: async (coverUrl: string) => {
      const response = await apiRequest("POST", `${apiBase}/${itemId}/cover/select`, {
        coverUrl,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase, itemId] });
      queryClient.invalidateQueries({ queryKey: [apiBase] });
      toast({
        title: "Cover updated",
        description: "The cover has been updated successfully.",
      });
      onOpenChange(false);
      onCoverUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update cover",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const uploadCoverMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("cover", file);

      const response = await fetch(`${apiBase}/${itemId}/cover/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBase, itemId] });
      queryClient.invalidateQueries({ queryKey: [apiBase] });
      toast({
        title: "Cover uploaded",
        description: "Your custom cover has been uploaded successfully.",
      });
      onOpenChange(false);
      onCoverUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload cover.",
        variant: "destructive",
      });
    },
  });

  const handleSelectCover = (cover: CoverOption) => {
    setSelectedCover(cover.url);
  };

  const handleConfirmSelection = () => {
    if (selectedCover) {
      selectCoverMutation.mutate(selectedCover);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      uploadCoverMutation.mutate(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const isLoading = isSearching || isRefetching;
  const isMutating = selectCoverMutation.isPending || uploadCoverMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose a Cover</DialogTitle>
          <DialogDescription>
            Select a cover for "{itemTitle}" or upload your own
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" data-testid="tab-search-covers">
              <ImageIcon className="h-4 w-4 mr-2" />
              Available Covers
            </TabsTrigger>
            <TabsTrigger value="upload" data-testid="tab-upload-cover">
              <Upload className="h-4 w-4 mr-2" />
              Upload Custom
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {searchResult?.covers?.length || 0} covers found from Open Library and Google Books
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchCovers()}
                disabled={isLoading}
                data-testid="button-refresh-covers"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Searching for covers...</span>
              </div>
            ) : searchResult?.covers && searchResult.covers.length > 0 ? (
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 p-1">
                  {searchResult.covers.map((cover, index) => (
                    <button
                      key={cover.workId || index}
                      onClick={() => handleSelectCover(cover)}
                      className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary ${
                        selectedCover === cover.url
                          ? "border-primary ring-2 ring-primary"
                          : "border-transparent hover:border-muted-foreground/50"
                      }`}
                      data-testid={`cover-option-${index}`}
                    >
                      <img
                        src={cover.previewUrl}
                        alt={cover.workTitle || "Cover option"}
                        className="w-full h-full object-cover bg-muted"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = "";
                          e.currentTarget.className = "w-full h-full bg-muted flex items-center justify-center";
                        }}
                      />
                      {selectedCover === cover.url && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <span className="text-[10px] text-white uppercase tracking-wide">
                          {cover.source === "openlibrary" ? "Open Library" : "Google Books"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No covers found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We couldn't find any covers for this title. You can upload your own cover image.
                </p>
                <Button onClick={() => setActiveTab("upload")} variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Custom Cover
                </Button>
              </div>
            )}

            {searchResult?.covers && searchResult.covers.length > 0 && (
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMutating}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSelection}
                  disabled={!selectedCover || isMutating}
                  data-testid="button-confirm-cover"
                >
                  {selectCoverMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Use Selected Cover
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="flex-1 flex flex-col mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-cover-file"
            />

            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
              {uploadCoverMutation.isPending ? (
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="font-medium">Uploading cover...</p>
                  <p className="text-sm text-muted-foreground">This may take a moment</p>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">Upload your own cover</h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                    Choose an image file from your device. Supports JPG, PNG, WebP, and other image formats up to 10MB.
                  </p>
                  <Button onClick={triggerFileUpload} data-testid="button-upload-cover">
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                </>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMutating}>
                Cancel
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
