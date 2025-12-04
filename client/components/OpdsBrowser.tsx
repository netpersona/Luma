import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  ArrowUp, 
  Download, 
  Folder, 
  Book, 
  Plus, 
  Trash2, 
  Settings,
  Loader2,
  ExternalLink,
  Search
} from "lucide-react";

interface OpdsLink {
  href: string;
  type: string;
  rel?: string;
  title?: string;
}

interface OpdsEntry {
  id: string;
  title: string;
  author?: string;
  summary?: string;
  updated?: string;
  coverUrl?: string;
  links: OpdsLink[];
  categories?: string[];
  isNavigation: boolean;
  subsectionLinks: OpdsLink[];
  acquisitionLinks: OpdsLink[];
}

interface OpdsFeed {
  id: string;
  title: string;
  updated?: string;
  entries: OpdsEntry[];
  links: OpdsLink[];
  totalResults?: number;
}

interface OpdsSource {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  lastSyncedAt?: string;
  isActive: boolean;
}

interface BrowseResult {
  feed: OpdsFeed;
  navigation: {
    self?: OpdsLink;
    start?: OpdsLink;
    up?: OpdsLink;
    next?: OpdsLink;
    previous?: OpdsLink;
    search?: OpdsLink;
  };
}

export function OpdsBrowser() {
  const { toast } = useToast();
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [currentSourceId, setCurrentSourceId] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceUsername, setNewSourceUsername] = useState("");
  const [newSourcePassword, setNewSourcePassword] = useState("");

  const { data: sources = [], isLoading: sourcesLoading } = useQuery<OpdsSource[]>({
    queryKey: ["/api/opds/sources"],
  });

  const { data: browseResult, isLoading: browsingLoading, refetch: refetchBrowse } = useQuery<BrowseResult>({
    queryKey: ["/api/opds/browse", currentUrl],
    queryFn: async () => {
      if (!currentUrl) return null;
      const response = await apiRequest("POST", "/api/opds/browse", {
        url: currentUrl,
        sourceId: currentSourceId,
      });
      return response.json();
    },
    enabled: !!currentUrl,
  });

  const addSourceMutation = useMutation({
    mutationFn: async (data: { name: string; url: string; username?: string; password?: string }) => {
      const response = await apiRequest("POST", "/api/opds/sources", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opds/sources"] });
      setShowAddSource(false);
      setNewSourceName("");
      setNewSourceUrl("");
      setNewSourceUsername("");
      setNewSourcePassword("");
      toast({ title: "Source added", description: "OPDS source has been added successfully." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add source", 
        description: error.message || "Could not add OPDS source",
        variant: "destructive" 
      });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/opds/sources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opds/sources"] });
      toast({ title: "Source removed", description: "OPDS source has been removed." });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (data: { url: string; sourceId: string; title: string }) => {
      const response = await apiRequest("POST", "/api/opds/download", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({ title: "Downloaded", description: "Book has been added to your library." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Download failed", 
        description: error.message || "Could not download the book",
        variant: "destructive" 
      });
    },
  });

  const navigateTo = (url: string) => {
    if (currentUrl) {
      setHistory(prev => [...prev, currentUrl]);
    }
    setCurrentUrl(url);
  };

  const goBack = () => {
    if (history.length > 0) {
      const previousUrl = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setCurrentUrl(previousUrl);
    }
  };

  const selectSource = (source: OpdsSource) => {
    setCurrentSourceId(source.id);
    setHistory([]);
    setCurrentUrl(source.url);
  };

  const handleAddSource = () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      toast({ title: "Missing fields", description: "Name and URL are required", variant: "destructive" });
      return;
    }
    addSourceMutation.mutate({
      name: newSourceName.trim(),
      url: newSourceUrl.trim(),
      username: newSourceUsername.trim() || undefined,
      password: newSourcePassword.trim() || undefined,
    });
  };

  const handleDownload = (entry: OpdsEntry, link: OpdsLink) => {
    downloadMutation.mutate({
      url: link.href,
      sourceId: currentSourceId,
      title: entry.title,
    });
  };

  const renderEntry = (entry: OpdsEntry) => {
    const isNav = entry.isNavigation;
    
    return (
      <Card key={entry.id} className="hover-elevate" data-testid={`opds-entry-${entry.id}`}>
        <CardContent className="p-4">
          <div className="flex gap-4">
            {entry.coverUrl && (
              <img 
                src={entry.coverUrl} 
                alt={entry.title}
                className="w-16 h-24 object-cover rounded"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{entry.title}</h3>
              {entry.author && (
                <p className="text-sm text-muted-foreground">{entry.author}</p>
              )}
              {entry.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {entry.summary}
                </p>
              )}
              {entry.categories && entry.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.categories.slice(0, 3).map((cat, i) => (
                    <span key={i} className="text-xs bg-secondary px-2 py-0.5 rounded">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {entry.subsectionLinks.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateTo(entry.subsectionLinks[0].href)}
                  data-testid={`button-navigate-${entry.id}`}
                >
                  <Folder className="w-4 h-4 mr-1" />
                  Browse
                </Button>
              )}
              {entry.acquisitionLinks.length > 0 && entry.acquisitionLinks.map((link, i) => (
                <Button
                  key={i}
                  size="sm"
                  onClick={() => handleDownload(entry, link)}
                  disabled={downloadMutation.isPending}
                  data-testid={`button-download-${entry.id}-${i}`}
                >
                  {downloadMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-1" />
                  )}
                  {link.title || getFormatFromType(link.type)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const getFormatFromType = (type: string): string => {
    if (type.includes("epub")) return "EPUB";
    if (type.includes("pdf")) return "PDF";
    if (type.includes("mobi") || type.includes("mobipocket")) return "MOBI";
    if (type.includes("text/plain")) return "TXT";
    if (type.includes("text/html")) return "HTML";
    if (type.includes("zip")) return "ZIP";
    if (type.includes("kindle")) return "Kindle";
    return "Download";
  };

  if (!currentUrl) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">OPDS Catalogs</h2>
          <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-opds-source">
                <Plus className="w-4 h-4 mr-2" />
                Add Source
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add OPDS Source</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="source-name">Name</Label>
                  <Input
                    id="source-name"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="My OPDS Catalog"
                    data-testid="input-opds-source-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-url">URL</Label>
                  <Input
                    id="source-url"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder="https://example.com/opds"
                    data-testid="input-opds-source-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-username">Username (optional)</Label>
                  <Input
                    id="source-username"
                    value={newSourceUsername}
                    onChange={(e) => setNewSourceUsername(e.target.value)}
                    placeholder="username"
                    data-testid="input-opds-source-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-password">Password (optional)</Label>
                  <Input
                    id="source-password"
                    type="password"
                    value={newSourcePassword}
                    onChange={(e) => setNewSourcePassword(e.target.value)}
                    placeholder="password"
                    data-testid="input-opds-source-password"
                  />
                </div>
                <Button 
                  onClick={handleAddSource} 
                  disabled={addSourceMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-opds-source"
                >
                  {addSourceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Add Source
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {sourcesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : sources.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Book className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No OPDS Sources</p>
              <p className="text-muted-foreground text-center mb-4">
                Add an OPDS catalog to browse and download books
              </p>
              <Button onClick={() => setShowAddSource(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Source
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => (
              <Card key={source.id} className="hover-elevate cursor-pointer" data-testid={`opds-source-${source.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{source.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSourceMutation.mutate(source.id);
                      }}
                      data-testid={`button-delete-source-${source.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground truncate mb-3">{source.url}</p>
                  {source.lastSyncedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last accessed: {new Date(source.lastSyncedAt).toLocaleDateString()}
                    </p>
                  )}
                  <Button 
                    className="w-full mt-3"
                    onClick={() => selectSource(source)}
                    data-testid={`button-browse-source-${source.id}`}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Browse Catalog
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="icon"
          onClick={() => { setCurrentUrl(""); setHistory([]); }}
          data-testid="button-opds-home"
        >
          <Home className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={goBack}
          disabled={history.length === 0}
          data-testid="button-opds-back"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        {browseResult?.navigation.up && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateTo(browseResult.navigation.up!.href)}
            data-testid="button-opds-up"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-medium truncate">
            {browseResult?.feed.title || "Loading..."}
          </h2>
        </div>
        {browseResult?.navigation.search && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateTo(browseResult.navigation.search!.href)}
            data-testid="button-opds-search"
          >
            <Search className="w-4 h-4" />
          </Button>
        )}
      </div>

      {browsingLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : browseResult?.feed ? (
        <>
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-3 pr-4">
              {browseResult.feed.entries.map(renderEntry)}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              {browseResult.feed.totalResults 
                ? `${browseResult.feed.entries.length} of ${browseResult.feed.totalResults} items`
                : `${browseResult.feed.entries.length} items`
              }
            </div>
            <div className="flex gap-2">
              {browseResult.navigation.previous && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo(browseResult.navigation.previous!.href)}
                  data-testid="button-opds-prev-page"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
              )}
              {browseResult.navigation.next && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo(browseResult.navigation.next!.href)}
                  data-testid="button-opds-next-page"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Failed to load feed</p>
            <Button variant="outline" className="mt-4" onClick={() => refetchBrowse()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
