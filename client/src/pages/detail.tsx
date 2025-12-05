import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { BookOpen, Headphones, ArrowLeft, Clock, Calendar, Tag, Building2, BookMarked } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { parseJsonArray } from "@/lib/utils";
import type { BookWithProgress, AudiobookWithProgress } from "@shared/schema";

type MediaItem = (BookWithProgress | AudiobookWithProgress) & {
  type: "book" | "audiobook";
};

export default function DetailPage() {
  const [, params] = useRoute<{ type: string; id: string }>("/:type/:id");
  const [, setLocation] = useLocation();
  
  if (!params) {
    return null;
  }

  const { type, id } = params;
  const isAudiobook = type === "audiobook";
  const endpoint = isAudiobook ? `/api/audiobooks/${id}` : `/api/books/${id}`;

  const { data: item, isLoading } = useQuery<MediaItem>({
    queryKey: [endpoint],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg text-muted-foreground">Item not found</p>
        <Button asChild data-testid="button-back-library">
          <Link href="/">Back to Library</Link>
        </Button>
      </div>
    );
  }

  const progress = item.progress?.progress || 0;
  const hasProgress = progress > 0;

  // Parse dominant colors safely
  const itemColors = parseJsonArray(item.dominantColors);

  // Generate gradient background from dominant colors
  const generateGradient = () => {
    if (itemColors.length === 0) {
      // Default gradient if no colors extracted
      return "linear-gradient(135deg, rgb(30, 30, 35) 0%, rgb(20, 25, 35) 50%, rgb(15, 20, 30) 100%)";
    }

    // Create a multi-color gradient from left to right
    const colors = itemColors.slice(0, 3);
    if (colors.length === 1) {
      return `linear-gradient(135deg, ${colors[0]} 0%, rgba(20, 25, 35, 0.95) 100%)`;
    } else if (colors.length === 2) {
      return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, rgba(20, 25, 35, 0.95) 100%)`;
    } else {
      return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 40%, ${colors[2]} 70%, rgba(15, 20, 30, 0.98) 100%)`;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section with Gradient Background */}
      <div 
        className="relative pb-8 pt-6 px-4 md:px-8"
        style={{
          background: generateGradient(),
        }}
      >
        {/* Back Button */}
        <div className="max-w-7xl mx-auto mb-6">
          <Button variant="ghost" asChild className="text-white hover:bg-white/10" data-testid="button-back">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Library
            </Link>
          </Button>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover Image */}
            <div className="flex-shrink-0">
              <div className="w-48 md:w-64 lg:w-72 aspect-[2/3] bg-black/20 rounded-2xl overflow-hidden shadow-2xl">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {isAudiobook ? (
                      <Headphones className="h-24 w-24 text-white/40" />
                    ) : (
                      <BookOpen className="h-24 w-24 text-white/40" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex-1 text-white">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2" data-testid="text-title">
                {item.title}
              </h1>
              
              {item.author && (
                <p className="text-xl md:text-2xl text-white/90 mb-4" data-testid="text-author">
                  {item.author}
                </p>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
                {item.publisher && (
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Publisher</div>
                      <div className="text-white">{item.publisher}</div>
                    </div>
                  </div>
                )}

                {item.publishedDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Publication</div>
                      <div className="text-white">{item.publishedDate}</div>
                    </div>
                  </div>
                )}

                {item.series && (
                  <div className="flex items-start gap-2">
                    <BookMarked className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Series</div>
                      <div className="text-white">{item.series}</div>
                    </div>
                  </div>
                )}

                {isAudiobook && 'duration' in item && item.duration && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Duration</div>
                      <div className="text-white">
                        {Math.floor(item.duration / 3600)}h {Math.floor((item.duration % 3600) / 60)}m
                      </div>
                    </div>
                  </div>
                )}

                {!isAudiobook && 'pageCount' in item && item.pageCount && (
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Pages</div>
                      <div className="text-white">{item.pageCount}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {(() => {
                const itemTags = parseJsonArray(item.tags);
                return itemTags.length > 0 ? (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="h-4 w-4 text-white/70" />
                      <span className="text-white/70 text-xs">Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {itemTags.map((tag, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="bg-white/20 text-white border-white/30 cursor-pointer hover-elevate"
                          onClick={() => setLocation(`/?tag=${encodeURIComponent(tag)}`)}
                          data-testid={`detail-tag-${idx}`}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

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
                  asChild
                  data-testid={`button-${isAudiobook ? "listen" : "read"}`}
                >
                  <Link href={isAudiobook ? `/listen/${id}` : `/read/${id}`}>
                    {isAudiobook ? (
                      <>
                        <Headphones className="h-5 w-5 mr-2" />
                        {hasProgress ? "Continue Listening" : "Start Listening"}
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-5 w-5 mr-2" />
                        {hasProgress ? "Continue Reading" : "Start Reading"}
                      </>
                    )}
                  </Link>
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
            {item.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Description</h3>
                <p className="text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            )}

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Format</h4>
                <p className="text-base">{item.format}</p>
              </div>

              {item.language && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Language</h4>
                  <p className="text-base">{item.language}</p>
                </div>
              )}

              {item.isbn && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">ISBN</h4>
                  <p className="text-base">{item.isbn}</p>
                </div>
              )}

              {isAudiobook && 'narrator' in item && item.narrator && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Narrator</h4>
                  <p className="text-base">{item.narrator}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
