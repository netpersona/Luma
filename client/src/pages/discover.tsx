import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { findBestMatch, type MatchCandidate, type MatchTarget } from "@/lib/metadataMatching";
import { Search, Download, BookOpen, AlertCircle, Key, Sparkles, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useDownloads } from "@/contexts/DownloadContext";

interface SearchResult {
  id: string; // MD5 hash returned from backend
  title: string;
  author: string;
  year?: string;
  language?: string;
  format: string;
  size?: string;
  publisher?: string;
  isbn?: string;
  cover_url?: string;
  source?: string;
}

interface RecommendationItem {
  googleBooksId: string;
  title: string;
  author: string;
  description?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  language?: string;
  coverUrl?: string;
  isbn?: string;
  publisher?: string;
  averageRating?: number;
  localScore?: number;
  reason?: string;
}

export default function Discover() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { addDownload, isDownloading } = useDownloads();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [addingRecommendationId, setAddingRecommendationId] = useState<string | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Check if API keys are configured
  const { data: settings, isLoading: settingsLoading } = useQuery<any[]>({
    queryKey: ["/api/settings"],
  });
  
  // Check for Google Books API key - can be saved as:
  // 1. "user:default:googleBooksApiKey" (per-user or synthetic from server secret)
  // 2. "googleBooksApiKey" (server-level from admin panel)
  const googleBooksApiKeySetting = settings?.find(s => 
    s.key === "user:default:googleBooksApiKey" || s.key === "googleBooksApiKey"
  );
  const hasGoogleBooksKey = !!googleBooksApiKeySetting?.value;
  
  const annasArchiveApiKeySetting = settings?.find(s => s.key === "annasArchiveApiKey");
  const hasAnnasArchiveApiKey = !!annasArchiveApiKeySetting?.value;
  
  const donatorKeySetting = settings?.find(s => s.key === "annasArchiveDonatorKey");
  const hasDonatorKey = !!donatorKeySetting?.value;

  // Fetch recommendations when API key is configured
  const { data: recommendations, isLoading: recommendationsLoading, refetch: refetchRecommendations } = useQuery<RecommendationItem[]>({
    queryKey: ["/api/recommendations"],
    enabled: hasGoogleBooksKey && !isSearchMode,
  });
  
  // Mutation to refresh recommendations (force fresh fetch)
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/recommendations?refresh=true');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to refresh recommendations');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/recommendations"], data);
      toast({
        title: "Recommendations refreshed",
        description: "Your recommendations have been updated based on your library",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Refresh failed",
        description: error.message || "Failed to refresh recommendations",
        variant: "destructive",
      });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const params = new URLSearchParams({ query, format: "epub", language: "en", limit: "20" });
      const response = await fetch(`/api/integrations/annas-archive/search?${params}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Search failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data);
      setIsSearchMode(true);
      if (data.length === 0) {
        toast({
          title: "No results found",
          description: "Try a different search query",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Search failed",
        description: error.message || "Failed to search Anna's Archive",
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchMode(false);
  };

  const handleDownload = (book: SearchResult) => {
    addDownload({
      id: book.id,
      title: book.title,
      author: book.author,
      format: book.format,
      cover_url: book.cover_url,
      isbn: book.isbn,
    });
  };

  const addRecommendationMutation = useMutation({
    mutationFn: async (rec: RecommendationItem) => {
      setAddingRecommendationId(rec.googleBooksId);
      
      // Search Anna's Archive for this book
      const searchTerm = rec.isbn || rec.title;
      const params = new URLSearchParams({ 
        query: searchTerm, 
        format: "epub", 
        language: rec.language || "en", 
        limit: "10" 
      });
      const searchResponse = await fetch(`/api/integrations/annas-archive/search?${params}`);
      
      if (!searchResponse.ok) {
        throw new Error("Failed to search for book");
      }
      
      const results: SearchResult[] = await searchResponse.json();
      
      if (results.length === 0) {
        throw new Error("Book not found on Anna's Archive. Try searching manually.");
      }
      
      // Find best match - prefer EPUB format
      const epubResults = results.filter(r => r.format.toLowerCase() === 'epub');
      const candidateResults = epubResults.length > 0 ? epubResults : results;
      
      // Use the matching module to find the best candidate
      const target: MatchTarget = {
        title: rec.title,
        authors: rec.author ? [rec.author] : [],
        isbn10: rec.isbn?.length === 10 ? rec.isbn : undefined,
        isbn13: rec.isbn?.length === 13 ? rec.isbn : undefined,
      };
      
      const candidates: MatchCandidate[] = candidateResults.map(r => ({
        ...r,
        title: r.title,
        author: r.author,
        isbn: r.isbn,
      }));
      
      const { candidate: bestMatch, result: matchResult } = findBestMatch(candidates, target);
      
      // If no good match found, abort instead of downloading wrong book
      if (!bestMatch || !matchResult) {
        throw new Error("No suitable match found on Anna's Archive. The search results don't match this book. Try searching manually.");
      }
      
      // Log match details for debugging (can be removed in production)
      console.log('[AutoDownload] Match found:', {
        title: bestMatch.title,
        author: bestMatch.author,
        confidence: matchResult.confidence,
        matchType: matchResult.matchType,
      });
      
      // Ensure we have required metadata - use id field (which contains md5)
      const bookId = bestMatch.id;
      const bookFormat = bestMatch.format;
      const bookTitle = bestMatch.title;
      const bookAuthor = bestMatch.author;
      if (!bookFormat || !bookId || !bookTitle) {
        throw new Error("Book metadata incomplete. Try searching manually.");
      }
      
      // Use the download context to handle the download (awaited for proper error handling)
      await addDownload({
        id: bookId,
        title: bookTitle,
        author: bookAuthor || "Unknown Author",
        format: bookFormat,
        cover_url: bestMatch.cover_url,
        isbn: bestMatch.isbn,
      });
      
      return bestMatch;
    },
    onSuccess: () => {
      setAddingRecommendationId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't add book",
        description: error.message || "Failed to add book to library",
        variant: "destructive",
      });
      setAddingRecommendationId(null);
    },
  });

  return (
    <div className="min-h-screen overflow-auto bg-background texture-paper">
      <div className="container max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                {isSearchMode ? (
                  <>
                    <Search className="h-7 w-7" />
                    Search Results
                  </>
                ) : hasGoogleBooksKey ? (
                  <>
                    <Sparkles className="h-7 w-7 text-primary" />
                    Recommended for You
                  </>
                ) : (
                  <>
                    <BookOpen className="h-7 w-7" />
                    Discover Books
                  </>
                )}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isSearchMode 
                  ? "Search results from Anna's Archive" 
                  : hasGoogleBooksKey 
                    ? "Personalized recommendations based on your library"
                    : "Search Anna's Archive for books to add to your library"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isSearchMode && hasGoogleBooksKey && (
                <Button
                  variant="outline"
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending || recommendationsLoading}
                  data-testid="button-refresh-recommendations"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                  {refreshMutation.isPending ? "Refreshing..." : "Refresh"}
                </Button>
              )}
              {isSearchMode && (
                <Button
                  variant="outline"
                  onClick={handleClearSearch}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4 mr-2" />
                  Back to Recommendations
                </Button>
              )}
            </div>
          </div>

          {!hasAnnasArchiveApiKey && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>A RapidAPI key is required to search Anna's Archive. Get a free key from RapidAPI and add it in the Admin Panel.</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setLocation("/admin")}
                  data-testid="button-go-to-admin"
                >
                  Go to Admin Panel
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {hasAnnasArchiveApiKey && !hasDonatorKey && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Downloads may have wait times. Add a Donator Account ID in Admin Panel for faster downloads.</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setLocation("/admin")}
                  data-testid="button-go-to-admin-donator"
                >
                  Go to Admin Panel
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="Search by title, author, or ISBN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              data-testid="input-search"
            />
            <Button 
              type="submit" 
              disabled={searchMutation.isPending || !hasAnnasArchiveApiKey}
              data-testid="button-search"
            >
              <Search className="h-4 w-4 mr-2" />
              {searchMutation.isPending ? "Searching..." : "Search"}
            </Button>
          </form>
        </div>

        {searchMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {(searchMutation.error as any)?.message || "Search failed. This could be due to Cloudflare protection or network issues. Try again in a moment."}
            </AlertDescription>
          </Alert>
        )}

        {/* Show recommendations (when not in search mode and API key is configured) */}
        {!isSearchMode && hasGoogleBooksKey && (
          <>
            {recommendationsLoading && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="aspect-[2/3] w-full" />
                    <CardHeader className="space-y-2">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}

            {!recommendationsLoading && recommendations && recommendations.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Found {recommendations.length} recommendations for you
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {recommendations.map((rec) => (
                    <Card key={rec.googleBooksId} className="flex flex-col overflow-hidden" data-testid={`card-recommendation-${rec.googleBooksId}`}>
                      <div className="aspect-[2/3] relative bg-muted overflow-hidden">
                        {rec.coverUrl ? (
                          <img
                            src={rec.coverUrl}
                            alt={rec.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.nextElementSibling;
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`absolute inset-0 flex items-center justify-center ${rec.coverUrl ? 'hidden' : ''}`}>
                          <BookOpen className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                      </div>
                      
                      <CardHeader className="p-4 space-y-1">
                        <CardTitle className="line-clamp-2 text-sm leading-tight">{rec.title}</CardTitle>
                        <CardDescription className="line-clamp-1 text-xs">
                          {rec.author || "Unknown Author"}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="flex-1 p-4 pt-0 space-y-2">
                        <p className="text-xs text-muted-foreground italic line-clamp-2">
                          {rec.reason}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {rec.categories?.slice(0, 2).map((cat, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{cat}</Badge>
                          ))}
                          {rec.language && <Badge variant="outline" className="text-xs">{rec.language.toUpperCase()}</Badge>}
                        </div>
                      </CardContent>
                      
                      <CardFooter className="p-4 pt-0">
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={() => addRecommendationMutation.mutate(rec)}
                          disabled={addingRecommendationId === rec.googleBooksId}
                          data-testid={`button-add-recommendation-${rec.googleBooksId}`}
                        >
                          {addingRecommendationId === rec.googleBooksId ? (
                            <>
                              <Download className="h-4 w-4 mr-2 animate-bounce" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Add to Library
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {!recommendationsLoading && recommendations && recommendations.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
                <Sparkles className="h-16 w-16 text-muted-foreground opacity-40" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">No recommendations yet</h3>
                  <p className="text-muted-foreground max-w-md">
                    Add more books to your library to get personalized recommendations based on your reading preferences
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Show setup prompt when no API key is configured */}
        {!isSearchMode && !hasGoogleBooksKey && !settingsLoading && (
          <Card className="border-dashed">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Key className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle>Enable Personalized Recommendations</CardTitle>
              <CardDescription className="max-w-2xl mx-auto">
                Connect your Google Books API key to unlock personalized book recommendations based on your library. 
                We'll analyze your reading preferences and suggest books you'll love.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button
                onClick={() => setLocation("/settings")}
                data-testid="button-setup-api-key"
              >
                <Key className="h-4 w-4 mr-2" />
                Set Up in Settings
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Show search results */}
        {searchMutation.isPending && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {!searchMutation.isPending && isSearchMode && searchResults.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {searchResults.length} results
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {searchResults.map((book) => (
                <Card key={book.id} className="flex flex-col overflow-hidden">
                  <div className="aspect-[2/3] relative bg-muted overflow-hidden">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling;
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`absolute inset-0 flex items-center justify-center ${book.cover_url ? 'hidden' : ''}`}>
                      <BookOpen className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  </div>
                  
                  <CardHeader className="p-4 space-y-1">
                    <CardTitle className="line-clamp-2 text-sm leading-tight">{book.title}</CardTitle>
                    <CardDescription className="line-clamp-1 text-xs">
                      {book.author || "Unknown Author"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 p-4 pt-0 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">{book.format.toUpperCase()}</Badge>
                      {book.language && <Badge variant="outline" className="text-xs">{book.language.toUpperCase()}</Badge>}
                      {book.source && (
                        <Badge variant="default" className="text-xs">
                          {book.source === "annas-archive" ? "Anna's Archive" : 
                           book.source === "libgen" ? "Libgen" : 
                           book.source === "zlibrary" ? "Z-Library" : 
                           book.source.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    {book.size && (
                      <p className="text-xs text-muted-foreground">
                        {book.size}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => handleDownload(book)}
                      disabled={isDownloading(book.id)}
                      data-testid={`button-download-${book.id}`}
                    >
                      {isDownloading(book.id) ? (
                        <>
                          <Download className="h-4 w-4 mr-2 animate-bounce" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Add to Library
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!searchMutation.isPending && isSearchMode && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
            <BookOpen className="h-16 w-16 text-muted-foreground opacity-40" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No results found</h3>
              <p className="text-muted-foreground">
                Try searching with a different query or check your spelling
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
