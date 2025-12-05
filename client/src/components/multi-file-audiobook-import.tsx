import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Loader2, 
  Music, 
  Clock, 
  ListMusic,
  Edit2,
  Check,
  X,
  FileArchive,
  GripVertical
} from "lucide-react";

interface TrackPreview {
  filename: string;
  title: string;
  trackIndex: number;
  duration: number;
  fileSize: number;
  bitrate?: number;
}

interface MultiFilePreview {
  importId: string;
  title: string;
  author: string;
  narrator?: string;
  description?: string;
  publisher?: string;
  totalDuration: number;
  totalSize: number;
  trackCount: number;
  tracks: TrackPreview[];
  hasCover: boolean;
}

interface EditableTrack {
  trackIndex: number;
  title: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MultiFileAudiobookImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<MultiFilePreview | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  
  const [editedTitle, setEditedTitle] = useState("");
  const [editedAuthor, setEditedAuthor] = useState("");
  const [editedNarrator, setEditedNarrator] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedPublisher, setEditedPublisher] = useState("");
  const [editedSeries, setEditedSeries] = useState("");
  const [editedSeriesIndex, setEditedSeriesIndex] = useState<number | undefined>(undefined);
  const [editedTracks, setEditedTracks] = useState<EditableTrack[]>([]);
  const [editingTrackIndex, setEditingTrackIndex] = useState<number | null>(null);
  
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("No preview to confirm");
      
      const response = await apiRequest("POST", `/api/audiobooks/confirm-import/${preview.importId}`, {
        title: editedTitle,
        author: editedAuthor,
        narrator: editedNarrator || undefined,
        description: editedDescription || undefined,
        publisher: editedPublisher || undefined,
        series: editedSeries || undefined,
        seriesIndex: editedSeriesIndex,
        editedTracks: editedTracks.filter(t => {
          const original = preview.tracks.find(ot => ot.trackIndex === t.trackIndex);
          return original && original.title !== t.title;
        }),
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Audiobook imported",
        description: `Successfully imported "${data.audiobook.title}" with ${data.trackCount} tracks`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast({
        title: "Invalid file",
        description: "Please select a ZIP file containing audio files",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/audiobooks/upload-multifile', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      const data = await response.json();
      setPreview(data);
      setEditedTitle(data.title || "");
      setEditedAuthor(data.author || "");
      setEditedNarrator(data.narrator || "");
      setEditedDescription(data.description || "");
      setEditedPublisher(data.publisher || "");
      setEditedSeries("");
      setEditedSeriesIndex(undefined);
      setEditedTracks(data.tracks.map((t: TrackPreview) => ({
        trackIndex: t.trackIndex,
        title: t.title,
      })));
      setShowDialog(true);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to process the zip file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [toast]);
  
  const handleCloseDialog = useCallback(() => {
    setShowDialog(false);
    setPreview(null);
    setEditedTracks([]);
    setEditingTrackIndex(null);
  }, []);
  
  const handleTrackTitleChange = useCallback((trackIndex: number, newTitle: string) => {
    setEditedTracks(tracks => 
      tracks.map(t => 
        t.trackIndex === trackIndex ? { ...t, title: newTitle } : t
      )
    );
  }, []);
  
  const handleConfirmImport = useCallback(() => {
    if (!editedTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for the audiobook",
        variant: "destructive",
      });
      return;
    }
    confirmMutation.mutate();
  }, [editedTitle, confirmMutation, toast]);
  
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-multifile-zip"
      />
      
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="gap-2"
        data-testid="button-import-multifile-audiobook"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileArchive className="h-4 w-4" />
        )}
        Import Multi-file Audiobook
      </Button>
      
      <Dialog open={showDialog} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListMusic className="h-5 w-5" />
              Review Audiobook Import
            </DialogTitle>
            <DialogDescription>
              Review and edit the metadata before importing. Found {preview?.trackCount || 0} tracks.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="Audiobook title"
                  data-testid="input-audiobook-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={editedAuthor}
                  onChange={(e) => setEditedAuthor(e.target.value)}
                  placeholder="Author name"
                  data-testid="input-audiobook-author"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="narrator">Narrator</Label>
                <Input
                  id="narrator"
                  value={editedNarrator}
                  onChange={(e) => setEditedNarrator(e.target.value)}
                  placeholder="Narrator name"
                  data-testid="input-audiobook-narrator"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publisher">Publisher</Label>
                <Input
                  id="publisher"
                  value={editedPublisher}
                  onChange={(e) => setEditedPublisher(e.target.value)}
                  placeholder="Publisher"
                  data-testid="input-audiobook-publisher"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="series">Series</Label>
                <Input
                  id="series"
                  value={editedSeries}
                  onChange={(e) => setEditedSeries(e.target.value)}
                  placeholder="Series name"
                  data-testid="input-audiobook-series"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seriesIndex">Series #</Label>
                <Input
                  id="seriesIndex"
                  type="number"
                  min={1}
                  value={editedSeriesIndex || ""}
                  onChange={(e) => setEditedSeriesIndex(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="1"
                  data-testid="input-audiobook-series-index"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Audiobook description"
                rows={2}
                className="resize-none"
                data-testid="input-audiobook-description"
              />
            </div>
            
            <div className="flex items-center gap-4 py-2 border-y">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Music className="h-4 w-4" />
                <span>{preview?.trackCount} tracks</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{preview ? formatDuration(preview.totalDuration) : '--:--'}</span>
              </div>
              <Badge variant={preview?.hasCover ? "default" : "secondary"}>
                {preview?.hasCover ? "Has cover" : "No cover"}
              </Badge>
              <span className="text-sm text-muted-foreground ml-auto">
                {preview ? formatFileSize(preview.totalSize) : '--'}
              </span>
            </div>
            
            <div className="flex-1 min-h-0">
              <Label className="mb-2 block">Tracks</Label>
              <ScrollArea className="h-[200px] border rounded-md">
                <div className="p-2 space-y-1">
                  {editedTracks.map((track) => {
                    const originalTrack = preview?.tracks.find(t => t.trackIndex === track.trackIndex);
                    const isEditing = editingTrackIndex === track.trackIndex;
                    
                    return (
                      <div
                        key={track.trackIndex}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
                        data-testid={`track-item-${track.trackIndex}`}
                      >
                        <span className="w-6 text-center text-sm text-muted-foreground">
                          {track.trackIndex + 1}
                        </span>
                        
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              value={track.title}
                              onChange={(e) => handleTrackTitleChange(track.trackIndex, e.target.value)}
                              className="h-8"
                              autoFocus
                              data-testid={`input-track-title-${track.trackIndex}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Escape') {
                                  setEditingTrackIndex(null);
                                }
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingTrackIndex(null)}
                              data-testid={`button-save-track-${track.trackIndex}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1 text-sm truncate">
                              {track.title}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setEditingTrackIndex(track.trackIndex)}
                              data-testid={`button-edit-track-${track.trackIndex}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        
                        <span className="w-16 text-right text-xs text-muted-foreground">
                          {originalTrack ? formatDuration(originalTrack.duration) : '--:--'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
          
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={confirmMutation.isPending}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={confirmMutation.isPending || !editedTitle.trim()}
              data-testid="button-confirm-import"
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Import Audiobook
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
