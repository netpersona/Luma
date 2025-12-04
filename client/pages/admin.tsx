import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CalibreImportModal } from "@/components/CalibreImportModal";
import { 
  Users, 
  Key, 
  Copy, 
  Check, 
  Trash2, 
  Plus, 
  Shield, 
  User,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Settings2,
  Folder,
  ScanLine,
  Search,
  Save,
  ExternalLink,
  Database,
  Download,
  Upload,
  FileJson,
  Library,
  BookOpen,
  Lock,
  Globe,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";

interface InviteToken {
  id: string;
  code: string;
  createdBy: string;
  maxUses: number | null;
  usageCount: number;
  expiresAt: number | null;
  isActive: boolean;
  note: string | null;
  createdAt: number;
}

interface UserInfo {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  role: string;
  googleId: string | null;
  createdAt: number;
}

interface BookClubInfo {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  createdBy: string;
  memberCount: number;
  createdAt: string;
}

interface BookInfo {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  format: string | null;
  filePath: string | null;
  addedAt: number | string;
}

interface ScanProgress {
  status: "idle" | "scanning" | "completed" | "error";
  currentFile?: string;
  scannedFiles: number;
  totalFiles: number;
  importedBooks: number;
  importedAudiobooks: number;
  duplicatesSkipped: number;
  errors: string[];
}

type GradientStyle = 'radial' | 'linear' | 'inverted-radial' | 'horizontal' | 'vertical' | 'multi-point';
type ColorExtractionMethod = 'mmcq' | 'vertical-slice' | 'area-weighted' | 'perceptual';

interface AppSettings {
  heroGradientStyle: GradientStyle;
  heroColorExtractionMethod: ColorExtractionMethod;
  heroGradientPoints: number;
}

interface ConfigResponse {
  settings: AppSettings;
  configDir: string;
}

const settingFormSchema = z.object({
  apiType: z.enum(["rapidapi", "direct"]).default("rapidapi"),
  apiKey: z.string().optional(),
  donatorKey: z.string().optional(),
});

const googleBooksApiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

const libraryPathsFormSchema = z.object({
  booksPath: z.string().min(1, "Books directory path is required"),
  audiobooksPath: z.string().min(1, "Audiobooks directory path is required"),
});

const googleOAuthFormSchema = z.object({
  googleClientId: z.string().min(1, "Client ID is required"),
  googleClientSecret: z.string().min(1, "Client Secret is required"),
});

type SettingFormValues = z.infer<typeof settingFormSchema>;
type LibraryPathsFormValues = z.infer<typeof libraryPathsFormSchema>;
type GoogleBooksApiKeyFormValues = z.infer<typeof googleBooksApiKeySchema>;
type GoogleOAuthFormValues = z.infer<typeof googleOAuthFormSchema>;

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState<string | null>(null);
  const [showDeleteClubConfirm, setShowDeleteClubConfirm] = useState<string | null>(null);
  const [showDeleteBookConfirm, setShowDeleteBookConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidatingApiKey, setIsValidatingApiKey] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [customScanPath, setCustomScanPath] = useState("");
  const [showCalibreImport, setShowCalibreImport] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [backupPreview, setBackupPreview] = useState<{
    valid: boolean;
    version?: string;
    exportedAt?: string;
    metadata?: {
      bookCount: number;
      audiobookCount: number;
      collectionCount: number;
      highlightCount: number;
      bookmarkCount: number;
      ratingCount: number;
      goalCount: number;
    };
    errors?: string[];
  } | null>(null);
  const [pendingBackupData, setPendingBackupData] = useState<any>(null);

  const { data: invites, isLoading: invitesLoading } = useQuery<InviteToken[]>({
    queryKey: ["/api/auth/invites"],
    enabled: user?.role === "admin",
  });

  const { data: users, isLoading: usersLoading } = useQuery<UserInfo[]>({
    queryKey: ["/api/auth/users"],
    enabled: user?.role === "admin",
  });

  const { data: bookClubs, isLoading: bookClubsLoading } = useQuery<BookClubInfo[]>({
    queryKey: ["/api/book-clubs"],
    enabled: user?.role === "admin",
  });

  const { data: books, isLoading: booksLoading } = useQuery<BookInfo[]>({
    queryKey: ["/api/books"],
    enabled: user?.role === "admin",
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<any[]>({
    queryKey: ["/api/settings"],
    enabled: user?.role === "admin",
  });

  const annasArchiveApiTypeSetting = settings?.find(s => s.key === "annasArchiveApiType");
  const annasArchiveApiKeySetting = settings?.find(s => s.key === "annasArchiveApiKey");
  const donatorKeySetting = settings?.find(s => s.key === "annasArchiveDonatorKey");
  const booksPathSetting = settings?.find(s => s.key === "booksDirectoryPath");
  const audiobooksPathSetting = settings?.find(s => s.key === "audiobooksDirectoryPath");
  const googleBooksApiKeySetting = settings?.find(s => s.key === "googleBooksApiKey");

  const form = useForm<SettingFormValues>({
    resolver: zodResolver(settingFormSchema),
    defaultValues: {
      apiType: "rapidapi",
      apiKey: "",
      donatorKey: "",
    },
  });

  const libraryPathsForm = useForm<LibraryPathsFormValues>({
    resolver: zodResolver(libraryPathsFormSchema),
    defaultValues: {
      booksPath: "/books",
      audiobooksPath: "/audiobooks",
    },
  });

  const googleBooksApiKeyForm = useForm<GoogleBooksApiKeyFormValues>({
    resolver: zodResolver(googleBooksApiKeySchema),
    defaultValues: {
      apiKey: "",
    },
  });

  const googleOAuthForm = useForm<GoogleOAuthFormValues>({
    resolver: zodResolver(googleOAuthFormSchema),
    defaultValues: {
      googleClientId: "",
      googleClientSecret: "",
    },
  });

  // Query for OAuth config
  const { data: oauthConfig, isLoading: oauthConfigLoading } = useQuery<{ googleConfigured: boolean; googleClientId: string | null }>({
    queryKey: ["/api/auth/oauth-config"],
    enabled: user?.role === "admin",
  });

  // Query for app config (hero gradient settings)
  const { data: configData, isLoading: configLoading } = useQuery<ConfigResponse>({
    queryKey: ["/api/config"],
    enabled: user?.role === "admin",
  });

  // State for hero gradient settings
  const [heroGradientStyle, setHeroGradientStyle] = useState<GradientStyle>('multi-point');
  const [heroColorExtractionMethod, setHeroColorExtractionMethod] = useState<ColorExtractionMethod>('mmcq');
  const [heroGradientPoints, setHeroGradientPoints] = useState<number>(6);

  // Update local state when config loads
  useEffect(() => {
    if (configData?.settings) {
      setHeroGradientStyle(configData.settings.heroGradientStyle || 'multi-point');
      setHeroColorExtractionMethod(configData.settings.heroColorExtractionMethod || 'mmcq');
      setHeroGradientPoints(configData.settings.heroGradientPoints || 6);
    }
  }, [configData]);

  // Mutation for saving hero gradient settings
  const saveHeroGradientMutation = useMutation({
    mutationFn: async (data: { heroGradientStyle: GradientStyle; heroColorExtractionMethod: ColorExtractionMethod; heroGradientPoints: number }) => {
      const response = await apiRequest("PATCH", "/api/config/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: "Settings saved",
        description: "Hero gradient settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for re-extracting colors for all books/audiobooks
  const reextractColorsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/config/reextract-colors");
      return response.json();
    },
    onSuccess: (data: { method: string; booksUpdated: number; audiobooksUpdated: number; errors?: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      const methodNames: Record<string, string> = {
        'mmcq': 'MMCQ',
        'vertical-slice': 'Vertical Slice',
        'area-weighted': 'Area-Weighted',
        'perceptual': 'Perceptual'
      };
      toast({
        title: "Colors re-extracted",
        description: `Updated ${data.booksUpdated} books and ${data.audiobooksUpdated} audiobooks using ${methodNames[data.method] || data.method} method.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to re-extract colors",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (booksPathSetting && audiobooksPathSetting) {
      libraryPathsForm.setValue("booksPath", booksPathSetting.value || "/books");
      libraryPathsForm.setValue("audiobooksPath", audiobooksPathSetting.value || "/audiobooks");
    }
  }, [booksPathSetting, audiobooksPathSetting, libraryPathsForm]);

  useEffect(() => {
    if (googleBooksApiKeySetting?.value) {
      googleBooksApiKeyForm.setValue("apiKey", googleBooksApiKeySetting.value);
    }
  }, [googleBooksApiKeySetting, googleBooksApiKeyForm]);

  useEffect(() => {
    if (annasArchiveApiTypeSetting?.value) {
      form.setValue("apiType", annasArchiveApiTypeSetting.value as "rapidapi" | "direct");
    }
  }, [annasArchiveApiTypeSetting, form]);

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const days = parseInt(expiresInDays) || 7;
      const response = await apiRequest("POST", "/api/auth/invites", {
        expiresIn: days * 24 * 60 * 60 * 1000,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/invites"] });
      setShowCreateInvite(false);
      toast({
        title: "Invite created",
        description: "A new invite code has been generated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create invite",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      await apiRequest("DELETE", `/api/auth/invites/${tokenId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/invites"] });
      setShowDeleteConfirm(null);
      toast({
        title: "Invite revoked",
        description: "The invite code has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to revoke invite",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/auth/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      setShowDeleteUserConfirm(null);
      toast({
        title: "User deleted",
        description: "The user account has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteBookClubMutation = useMutation({
    mutationFn: async (clubId: string) => {
      await apiRequest("DELETE", `/api/book-clubs/${clubId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-clubs"] });
      setShowDeleteClubConfirm(null);
      toast({
        title: "Book club deleted",
        description: "The book club has been permanently removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete book club",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: async (bookId: string) => {
      await apiRequest("DELETE", `/api/books/${bookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      setShowDeleteBookConfirm(null);
      toast({
        title: "Book deleted",
        description: "The book has been removed from your library.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete book",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: SettingFormValues) => {
      const promises: Promise<any>[] = [];
      
      // Always save the API type
      promises.push(apiRequest("POST", "/api/settings", {
        key: "annasArchiveApiType",
        value: values.apiType,
        isSecret: false,
        scope: "global",
      }));
      
      if (values.apiKey && values.apiKey.trim() !== "") {
        promises.push(apiRequest("POST", "/api/settings", {
          key: "annasArchiveApiKey",
          value: values.apiKey,
          isSecret: true,
          scope: "global",
        }));
      }
      
      if (values.donatorKey && values.donatorKey.trim() !== "") {
        promises.push(apiRequest("POST", "/api/settings", {
          key: "annasArchiveDonatorKey",
          value: values.donatorKey,
          isSecret: true,
          scope: "global",
        }));
      }
      
      if (promises.length === 0) {
        return null;
      }
      
      return Promise.all(promises);
    },
    onSuccess: (data) => {
      if (data !== null) {
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        toast({
          title: "Settings saved",
          description: "Your Anna's Archive settings have been updated successfully.",
        });
      } else {
        toast({
          title: "No changes",
          description: "Your existing keys are still configured.",
        });
      }
      setIsSaving(false);
      form.reset({ apiKey: "", donatorKey: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const saveLibraryPathsMutation = useMutation({
    mutationFn: async (values: LibraryPathsFormValues) => {
      await apiRequest("POST", "/api/settings", {
        key: "booksDirectoryPath",
        value: values.booksPath,
        scope: "global",
      });
      await apiRequest("POST", "/api/settings", {
        key: "audiobooksDirectoryPath",
        value: values.audiobooksPath,
        scope: "global",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Library paths saved",
        description: "Your library directory paths have been updated.",
      });
      setIsSaving(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error saving library paths",
        description: error.message || "Failed to save library paths",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const saveGoogleBooksApiKeyMutation = useMutation({
    mutationFn: async (values: GoogleBooksApiKeyFormValues) => {
      setIsValidatingApiKey(true);
      const validationResponse = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=test&key=${values.apiKey}&maxResults=1`
      );
      if (!validationResponse.ok) {
        const error = await validationResponse.json();
        throw new Error(error.error?.message || "Invalid API key");
      }
      return apiRequest("POST", "/api/settings", {
        key: "googleBooksApiKey",
        value: values.apiKey,
        isSecret: true,
        scope: "global",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "API key saved",
        description: "Your Google Books API key has been validated and saved.",
      });
      setIsValidatingApiKey(false);
      setIsSaving(false);
      googleBooksApiKeyForm.reset({ apiKey: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving API key",
        description: error.message || "Failed to validate or save API key",
        variant: "destructive",
      });
      setIsValidatingApiKey(false);
      setIsSaving(false);
    },
  });

  const saveGoogleOAuthMutation = useMutation({
    mutationFn: async (values: GoogleOAuthFormValues) => {
      return apiRequest("POST", "/api/auth/oauth-config", {
        googleClientId: values.googleClientId,
        googleClientSecret: values.googleClientSecret,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/oauth-config"] });
      toast({
        title: "Google OAuth configured",
        description: "Users can now link their Google accounts and use Login with Google.",
      });
      setIsSaving(false);
      googleOAuthForm.reset({ googleClientId: "", googleClientSecret: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving OAuth config",
        description: error.message || "Failed to save Google OAuth configuration",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const disableGoogleOAuthMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/oauth-config", {
        googleClientId: "",
        googleClientSecret: "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/oauth-config"] });
      toast({
        title: "Google OAuth disabled",
        description: "Google login has been disabled. Users will need to use username/password to login.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error disabling OAuth",
        description: error.message || "Failed to disable Google OAuth",
        variant: "destructive",
      });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (customPath?: string) => {
      const endpoint = customPath 
        ? `/api/scan?path=${encodeURIComponent(customPath)}`
        : "/api/scan";
      const response = await apiRequest("POST", endpoint);
      return response.json();
    },
    onSuccess: (data: ScanProgress) => {
      setIsScanning(false);
      if (data.status === "completed") {
        toast({
          title: "Scan completed",
          description: `Imported ${data.importedBooks} books and ${data.importedAudiobooks} audiobooks. ${data.duplicatesSkipped} duplicates skipped.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/books"] });
        queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      } else if (data.status === "error") {
        toast({
          title: "Scan completed with errors",
          description: `${data.errors.length} errors occurred during scanning.`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setIsScanning(false);
      toast({
        title: "Scan failed",
        description: error.message || "Failed to scan directories",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (token: string) => {
    try {
      const registrationUrl = `${window.location.origin}/register?invite=${token}`;
      await navigator.clipboard.writeText(registrationUrl);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
      toast({
        title: "Copied to clipboard",
        description: "Registration link copied!",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: SettingFormValues) => {
    setIsSaving(true);
    saveMutation.mutate(values);
  };

  const onLibraryPathsSubmit = async (values: LibraryPathsFormValues) => {
    setIsSaving(true);
    saveLibraryPathsMutation.mutate(values);
  };

  const onGoogleBooksApiKeySubmit = async (values: GoogleBooksApiKeyFormValues) => {
    setIsSaving(true);
    saveGoogleBooksApiKeyMutation.mutate(values);
  };

  const onGoogleOAuthSubmit = async (values: GoogleOAuthFormValues) => {
    setIsSaving(true);
    saveGoogleOAuthMutation.mutate(values);
  };

  const handleScanLibrary = () => {
    setIsScanning(true);
    scanMutation.mutate(undefined);
  };

  const handleScanCustomPath = () => {
    if (!customScanPath.trim()) return;
    setIsScanning(true);
    scanMutation.mutate(customScanPath.trim());
  };

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen overflow-auto">
        <div className="container max-w-4xl mx-auto p-6 md:p-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don't have permission to access this page. Only administrators can manage users and invites.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const activeInvites = invites?.filter(i => i.isActive && (!i.expiresAt || i.expiresAt > Date.now()) && (!i.maxUses || i.usageCount < i.maxUses)) || [];
  const usedOrExpiredInvites = invites?.filter(i => !i.isActive || (i.expiresAt && i.expiresAt <= Date.now()) || (i.maxUses && i.usageCount >= i.maxUses)) || [];

  return (
    <div className="min-h-screen overflow-auto">
      <div className="container max-w-5xl mx-auto p-6 md:p-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground">
            Manage users, invites, and server settings
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="server" className="flex items-center gap-2" data-testid="tab-server">
              <Settings2 className="h-4 w-4" />
              Server Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {/* Invite Codes Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Invite Codes
                  </CardTitle>
                  <CardDescription>
                    Generate invite codes for new users to register
                  </CardDescription>
                </div>
                <Dialog open={showCreateInvite} onOpenChange={setShowCreateInvite}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-invite">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Invite Code</DialogTitle>
                      <DialogDescription>
                        Generate a new invite code for someone to register an account.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="expires-days">Expires in (days)</Label>
                        <Input
                          id="expires-days"
                          type="number"
                          min="1"
                          max="365"
                          value={expiresInDays}
                          onChange={(e) => setExpiresInDays(e.target.value)}
                          data-testid="input-expires-days"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowCreateInvite(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createInviteMutation.mutate()}
                        disabled={createInviteMutation.isPending}
                        data-testid="button-confirm-create-invite"
                      >
                        {createInviteMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Invite"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {invitesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : activeInvites.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No active invite codes</p>
                    <p className="text-sm mt-1">Create an invite to let new users register</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Token</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeInvites.map((invite) => (
                          <TableRow key={invite.id} data-testid={`row-invite-${invite.id}`}>
                            <TableCell className="font-mono">
                              {invite.code.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {invite.expiresAt ? format(new Date(invite.expiresAt), "MMM d, yyyy") : "Never"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(invite.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyToClipboard(invite.code)}
                                  data-testid={`button-copy-${invite.id}`}
                                >
                                  {copiedToken === invite.code ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <Dialog 
                                  open={showDeleteConfirm === invite.id} 
                                  onOpenChange={(open) => setShowDeleteConfirm(open ? invite.id : null)}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      data-testid={`button-delete-${invite.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Revoke Invite</DialogTitle>
                                      <DialogDescription>
                                        Are you sure you want to revoke this invite code? 
                                        Anyone with this code will no longer be able to register.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                      <Button
                                        variant="outline"
                                        onClick={() => setShowDeleteConfirm(null)}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => revokeInviteMutation.mutate(invite.id)}
                                        disabled={revokeInviteMutation.isPending}
                                        data-testid="button-confirm-delete"
                                      >
                                        {revokeInviteMutation.isPending ? (
                                          <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Revoking...
                                          </>
                                        ) : (
                                          "Revoke"
                                        )}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {usedOrExpiredInvites.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      Used / Expired Invites
                    </h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Token</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usedOrExpiredInvites.slice(0, 5).map((invite) => (
                            <TableRow key={invite.id} className="opacity-60">
                              <TableCell className="font-mono">
                                {invite.code.substring(0, 8)}...
                              </TableCell>
                              <TableCell>
                                {invite.maxUses && invite.usageCount >= invite.maxUses ? (
                                  <Badge variant="secondary">
                                    <User className="h-3 w-3 mr-1" />
                                    Used ({invite.usageCount}/{invite.maxUses})
                                  </Badge>
                                ) : !invite.isActive ? (
                                  <Badge variant="outline">Revoked</Badge>
                                ) : (
                                  <Badge variant="outline">Expired</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {format(new Date(invite.createdAt), "MMM d, yyyy")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Users Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Users
                  </CardTitle>
                  <CardDescription>
                    All registered users in your library
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] })}
                  data-testid="button-refresh-users"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !users || users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No users yet</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Auth Methods</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-sm font-medium text-primary">
                                    {(u.displayName || u.username || "U")[0].toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium">{u.displayName || u.username}</p>
                                  <p className="text-sm text-muted-foreground">@{u.username}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                                <Shield className="h-3 w-3 mr-1" />
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">Password</Badge>
                                {u.googleId && (
                                  <Badge variant="outline">
                                    <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24">
                                      <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                      />
                                      <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                      />
                                      <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                      />
                                      <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                      />
                                    </svg>
                                    Google
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(u.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              {u.id !== user?.id && (
                                <Dialog open={showDeleteUserConfirm === u.id} onOpenChange={(open) => setShowDeleteUserConfirm(open ? u.id : null)}>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      data-testid={`button-delete-user-${u.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Delete User</DialogTitle>
                                      <DialogDescription>
                                        Are you sure you want to delete the user "{u.displayName || u.username}"? This action cannot be undone and will remove their account and session data.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex justify-end gap-3 mt-4">
                                      <Button
                                        variant="outline"
                                        onClick={() => setShowDeleteUserConfirm(null)}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => deleteUserMutation.mutate(u.id)}
                                        disabled={deleteUserMutation.isPending}
                                        data-testid={`button-confirm-delete-user-${u.id}`}
                                      >
                                        {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Book Clubs Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Book Clubs
                  </CardTitle>
                  <CardDescription>
                    Manage all book clubs in your library
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/book-clubs"] })}
                  data-testid="button-refresh-clubs"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {bookClubsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !bookClubs || bookClubs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No book clubs yet</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Club Name</TableHead>
                          <TableHead>Members</TableHead>
                          <TableHead>Visibility</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookClubs.map((club) => (
                          <TableRow key={club.id} data-testid={`row-club-${club.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <BookOpen className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{club.name}</p>
                                  {club.description && (
                                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">{club.description}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                <Users className="h-3 w-3 mr-1" />
                                {club.memberCount || 0}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={club.isPrivate ? "outline" : "secondary"}>
                                {club.isPrivate ? (
                                  <>
                                    <Lock className="h-3 w-3 mr-1" />
                                    Private
                                  </>
                                ) : (
                                  <>
                                    <Globe className="h-3 w-3 mr-1" />
                                    Public
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(club.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <Dialog open={showDeleteClubConfirm === club.id} onOpenChange={(open) => setShowDeleteClubConfirm(open ? club.id : null)}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    data-testid={`button-delete-club-${club.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete Book Club</DialogTitle>
                                    <DialogDescription>
                                      Are you sure you want to delete the book club "{club.name}"? This action cannot be undone and will remove all members, discussions, and meetings.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="flex justify-end gap-3 mt-4">
                                    <Button
                                      variant="outline"
                                      onClick={() => setShowDeleteClubConfirm(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => deleteBookClubMutation.mutate(club.id)}
                                      disabled={deleteBookClubMutation.isPending}
                                      data-testid={`button-confirm-delete-club-${club.id}`}
                                    >
                                      {deleteBookClubMutation.isPending ? "Deleting..." : "Delete Club"}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Books Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Library className="h-5 w-5" />
                    Books
                  </CardTitle>
                  <CardDescription>
                    Manage all books in your library
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/books"] })}
                  data-testid="button-refresh-books"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {booksLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !books || books.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Library className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No books in your library</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Book</TableHead>
                          <TableHead>Author</TableHead>
                          <TableHead>Format</TableHead>
                          <TableHead>Added</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {books.map((book) => (
                          <TableRow key={book.id} data-testid={`row-book-${book.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {book.coverUrl ? (
                                  <img 
                                    src={book.coverUrl} 
                                    alt={book.title} 
                                    className="h-12 w-8 object-cover rounded"
                                  />
                                ) : (
                                  <div className="h-12 w-8 rounded bg-primary/10 flex items-center justify-center">
                                    <BookOpen className="h-4 w-4 text-primary" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium truncate max-w-[200px]">{book.title}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                                {book.author || "Unknown"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {book.format && (
                                <Badge variant="secondary">
                                  {book.format.toUpperCase()}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {book.addedAt && format(new Date(book.addedAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <Dialog open={showDeleteBookConfirm === book.id} onOpenChange={(open) => setShowDeleteBookConfirm(open ? book.id : null)}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    data-testid={`button-delete-book-${book.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Delete Book</DialogTitle>
                                    <DialogDescription>
                                      Are you sure you want to delete "{book.title}"? This action cannot be undone.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="flex justify-end gap-3 mt-4">
                                    <Button
                                      variant="outline"
                                      onClick={() => setShowDeleteBookConfirm(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => deleteBookMutation.mutate(book.id)}
                                      disabled={deleteBookMutation.isPending}
                                      data-testid={`button-confirm-delete-book-${book.id}`}
                                    >
                                      {deleteBookMutation.isPending ? "Deleting..." : "Delete Book"}
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="server" className="space-y-6">
            {/* Anna's Archive Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Anna's Archive Integration
                </CardTitle>
                <CardDescription>
                  Connect to Anna's Archive to search and download ebooks directly to your library
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settingsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="apiType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Provider</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-api-type">
                                  <SelectValue placeholder="Select API provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="rapidapi">RapidAPI (Recommended)</SelectItem>
                                <SelectItem value="direct">Direct Anna's Archive API</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose which API provider to use for searching Anna's Archive.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {form.watch("apiType") === "rapidapi" ? (
                        <Alert>
                          <AlertDescription>
                            Get your API key from{" "}
                            <a
                              href="https://rapidapi.com/tribestick-tribestick-default/api/annas-archive-api"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              RapidAPI
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {" "}- Subscribe to the free tier (3,000 requests/month) and copy your X-RapidAPI-Key.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert>
                          <AlertDescription>
                            Get your API key from your{" "}
                            <a
                              href="https://annas-archive.org/account"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              Anna's Archive account
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            {" "}- This requires a direct API key from Anna's Archive (if available).
                          </AlertDescription>
                        </Alert>
                      )}

                      <FormField
                        control={form.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {form.watch("apiType") === "rapidapi" ? "RapidAPI Key" : "API Key"} (Required for Search)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder={form.watch("apiType") === "rapidapi" 
                                  ? "Enter your RapidAPI X-RapidAPI-Key" 
                                  : "Enter your Anna's Archive API key"}
                                {...field}
                                data-testid="input-api-key"
                              />
                            </FormControl>
                            <FormDescription>
                              {annasArchiveApiKeySetting ? (
                                <>
                                  <span className="text-green-600 dark:text-green-400 font-medium">API key is configured</span> - Leave blank to keep current key, or enter a new key to update
                                </>
                              ) : (
                                "Your API key will be encrypted and stored securely. Required to enable book search in Discover Books."
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="donatorKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Donator Account ID (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Enter your Anna's Archive account ID for faster downloads"
                                {...field}
                                data-testid="input-donator-key"
                              />
                            </FormControl>
                            <FormDescription>
                              {donatorKeySetting ? (
                                <>
                                  <span className="text-green-600 dark:text-green-400 font-medium">Donator key is configured</span> - Leave blank to keep current key, or enter a new key to update
                                </>
                              ) : (
                                "Optional: Donator account ID removes download wait times. Find it in your Anna's Archive account settings."
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={isSaving}
                        data-testid="button-save-settings"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Saving..." : "Save Settings"}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            {/* Library Paths */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Folder className="h-5 w-5" />
                  Library Paths
                </CardTitle>
                <CardDescription>
                  Configure directory paths for books and audiobooks (required for Docker/Unraid deployments)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    For Docker/Unraid: Map your host directories to these container paths. Example: Host <code className="px-1.5 py-0.5 bg-muted rounded">/mnt/user/media/books</code> → Container <code className="px-1.5 py-0.5 bg-muted rounded">/books</code>
                  </AlertDescription>
                </Alert>

                {settingsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Form {...libraryPathsForm}>
                    <form onSubmit={libraryPathsForm.handleSubmit(onLibraryPathsSubmit)} className="space-y-4">
                      <FormField
                        control={libraryPathsForm.control}
                        name="booksPath"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Books Directory Path</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="/books"
                                {...field}
                                data-testid="input-books-path"
                              />
                            </FormControl>
                            <FormDescription>
                              The directory path where books are stored (e.g., /books, /data/media/books)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={libraryPathsForm.control}
                        name="audiobooksPath"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Audiobooks Directory Path</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="/audiobooks"
                                {...field}
                                data-testid="input-audiobooks-path"
                              />
                            </FormControl>
                            <FormDescription>
                              The directory path where audiobooks are stored (e.g., /audiobooks, /data/media/audiobooks)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={isSaving}
                        data-testid="button-save-library-paths"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Saving..." : "Save Library Paths"}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            {/* File Scanner */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanLine className="h-5 w-5" />
                  File Scanner
                </CardTitle>
                <CardDescription>
                  Scan directories for books and audiobooks to automatically import them into your library
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    The scanner will search for EPUB, PDF, MOBI, CBZ, CBR (books) and M4B, MP3, M4A (audiobooks) files. 
                    Duplicate files (same path) will be skipped.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Scan Library Paths</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Scans the books and audiobooks directories configured above.
                    </p>
                    <Button
                      onClick={handleScanLibrary}
                      disabled={isScanning}
                      data-testid="button-scan-library"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <ScanLine className="h-4 w-4 mr-2" />
                          Scan Library Paths
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Scan Custom Directory</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Scan a specific directory for media files.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="/path/to/media/folder"
                        value={customScanPath}
                        onChange={(e) => setCustomScanPath(e.target.value)}
                        className="flex-1"
                        disabled={isScanning}
                        data-testid="input-custom-scan-path"
                      />
                      <Button
                        onClick={handleScanCustomPath}
                        disabled={isScanning || !customScanPath.trim()}
                        variant="outline"
                        data-testid="button-scan-custom"
                      >
                        {isScanning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Google Books API */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Google Books API
                </CardTitle>
                <CardDescription>
                  Connect your Google Books API key to enable personalized book recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Get a free Google Books API key to unlock personalized recommendations based on your library.{" "}
                    <a
                      href="https://console.cloud.google.com/apis/library/books.googleapis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Get your API key
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </AlertDescription>
                </Alert>

                {settingsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <Form {...googleBooksApiKeyForm}>
                    <form onSubmit={googleBooksApiKeyForm.handleSubmit(onGoogleBooksApiKeySubmit)} className="space-y-4">
                      <FormField
                        control={googleBooksApiKeyForm.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Google Books API Key</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Enter your Google Books API key"
                                {...field}
                                data-testid="input-google-books-api-key"
                              />
                            </FormControl>
                            <FormDescription>
                              {googleBooksApiKeySetting ? (
                                <>
                                  <span className="text-green-600 dark:text-green-400 font-medium">API key is configured</span> - Recommendations are enabled. Enter a new key to update.
                                </>
                              ) : (
                                <>
                                  Your API key will be validated and encrypted before saving. Follow the{" "}
                                  <a
                                    href="https://developers.google.com/books/docs/v1/using#APIKey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    official guide
                                  </a>{" "}
                                  to create one.
                                </>
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={isSaving || isValidatingApiKey}
                        data-testid="button-save-google-books-api-key"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isValidatingApiKey ? "Validating..." : isSaving ? "Saving..." : "Save API Key"}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>

            {/* Google OAuth Login */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Google OAuth Login
                </CardTitle>
                <CardDescription>
                  Allow users to link their accounts to Google and login with Google
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Enable Google OAuth to allow users to link their existing Luma account with their Google account. 
                    Users must first create an account using an invite code, then link their Google account in Settings before using "Login with Google".{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Create OAuth credentials
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </AlertDescription>
                </Alert>

                {oauthConfig?.googleConfigured && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">Google OAuth is enabled</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to disable Google OAuth? Users will no longer be able to login with Google.")) {
                            disableGoogleOAuthMutation.mutate();
                          }
                        }}
                        disabled={disableGoogleOAuthMutation.isPending}
                        data-testid="button-disable-google-oauth"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Disable
                      </Button>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Users can now link their Google account from Settings and use "Login with Google"
                    </p>
                  </div>
                )}

                {oauthConfigLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !oauthConfig?.googleConfigured ? (
                  <Form {...googleOAuthForm}>
                    <form onSubmit={googleOAuthForm.handleSubmit(onGoogleOAuthSubmit)} className="space-y-4">
                      <FormField
                        control={googleOAuthForm.control}
                        name="googleClientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Google Client ID</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="xxxxxxxxx.apps.googleusercontent.com"
                                {...field}
                                data-testid="input-google-client-id"
                              />
                            </FormControl>
                            <FormDescription>
                              The Client ID from your Google Cloud Console OAuth 2.0 credentials
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={googleOAuthForm.control}
                        name="googleClientSecret"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Google Client Secret</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Enter your Client Secret"
                                {...field}
                                data-testid="input-google-client-secret"
                              />
                            </FormControl>
                            <FormDescription>
                              The Client Secret from your Google Cloud Console OAuth 2.0 credentials
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Make sure to add <code className="px-1.5 py-0.5 bg-muted rounded">{window.location.origin}/api/auth/google/callback</code> as an authorized redirect URI in your Google Cloud Console.
                        </AlertDescription>
                      </Alert>

                      <Button
                        type="submit"
                        disabled={isSaving}
                        data-testid="button-save-google-oauth"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Saving..." : "Enable Google OAuth"}
                      </Button>
                    </form>
                  </Form>
                ) : null}
              </CardContent>
            </Card>

            {/* Calibre Import */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Library className="h-5 w-5" />
                  Calibre Library Import
                </CardTitle>
                <CardDescription>
                  Import books from your existing Calibre library
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect to your Calibre library to import your existing book collection. 
                  Luma will read the Calibre metadata database and import book information
                  along with cover images and tags.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setShowCalibreImport(true)}
                  data-testid="button-calibre-import"
                >
                  <Library className="h-4 w-4 mr-2" />
                  Import from Calibre
                </Button>
              </CardContent>
            </Card>

            {/* Backup & Restore */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Library Backup & Restore
                </CardTitle>
                <CardDescription>
                  Create a complete backup of your library or restore from a previous backup
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Export Backup</h4>
                    <Button
                      variant="outline"
                      disabled={isExportingBackup}
                      onClick={async () => {
                        setIsExportingBackup(true);
                        try {
                          const response = await fetch("/api/backup/export");
                          if (!response.ok) {
                            throw new Error("Failed to export backup");
                          }
                          const blob = await response.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `luma-backup-${new Date().toISOString().split('T')[0]}.json`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          toast({
                            title: "Backup exported",
                            description: "Your library backup has been downloaded.",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Export failed",
                            description: error.message || "Failed to export backup",
                            variant: "destructive",
                          });
                        } finally {
                          setIsExportingBackup(false);
                        }
                      }}
                      data-testid="button-export-backup"
                    >
                      {isExportingBackup ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Export Library Backup
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <h4 className="text-sm font-medium">Import Backup</h4>
                    <p className="text-sm text-muted-foreground">
                      Restore your library from a previously exported backup file. Existing items will be preserved.
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".json"
                          className="max-w-xs"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            try {
                              const text = await file.text();
                              const data = JSON.parse(text);
                              
                              const response = await apiRequest("POST", "/api/backup/validate", { data });
                              const result = await response.json();
                              
                              setBackupPreview(result);
                              if (result.valid) {
                                setPendingBackupData(data);
                              } else {
                                setPendingBackupData(null);
                              }
                            } catch (error: any) {
                              setBackupPreview({
                                valid: false,
                                errors: ["Invalid JSON file or corrupt backup"],
                              });
                              setPendingBackupData(null);
                            }
                          }}
                          data-testid="input-backup-file"
                        />
                      </div>

                      {backupPreview && (
                        <div className={`p-4 rounded-lg ${backupPreview.valid ? 'bg-muted' : 'bg-destructive/10'}`}>
                          {backupPreview.valid ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <FileJson className="h-4 w-4 text-primary" />
                                <span className="font-medium">Valid Backup File</span>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>Version: {backupPreview.version}</p>
                                <p>Created: {backupPreview.exportedAt ? new Date(backupPreview.exportedAt).toLocaleString() : 'Unknown'}</p>
                                {backupPreview.metadata && (
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                    <span>Books: {backupPreview.metadata.bookCount}</span>
                                    <span>Audiobooks: {backupPreview.metadata.audiobookCount}</span>
                                    <span>Collections: {backupPreview.metadata.collectionCount}</span>
                                    <span>Highlights: {backupPreview.metadata.highlightCount}</span>
                                    <span>Bookmarks: {backupPreview.metadata.bookmarkCount}</span>
                                    <span>Ratings: {backupPreview.metadata.ratingCount}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="font-medium">Invalid Backup File</span>
                              </div>
                              {backupPreview.errors && (
                                <ul className="text-sm text-destructive list-disc list-inside">
                                  {backupPreview.errors.map((error, i) => (
                                    <li key={i}>{error}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {pendingBackupData && (
                        <Button
                          disabled={isImportingBackup}
                          onClick={async () => {
                            setIsImportingBackup(true);
                            try {
                              const response = await apiRequest("POST", "/api/backup/import", {
                                data: pendingBackupData,
                                options: { skipExisting: true },
                              });
                              const result = await response.json();
                              
                              if (result.success) {
                                const imported = result.imported;
                                const total = imported.books + imported.audiobooks + imported.collections + 
                                             imported.highlights + imported.bookmarks + imported.userRatings;
                                
                                toast({
                                  title: "Backup imported successfully",
                                  description: `Imported ${total} items. ${result.skipped?.books || 0} books and ${result.skipped?.audiobooks || 0} audiobooks were skipped (already exist).`,
                                });
                                
                                queryClient.invalidateQueries({ queryKey: ["/api/books"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
                                
                                setBackupPreview(null);
                                setPendingBackupData(null);
                              } else {
                                toast({
                                  title: "Import completed with errors",
                                  description: result.errors?.length > 0 
                                    ? `${result.errors.length} errors occurred during import.`
                                    : "Some items could not be imported.",
                                  variant: "destructive",
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: "Import failed",
                                description: error.message || "Failed to import backup",
                                variant: "destructive",
                              });
                            } finally {
                              setIsImportingBackup(false);
                            }
                          }}
                          data-testid="button-import-backup"
                        >
                          {isImportingBackup ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Import Backup
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertDescription>
                    Backups include library metadata, reading progress, and annotations. 
                    Book and audiobook files are not included - only references to their storage locations.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Hero Gradient Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Hero Gradient Generation
                </CardTitle>
                <CardDescription>
                  Configure how gradient backgrounds are generated for book and audiobook detail pages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {configLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="gradient-style">Gradient Style</Label>
                      <Select
                        value={heroGradientStyle}
                        onValueChange={(value: GradientStyle) => setHeroGradientStyle(value)}
                        disabled={saveHeroGradientMutation.isPending}
                      >
                        <SelectTrigger id="gradient-style" data-testid="select-gradient-style">
                          <SelectValue placeholder="Select gradient style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multi-point">Multi-Point (Layered Radials)</SelectItem>
                          <SelectItem value="radial">Radial (Top-Left Origin)</SelectItem>
                          <SelectItem value="inverted-radial">Inverted Radial (Bottom-Right Origin)</SelectItem>
                          <SelectItem value="linear">Linear (Diagonal)</SelectItem>
                          <SelectItem value="horizontal">Horizontal (Top to Bottom)</SelectItem>
                          <SelectItem value="vertical">Vertical (Left to Right)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {heroGradientStyle === 'multi-point' && (
                      <div className="space-y-2">
                        <Label htmlFor="gradient-points">Number of Color Points</Label>
                        <Select
                          value={heroGradientPoints.toString()}
                          onValueChange={(value) => setHeroGradientPoints(parseInt(value))}
                          disabled={saveHeroGradientMutation.isPending}
                        >
                          <SelectTrigger id="gradient-points" data-testid="select-gradient-points">
                            <SelectValue placeholder="Select number of points" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 Points (Minimal)</SelectItem>
                            <SelectItem value="4">4 Points</SelectItem>
                            <SelectItem value="5">5 Points</SelectItem>
                            <SelectItem value="6">6 Points (Default)</SelectItem>
                            <SelectItem value="7">7 Points</SelectItem>
                            <SelectItem value="8">8 Points</SelectItem>
                            <SelectItem value="9">9 Points</SelectItem>
                            <SelectItem value="10">10 Points (Maximum)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="color-extraction">Color Extraction Method</Label>
                      <Select
                        value={heroColorExtractionMethod}
                        onValueChange={(value: ColorExtractionMethod) => setHeroColorExtractionMethod(value)}
                        disabled={saveHeroGradientMutation.isPending}
                      >
                        <SelectTrigger id="color-extraction" data-testid="select-color-extraction">
                          <SelectValue placeholder="Select extraction method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mmcq">MMCQ (Area-Based Quantization)</SelectItem>
                          <SelectItem value="vertical-slice">Vertical Slice Analysis</SelectItem>
                          <SelectItem value="area-weighted">Area-Weighted (Text Filtering)</SelectItem>
                          <SelectItem value="perceptual">Perceptual (LAB + Mean-Shift)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => saveHeroGradientMutation.mutate({
                          heroGradientStyle,
                          heroColorExtractionMethod,
                          heroGradientPoints,
                        })}
                        disabled={saveHeroGradientMutation.isPending || reextractColorsMutation.isPending}
                        data-testid="button-save-hero-gradient"
                      >
                        {saveHeroGradientMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Settings
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => reextractColorsMutation.mutate()}
                        disabled={reextractColorsMutation.isPending || saveHeroGradientMutation.isPending}
                        data-testid="button-reextract-colors"
                      >
                        {reextractColorsMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Re-extracting...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Re-extract All Colors
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Calibre Import Modal */}
      <CalibreImportModal
        isOpen={showCalibreImport}
        onClose={() => setShowCalibreImport(false)}
      />
    </div>
  );
}
