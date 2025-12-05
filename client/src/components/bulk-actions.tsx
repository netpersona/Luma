import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  BookCheck, 
  BookX, 
  FolderPlus, 
  Tags as TagsIcon, 
  Download,
  MoreHorizontal,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Collection } from "@shared/schema";

interface BulkActionsProps {
  selectedIds: Set<string>;
  itemType: "book" | "audiobook" | "mixed";
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleSelectionMode: () => void;
  selectionMode: boolean;
  totalCount: number;
}

export function BulkActions({
  selectedIds,
  itemType,
  onSelectAll,
  onDeselectAll,
  onToggleSelectionMode,
  selectionMode,
  totalCount,
}: BulkActionsProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [newTags, setNewTags] = useState("");
  const [tagAction, setTagAction] = useState<"add" | "replace">("add");

  const { data: collections = [] } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
    enabled: collectionDialogOpen,
  });

  const deleteItemsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const deletePromises = ids.map(async (id) => {
        const [type, itemId] = id.includes("-") ? [id.split("-")[0], id.split("-").slice(1).join("-")] : [itemType, id];
        const endpoint = type === "audiobook" ? `/api/audiobooks/${itemId}` : `/api/books/${itemId}`;
        return apiRequest("DELETE", endpoint);
      });
      return Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Items deleted",
        description: `Successfully deleted ${selectedIds.size} items.`,
      });
      setDeleteDialogOpen(false);
      onDeselectAll();
      onToggleSelectionMode();
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete items",
        variant: "destructive",
      });
    },
  });

  const addToCollectionMutation = useMutation({
    mutationFn: async ({ collectionId, ids }: { collectionId: string; ids: string[] }) => {
      const addPromises = ids.map(async (id) => {
        const [type, itemId] = id.includes("-") ? [id.split("-")[0], id.split("-").slice(1).join("-")] : [itemType, id];
        return apiRequest("POST", `/api/collections/${collectionId}/items`, {
          itemId,
          itemType: type,
        });
      });
      return Promise.all(addPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({
        title: "Added to collection",
        description: `Added ${selectedIds.size} items to collection.`,
      });
      onDeselectAll();
      setCollectionDialogOpen(false);
      setSelectedCollection("");
    },
    onError: (error) => {
      toast({
        title: "Failed to add to collection",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async ({ ids, completed }: { ids: string[]; completed: boolean }) => {
      const updatePromises = ids.map(async (id) => {
        const [type, itemId] = id.includes("-") ? [id.split("-")[0], id.split("-").slice(1).join("-")] : [itemType, id];
        const endpoint = type === "audiobook" 
          ? `/api/audiobooks/${itemId}/progress`
          : `/api/books/${itemId}/progress`;
        return apiRequest("PATCH", endpoint, {
          completed,
          progress: completed ? 100 : 0,
        });
      });
      return Promise.all(updatePromises);
    },
    onSuccess: (_, { completed }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: completed ? "Marked as complete" : "Marked as unread",
        description: `Updated ${selectedIds.size} items.`,
      });
      onDeselectAll();
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update items",
        variant: "destructive",
      });
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ ids, tags, action }: { ids: string[]; tags: string[]; action: "add" | "replace" }) => {
      const updatePromises = ids.map(async (id) => {
        const [type, itemId] = id.includes("-") ? [id.split("-")[0], id.split("-").slice(1).join("-")] : [itemType, id];
        const endpoint = type === "audiobook" ? `/api/audiobooks/${itemId}` : `/api/books/${itemId}`;
        return apiRequest("PATCH", endpoint, { tags, tagAction: action });
      });
      return Promise.all(updatePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Tags updated",
        description: `Updated tags for ${selectedIds.size} items.`,
      });
      onDeselectAll();
      setTagsDialogOpen(false);
      setNewTags("");
    },
    onError: (error) => {
      toast({
        title: "Failed to update tags",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleExportMetadata = () => {
    const ids = Array.from(selectedIds);
    const exportData = ids.map((id) => {
      const [type, itemId] = id.includes("-") ? [id.split("-")[0], id.split("-").slice(1).join("-")] : [itemType, id];
      return { id: itemId, type };
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `library-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export started",
      description: `Exported metadata for ${selectedIds.size} items.`,
    });
    onDeselectAll();
  };

  const handleDeleteConfirm = () => {
    deleteItemsMutation.mutate(Array.from(selectedIds));
  };

  const handleAddToCollection = () => {
    if (selectedCollection) {
      addToCollectionMutation.mutate({
        collectionId: selectedCollection,
        ids: Array.from(selectedIds),
      });
    }
  };

  const handleUpdateTags = () => {
    const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) {
      updateTagsMutation.mutate({
        ids: Array.from(selectedIds),
        tags,
        action: tagAction,
      });
    }
  };

  if (!selectionMode) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleSelectionMode}
        className="gap-2"
        data-testid="button-enter-selection-mode"
      >
        <CheckSquare className="h-4 w-4" />
        <span className="hidden sm:inline">Select</span>
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSelectionMode}
          className="gap-1"
          data-testid="button-exit-selection-mode"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Cancel</span>
        </Button>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
          className="gap-1"
          data-testid="button-select-all"
        >
          <CheckSquare className="h-4 w-4" />
          <span className="hidden sm:inline">All</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDeselectAll}
          disabled={selectedIds.size === 0}
          className="gap-1"
          data-testid="button-deselect-all"
        >
          <Square className="h-4 w-4" />
          <span className="hidden sm:inline">None</span>
        </Button>

        {selectedIds.size > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            
            <Badge variant="secondary" className="font-medium">
              {selectedIds.size} selected
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="gap-1" data-testid="button-bulk-actions">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setCollectionDialogOpen(true)} data-testid="menu-add-to-collection">
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add to Collection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => markAsReadMutation.mutate({ ids: Array.from(selectedIds), completed: true })} data-testid="menu-mark-complete">
                  <BookCheck className="h-4 w-4 mr-2" />
                  Mark as Complete
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => markAsReadMutation.mutate({ ids: Array.from(selectedIds), completed: false })} data-testid="menu-mark-unread">
                  <BookX className="h-4 w-4 mr-2" />
                  Mark as Unread
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTagsDialogOpen(true)} data-testid="menu-update-tags">
                  <TagsIcon className="h-4 w-4 mr-2" />
                  Update Tags
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportMetadata} data-testid="menu-export-metadata">
                  <Download className="h-4 w-4 mr-2" />
                  Export Metadata
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                  data-testid="menu-delete-selected"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} items?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. These items will be permanently deleted from your library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={deleteItemsMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteItemsMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Collection Dialog */}
      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Collection</DialogTitle>
            <DialogDescription>
              Select a collection to add the selected items to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedCollection} onValueChange={setSelectedCollection}>
              <SelectTrigger data-testid="select-collection">
                <SelectValue placeholder="Select a collection" />
              </SelectTrigger>
              <SelectContent>
                {collections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {collections.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No collections found. Create a collection first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddToCollection}
              disabled={!selectedCollection || addToCollectionMutation.isPending}
              data-testid="button-confirm-add-to-collection"
            >
              {addToCollectionMutation.isPending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Tags Dialog */}
      <Dialog open={tagsDialogOpen} onOpenChange={setTagsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Tags</DialogTitle>
            <DialogDescription>
              Add or replace tags for the selected items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={tagAction} onValueChange={(v: "add" | "replace") => setTagAction(v)}>
                <SelectTrigger data-testid="select-tag-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add to existing tags</SelectItem>
                  <SelectItem value="replace">Replace all tags</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="fiction, fantasy, adventure"
                data-testid="input-tags"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTags}
              disabled={!newTags.trim() || updateTagsMutation.isPending}
              data-testid="button-confirm-update-tags"
            >
              {updateTagsMutation.isPending ? "Updating..." : "Update Tags"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SelectableItemProps {
  id: string;
  selected: boolean;
  onToggle: (id: string) => void;
  selectionMode: boolean;
  children: React.ReactNode;
}

export function SelectableItem({
  id,
  selected,
  onToggle,
  selectionMode,
  children,
}: SelectableItemProps) {
  if (!selectionMode) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div
        className={`absolute top-2 left-2 z-10 transition-opacity ${selectionMode ? "opacity-100" : "opacity-0"}`}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(id)}
          className="bg-background/90 backdrop-blur-sm border-2"
          data-testid={`checkbox-select-${id}`}
        />
      </div>
      <div
        className={`cursor-pointer transition-all ${selected ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""}`}
        onClick={(e) => {
          if (selectionMode) {
            e.preventDefault();
            e.stopPropagation();
            onToggle(id);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
