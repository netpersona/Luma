import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { BookOpen, ArrowLeft, Clock, Calendar, Tag, Building2, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { parseJsonArray } from "@/lib/utils";
import type { BookWithProgress } from "@shared/schema";

export default function BookDetail() {
  const [, params] = useRoute("/books/:id");
  const [, setLocation] = useLocation();
  const bookId = params?.id;

  const { data: book, isLoading } = useQuery<BookWithProgress>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });

  const handleRead = () => {
    if (book?.format === "EPUB") {
      setLocation(`/reader/epub/${bookId}`);
    } else if (book?.format === "PDF") {
      setLocation(`/reader/pdf/${bookId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg text-muted-foreground">Book not found</p>
        <Button onClick={() => setLocation("/")} data-testid="button-back-library">
          Back to Library
        </Button>
      </div>
    );
  }

  const progress = book.progress?.progress || 0;
  const hasProgress = progress > 0;

  // Parse tags and dominant colors safely
  const bookTags = parseJsonArray(book.tags);
  const bookColors = parseJsonArray(book.dominantColors);

  // Generate gradient background from dominant colors
  const generateGradient = () => {
    if (bookColors.length === 0) {
      return "linear-gradient(135deg, rgb(30, 30, 35) 0%, rgb(20, 25, 35) 50%, rgb(15, 20, 30) 100%)";
    }

    const colors = bookColors.slice(0, 3);
    if (colors.length === 1) {
      return `linear-gradient(135deg, ${colors[0]} 0%, rgba(20, 25, 35, 0.95) 100%)`;
    } else if (colors.length === 2) {
      return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, rgba(20, 25, 35, 0.95) 100%)`;
    } else {
      return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 40%, ${colors[2]} 70%, rgba(15, 20, 30, 0.98) 100%)`;
    }
  };

  return (
    <div className="min-h-screen overflow-auto">
      {/* Hero Section with Gradient Background */}
      <div 
        className="relative pb-8 pt-6 px-4 md:px-8"
        style={{
          background: generateGradient(),
        }}
      >
        {/* Dark wash overlay for text contrast */}
        <div className="absolute inset-0 bg-black/40" />
        
        {/* Content Layer */}
        <div className="relative z-10">
          {/* Back Button */}
          <div className="max-w-7xl mx-auto mb-6">
          <Button variant="ghost" onClick={() => setLocation("/")} className="text-white hover:bg-white/10" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover Image */}
            <div className="flex-shrink-0">
              <div className="w-48 md:w-64 lg:w-72 aspect-[2/3] bg-black/20 rounded-2xl overflow-hidden shadow-2xl">
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="h-24 w-24 text-white/40" />
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex-1 text-white">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2" data-testid="text-title">
                {book.title}
              </h1>
              
              {book.author && (
                <p className="text-xl md:text-2xl text-white/90 mb-4" data-testid="text-author">
                  {book.author}
                </p>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
                {book.publisher && (
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Publisher</div>
                      <div className="text-white">{book.publisher}</div>
                    </div>
                  </div>
                )}

                {book.publishedDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Publication</div>
                      <div className="text-white">{book.publishedDate}</div>
                    </div>
                  </div>
                )}

                {book.series && (
                  <div className="flex items-start gap-2">
                    <BookMarked className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Series</div>
                      <div className="text-white">{book.series}</div>
                    </div>
                  </div>
                )}

                {book.pageCount && (
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Pages</div>
                      <div className="text-white">{book.pageCount}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {bookTags.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-white/70" />
                    <span className="text-white/70 text-xs">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {bookTags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-white/20 text-white border-white/30">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              {hasProgress && (
                <div className="mt-6 bg-black/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-white/70">Your Progress</span>
                    <span className="text-white font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-white/10" />
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex gap-3">
                <Button 
                  size="lg" 
                  onClick={handleRead}
                  data-testid="button-read"
                >
                  <BookOpen className="h-5 w-5 mr-2" />
                  {hasProgress ? "Continue Reading" : "Start Reading"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="details" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              data-testid="tab-details"
            >
              Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            {book.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Description</h3>
                <p className="text-muted-foreground leading-relaxed">{book.description}</p>
              </div>
            )}

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Format</h4>
                <p className="text-base">{book.format}</p>
              </div>

              {book.language && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Language</h4>
                  <p className="text-base">{book.language}</p>
                </div>
              )}

              {book.isbn && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">ISBN</h4>
                  <p className="text-base">{book.isbn}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
