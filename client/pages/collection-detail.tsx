import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaCard } from "@/components/media-card";
import { ArrowLeft, BookOpen, Headphones } from "lucide-react";
import type { CollectionWithItems, BookWithProgress, AudiobookWithProgress } from "@shared/schema";

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: collection, isLoading } = useQuery<CollectionWithItems>({
    queryKey: ["/api/collections", id],
  });

  // Fetch all books and audiobooks to display in the collection
  const { data: books = [] } = useQuery<BookWithProgress[]>({
    queryKey: ["/api/books"],
  });

  const { data: audiobooks = [] } = useQuery<AudiobookWithProgress[]>({
    queryKey: ["/api/audiobooks"],
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto bg-background texture-paper">
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
          <Skeleton className="h-10 w-32 mb-6" />
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-6 w-full max-w-2xl mb-8" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex-1 overflow-auto bg-background texture-paper">
        <div className="flex flex-col items-center justify-center min-h-[600px] text-center space-y-6 px-4">
          <div className="text-6xl opacity-40">📚</div>
          <div className="space-y-3 max-w-lg">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Collection Not Found</h2>
            <p className="text-muted-foreground text-sm md:text-base">
              The collection you're looking for doesn't exist or has been removed.
            </p>
          </div>
          <Button onClick={() => setLocation("/collections")} data-testid="button-back-to-collections">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Collections
          </Button>
        </div>
      </div>
    );
  }

  // Get all items from the collection
  const collectionItems = collection.items || [];
  
  // Map collection items to their full book/audiobook data
  const items = collectionItems
    .map((item) => {
      if (item.itemType === "book") {
        const book = books.find((b) => b.id === item.itemId);
        return book ? { ...book, type: "book" as const, collectionOrder: item.order || 0 } : null;
      } else {
        const audiobook = audiobooks.find((a) => a.id === item.itemId);
        return audiobook ? { ...audiobook, type: "audiobook" as const, collectionOrder: item.order || 0 } : null;
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.collectionOrder - b.collectionOrder);

  const handleItemClick = (item: typeof items[0]) => {
    setLocation(`/${item.type}s/${item.id}`);
  };

  return (
    <div className="flex-1 overflow-auto bg-background texture-paper">
      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <Button
          variant="ghost"
          onClick={() => setLocation("/collections")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Collections
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-collection-name">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="text-muted-foreground text-base md:text-lg max-w-3xl" data-testid="text-collection-description">
              {collection.description}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2" data-testid="text-item-count">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6 px-4">
            <div className="flex gap-6 opacity-40">
              <BookOpen className="h-16 w-16 md:h-20 md:w-20 text-muted-foreground" />
              <Headphones className="h-16 w-16 md:h-20 md:w-20 text-muted-foreground" />
            </div>
            <div className="space-y-3 max-w-lg">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                This collection is empty
              </h2>
              <p className="text-muted-foreground text-sm md:text-base">
                Add books and audiobooks to this collection to build your curated library.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {items.map((item) => (
              <MediaCard
                key={`${item.type}-${item.id}`}
                item={item}
                type={item.type}
                onClick={() => handleItemClick(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
