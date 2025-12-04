import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Check, Download, Bell, BellOff, User, Settings2, Trash2, AlertTriangle, RefreshCw, HardDrive } from "lucide-react";
import { ExportNotesModal } from "@/components/ExportNotesModal";
import { AccountSettings } from "@/components/AccountSettings";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { useUIScale, scaleOptions, type UIScale } from "@/contexts/UIScaleContext";
import { useNotifications } from "@/hooks/use-notifications";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { themes, getThemeForegroundColor } from "@/lib/themes";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OrphanedItem {
  id: string;
  title: string;
  author?: string;
  filePath: string;
  reason: string;
}

interface OrphanedResponse {
  orphanedBooks: OrphanedItem[];
  orphanedAudiobooks: OrphanedItem[];
  totalBooks: number;
  totalAudiobooks: number;
}

export default function Settings() {
  const { toast } = useToast();
  const { currentTheme, setTheme } = useTheme();
  const { scale: uiScale, setScale: setUIScale } = useUIScale();
  const { 
    isSupported: notificationsSupported, 
    permission: notificationPermission, 
    preferences: notificationPrefs, 
    requestPermission, 
    updatePreferences 
  } = useNotifications();

  // Cleanup utility state
  const [showCleanup, setShowCleanup] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [selectedAudiobooks, setSelectedAudiobooks] = useState<Set<string>>(new Set());

  // Fetch orphaned records
  const { data: orphanedData, isLoading: isScanning, refetch: rescan } = useQuery<OrphanedResponse>({
    queryKey: ["/api/library/orphaned"],
    enabled: showCleanup,
  });

  // Delete orphaned books mutation
  const deleteBooksMutation = useMutation({
    mutationFn: async (bookIds: string[]) => {
      const response = await apiRequest("POST", "/api/library/cleanup/books", { bookIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/orphaned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      setSelectedBooks(new Set());
      toast({
        title: "Cleanup complete",
        description: `Deleted ${data.deleted} orphaned book record(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cleanup failed",
        description: error.message || "Failed to delete orphaned books.",
        variant: "destructive",
      });
    },
  });

  // Delete orphaned audiobooks mutation
  const deleteAudiobooksMutation = useMutation({
    mutationFn: async (audiobookIds: string[]) => {
      const response = await apiRequest("POST", "/api/library/cleanup/audiobooks", { audiobookIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/orphaned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      setSelectedAudiobooks(new Set());
      toast({
        title: "Cleanup complete",
        description: `Deleted ${data.deleted} orphaned audiobook record(s).`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cleanup failed",
        description: error.message || "Failed to delete orphaned audiobooks.",
        variant: "destructive",
      });
    },
  });

  const toggleBookSelection = (id: string) => {
    const newSelected = new Set(selectedBooks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedBooks(newSelected);
  };

  const toggleAudiobookSelection = (id: string) => {
    const newSelected = new Set(selectedAudiobooks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAudiobooks(newSelected);
  };

  const selectAllBooks = () => {
    if (orphanedData?.orphanedBooks) {
      setSelectedBooks(new Set(orphanedData.orphanedBooks.map(b => b.id)));
    }
  };

  const selectAllAudiobooks = () => {
    if (orphanedData?.orphanedAudiobooks) {
      setSelectedAudiobooks(new Set(orphanedData.orphanedAudiobooks.map(a => a.id)));
    }
  };

  const handleDeleteSelectedBooks = () => {
    if (selectedBooks.size > 0) {
      deleteBooksMutation.mutate(Array.from(selectedBooks));
    }
  };

  const handleDeleteSelectedAudiobooks = () => {
    if (selectedAudiobooks.size > 0) {
      deleteAudiobooksMutation.mutate(Array.from(selectedAudiobooks));
    }
  };

  return (
    <div className="min-h-screen overflow-auto">
      <div className="container max-w-4xl mx-auto p-6 md:p-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your account and reading preferences
          </p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="account" className="flex items-center gap-2" data-testid="tab-account">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="application" className="flex items-center gap-2" data-testid="tab-application">
              <Settings2 className="h-4 w-4" />
              Preferences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <AccountSettings />
          </TabsContent>

          <TabsContent value="application" className="space-y-6">
            {/* Theme Selection Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Theme Selection
                </CardTitle>
                <CardDescription>
                  Choose a visual theme for your entire library
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.values(themes).map((theme) => {
                    const isActive = currentTheme === theme.id;
                    
                    const themeTextColor = getThemeForegroundColor(theme.id);
                    const cardBorderColor = isActive ? `hsl(${String(theme.colors.primary)})` : `hsl(${String(theme.colors.border)})`;
                    
                    return (
                      <div
                        key={`theme-card-${theme.id}`}
                        style={{
                          background: theme.preview.gradient,
                          border: `2px solid ${cardBorderColor}`,
                          borderRadius: "1rem",
                          overflow: "hidden",
                        }}
                        className="relative"
                        data-testid={`card-theme-${theme.id}`}
                      >
                        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", minHeight: "200px" }}>
                          <div style={{ textAlign: "center" }}>
                            <div
                              style={{
                                fontFamily: String(theme.fonts.heading),
                                fontSize: "1.3rem",
                                fontWeight: 700,
                                color: themeTextColor,
                              }}
                              data-theme-id={theme.id}
                              data-foreground={theme.colors.foreground}
                            >
                              {theme.name}
                            </div>
                            <div
                              style={{
                                fontFamily: String(theme.fonts.body),
                                fontSize: "0.85rem",
                                color: themeTextColor,
                                opacity: 0.7,
                                marginTop: "0.25rem",
                              }}
                            >
                              {theme.description}
                            </div>
                          </div>

                          <Button
                            onClick={() => {
                              setTheme(theme.id);
                              toast({
                                title: "Theme applied!",
                                description: `Your library now uses the ${theme.name} theme.`,
                              });
                            }}
                            disabled={isActive}
                            className="rounded-md"
                            style={{
                              marginTop: "0.5rem",
                              background: isActive ? `hsl(${theme.colors.muted})` : `hsl(${theme.colors.primary})`,
                              color: isActive ? `hsl(${theme.colors.mutedForeground})` : `hsl(${theme.colors.primaryForeground})`,
                            }}
                            data-testid={`button-apply-theme-${theme.id}`}
                          >
                            {isActive ? (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Active
                              </>
                            ) : (
                              "Apply Theme"
                            )}
                          </Button>
                        </div>

                        <div className="flex h-8">
                          {[
                            `hsl(${theme.colors.background})`,
                            `hsl(${theme.colors.card})`,
                            `hsl(${theme.colors.primary})`,
                            `hsl(${theme.colors.accent})`,
                            `hsl(${theme.colors.foreground})`,
                          ].map((color, idx) => (
                            <div
                              key={idx}
                              style={{ background: color }}
                              className="flex-1"
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* UI Scale Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Interface Scale
                </CardTitle>
                <CardDescription>
                  Adjust the size of text and UI elements for better readability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="ui-scale" className="text-base">Text and UI Size</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose a size that's comfortable for your screen
                    </p>
                  </div>
                  <Select
                    value={uiScale}
                    onValueChange={(value: UIScale) => {
                      setUIScale(value);
                      toast({
                        title: "Scale updated",
                        description: `Interface scale set to ${value}%`,
                      });
                    }}
                  >
                    <SelectTrigger className="w-[200px]" data-testid="select-ui-scale">
                      <SelectValue placeholder="Select scale" />
                    </SelectTrigger>
                    <SelectContent>
                      {scaleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm">
                    <strong>Preview:</strong> This is sample text at your current scale setting. 
                    Larger scales make text and buttons easier to read, while smaller scales 
                    show more content on screen.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Export Notes Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Export Reading Notes
                </CardTitle>
                <CardDescription>
                  Export all your highlights, annotations, and bookmarks from your entire library
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ExportNotesModal
                  trigger={
                    <Button variant="outline" data-testid="button-export-all-notes">
                      <Download className="h-4 w-4 mr-2" />
                      Export All Notes
                    </Button>
                  }
                />
              </CardContent>
            </Card>

            {/* Notification Preferences Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {notificationPrefs.enabled ? (
                    <Bell className="h-5 w-5" />
                  ) : (
                    <BellOff className="h-5 w-5" />
                  )}
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Configure reading reminders and notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!notificationsSupported ? (
                  <Alert>
                    <AlertDescription>
                      Notifications are not supported in this browser.
                    </AlertDescription>
                  </Alert>
                ) : notificationPermission === "denied" ? (
                  <Alert>
                    <AlertDescription>
                      Notification permission was denied. Please enable notifications in your browser settings to use this feature.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {notificationPermission !== "granted" && (
                      <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Enable Notifications</p>
                          <p className="text-sm text-muted-foreground">
                            Allow Luma to send you reading reminders
                          </p>
                        </div>
                        <Button
                          onClick={async () => {
                            const granted = await requestPermission();
                            if (granted) {
                              toast({
                                title: "Notifications enabled",
                                description: "You'll now receive reading reminders.",
                              });
                            }
                          }}
                          data-testid="button-enable-notifications"
                        >
                          <Bell className="h-4 w-4 mr-2" />
                          Enable
                        </Button>
                      </div>
                    )}

                    {notificationPermission === "granted" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="notifications-enabled" className="text-base">
                              Notifications
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Receive notifications from Luma
                            </p>
                          </div>
                          <Switch
                            id="notifications-enabled"
                            checked={notificationPrefs.enabled}
                            onCheckedChange={(checked) => updatePreferences({ enabled: checked })}
                            data-testid="switch-notifications-enabled"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="reading-reminders" className="text-base">
                              Reading Reminders
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Get reminded to continue reading
                            </p>
                          </div>
                          <Switch
                            id="reading-reminders"
                            checked={notificationPrefs.readingReminders}
                            onCheckedChange={(checked) => updatePreferences({ readingReminders: checked })}
                            disabled={!notificationPrefs.enabled}
                            data-testid="switch-reading-reminders"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="daily-goal-reminders" className="text-base">
                              Daily Goal Reminders
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Get notified about your daily reading goal
                            </p>
                          </div>
                          <Switch
                            id="daily-goal-reminders"
                            checked={notificationPrefs.dailyGoalReminders}
                            onCheckedChange={(checked) => updatePreferences({ dailyGoalReminders: checked })}
                            disabled={!notificationPrefs.enabled}
                            data-testid="switch-daily-goal-reminders"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="new-books-notifications" className="text-base">
                              New Books Added
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Get notified when new books are added
                            </p>
                          </div>
                          <Switch
                            id="new-books-notifications"
                            checked={notificationPrefs.newBooksNotifications}
                            onCheckedChange={(checked) => updatePreferences({ newBooksNotifications: checked })}
                            disabled={!notificationPrefs.enabled}
                            data-testid="switch-new-books-notifications"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Library Cleanup Utility */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Library Maintenance
                </CardTitle>
                <CardDescription>
                  Scan and clean up orphaned records (books/audiobooks with missing files)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showCleanup ? (
                  <Button
                    onClick={() => setShowCleanup(true)}
                    variant="outline"
                    className="w-full"
                    data-testid="button-start-scan"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Scan for Orphaned Records
                  </Button>
                ) : isScanning ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    <span>Scanning library...</span>
                  </div>
                ) : orphanedData ? (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Found {orphanedData.orphanedBooks.length} orphaned book(s) and {orphanedData.orphanedAudiobooks.length} orphaned audiobook(s) 
                        out of {orphanedData.totalBooks} books and {orphanedData.totalAudiobooks} audiobooks total.
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rescan()}
                        data-testid="button-rescan"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Rescan
                      </Button>
                    </div>

                    {/* Orphaned Books Section */}
                    {orphanedData.orphanedBooks.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Orphaned Books ({orphanedData.orphanedBooks.length})
                          </h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={selectAllBooks}
                              data-testid="button-select-all-books"
                            >
                              Select All
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={handleDeleteSelectedBooks}
                              disabled={selectedBooks.size === 0 || deleteBooksMutation.isPending}
                              data-testid="button-delete-selected-books"
                            >
                              {deleteBooksMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Delete Selected ({selectedBooks.size})
                            </Button>
                          </div>
                        </div>
                        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                          {orphanedData.orphanedBooks.map((book) => (
                            <div
                              key={book.id}
                              className="flex items-center gap-3 p-3 hover:bg-muted/50"
                              data-testid={`orphan-book-${book.id}`}
                            >
                              <Checkbox
                                checked={selectedBooks.has(book.id)}
                                onCheckedChange={() => toggleBookSelection(book.id)}
                                data-testid={`checkbox-book-${book.id}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{book.title}</div>
                                {book.author && (
                                  <div className="text-sm text-muted-foreground truncate">{book.author}</div>
                                )}
                                <div className="text-xs text-destructive">{book.reason}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Orphaned Audiobooks Section */}
                    {orphanedData.orphanedAudiobooks.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Orphaned Audiobooks ({orphanedData.orphanedAudiobooks.length})
                          </h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={selectAllAudiobooks}
                              data-testid="button-select-all-audiobooks"
                            >
                              Select All
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={handleDeleteSelectedAudiobooks}
                              disabled={selectedAudiobooks.size === 0 || deleteAudiobooksMutation.isPending}
                              data-testid="button-delete-selected-audiobooks"
                            >
                              {deleteAudiobooksMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Delete Selected ({selectedAudiobooks.size})
                            </Button>
                          </div>
                        </div>
                        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                          {orphanedData.orphanedAudiobooks.map((audiobook) => (
                            <div
                              key={audiobook.id}
                              className="flex items-center gap-3 p-3 hover:bg-muted/50"
                              data-testid={`orphan-audiobook-${audiobook.id}`}
                            >
                              <Checkbox
                                checked={selectedAudiobooks.has(audiobook.id)}
                                onCheckedChange={() => toggleAudiobookSelection(audiobook.id)}
                                data-testid={`checkbox-audiobook-${audiobook.id}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{audiobook.title}</div>
                                {audiobook.author && (
                                  <div className="text-sm text-muted-foreground truncate">{audiobook.author}</div>
                                )}
                                <div className="text-xs text-destructive">{audiobook.reason}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No orphans found */}
                    {orphanedData.orphanedBooks.length === 0 && orphanedData.orphanedAudiobooks.length === 0 && (
                      <Alert>
                        <Check className="h-4 w-4" />
                        <AlertDescription>
                          Your library is clean! All book and audiobook files are present.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-muted-foreground">Future Integrations</CardTitle>
                <CardDescription>
                  Goodreads OAuth integration coming soon
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
