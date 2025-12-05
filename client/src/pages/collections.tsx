import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CollectionWithItems } from "@shared/schema";
import { insertCollectionSchema, type InsertCollection } from "@shared/schema";

export default function Collections() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: collections = [], isLoading } = useQuery<CollectionWithItems[]>({
    queryKey: ["/api/collections"],
  });

  const form = useForm<InsertCollection>({
    resolver: zodResolver(insertCollectionSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: InsertCollection) => {
      return apiRequest("POST", "/api/collections", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Collection created",
        description: "Your collection has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating collection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: InsertCollection) => {
    createMutation.mutate(values);
  };

  return (
    <div className="flex-1 overflow-auto bg-background texture-paper">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Collections</h1>
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-collection">
            <Plus className="h-4 w-4 mr-2" />
            New Collection
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
            <FolderOpen className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">No collections yet</h2>
              <p className="text-muted-foreground max-w-md">
                Organize your books and audiobooks into collections for easy access.
              </p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first-collection">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Collection
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <Card
                key={collection.id}
                className="p-6 hover-elevate active-elevate-2 cursor-pointer"
                onClick={() => setLocation(`/collections/${collection.id}`)}
                data-testid={`card-collection-${collection.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <FolderOpen className="h-8 w-8 text-primary" />
                  <Badge variant="secondary">{collection.itemCount || 0} items</Badge>
                </div>
                <h3 className="font-semibold text-lg mb-2">{collection.name}</h3>
                {collection.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {collection.description}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Collection</DialogTitle>
              <DialogDescription>
                Organize your books and audiobooks into collections
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collection Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Science Fiction Classics"
                          {...field}
                          data-testid="input-collection-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your collection..."
                          {...field}
                          value={field.value || ""}
                          data-testid="input-collection-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-collection"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-collection"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Collection"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
