import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Headphones, ArrowLeft, Clock, Calendar, Tag, Building2, BookMarked, Send, Car, FolderPlus, ImageIcon, Image, Sparkles, Search, Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { parseJsonArray, sanitizeDescription } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { StarRating } from "@/components/StarRating";
import { SendToDeviceModal } from "@/components/SendToDeviceModal";
import { CoverPickerModal } from "@/components/CoverPickerModal";
import { MoreLikeThisModal } from "@/components/MoreLikeThisModal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AudiobookWithProgress, Collection } from "@shared/schema";

type GradientStyle = 'radial' | 'linear' | 'inverted-radial' | 'horizontal' | 'vertical' | 'multi-point';

interface AppConfig {
  settings: {
    heroGradientStyle: GradientStyle;
    heroGradientPoints: number;
  };
}

// Seeded random number generator for stable positioning based on audiobook ID
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return () => {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };
}

// Normalize color to hex format (handles both #RRGGBB and rgb(...) formats)
function normalizeToHex(color: string): string | null {
  if (!color || typeof color !== 'string') return null;
  
  // Already hex format
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 6 && /^[0-9a-fA-F]+$/.test(hex)) {
      return color;
    }
    return null;
  }
  
  // RGB format: rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }
  
  return null;
}

// Generate color variants from a base color
function generateColorVariants(baseColors: string[], targetCount: number): string[] {
  // Normalize and filter valid colors
  const validColors = baseColors
    .map(c => normalizeToHex(c))
    .filter((c): c is string => c !== null);
  
  if (validColors.length === 0) return [];
  
  const result: string[] = [...validColors];
  let colorIndex = 0;
  
  while (result.length < targetCount) {
    const baseColor = validColors[colorIndex % validColors.length];
    
    // Parse hex color
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Create variants by adjusting lightness/saturation
    const variantType = Math.floor(colorIndex / validColors.length) % 4;
    let nr = r, ng = g, nb = b;
    
    switch (variantType) {
      case 0: // Lighten
        nr = Math.min(255, r + 40);
        ng = Math.min(255, g + 40);
        nb = Math.min(255, b + 40);
        break;
      case 1: // Darken
        nr = Math.max(0, r - 30);
        ng = Math.max(0, g - 30);
        nb = Math.max(0, b - 30);
        break;
      case 2: // Saturate (shift away from gray)
        const avg = (r + g + b) / 3;
        nr = Math.min(255, Math.max(0, r + (r - avg) * 0.3));
        ng = Math.min(255, Math.max(0, g + (g - avg) * 0.3));
        nb = Math.min(255, Math.max(0, b + (b - avg) * 0.3));
        break;
      case 3: // Desaturate slightly
        const avg2 = (r + g + b) / 3;
        nr = r + (avg2 - r) * 0.2;
        ng = g + (avg2 - g) * 0.2;
        nb = b + (avg2 - b) * 0.2;
        break;
    }
    
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
    result.push(`#${toHex(nr)}${toHex(ng)}${toHex(nb)}`);
    colorIndex++;
  }
  
  return result;
}

// Helper to parse hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Calculate perceived brightness of a color (0-255)
function getPerceivedBrightness(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

// Darken a color by a percentage
function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - percent / 100;
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

// Generate multi-point radial gradient CSS
function generateMultiPointGradient(
  colors: string[],
  numPoints: number,
  itemId: string
): { backgroundColor: string; backgroundImage: string } {
  const defaultDarkBase = "rgba(15, 18, 25, 0.98)";
  
  if (colors.length === 0) {
    return {
      backgroundColor: "rgb(25, 30, 40)",
      backgroundImage: `
        radial-gradient(at 40% 20%, rgba(60, 70, 90, 0.6) 0px, transparent 50%),
        radial-gradient(at 80% 10%, rgba(50, 60, 80, 0.5) 0px, transparent 50%),
        radial-gradient(at 10% 50%, rgba(45, 55, 75, 0.5) 0px, transparent 50%),
        radial-gradient(at 70% 60%, rgba(55, 65, 85, 0.4) 0px, transparent 50%),
        radial-gradient(at 20% 90%, rgba(40, 50, 70, 0.5) 0px, transparent 50%),
        radial-gradient(at 90% 80%, rgba(50, 60, 80, 0.4) 0px, transparent 50%)
      `.trim()
    };
  }
  
  // Find the most prominent color (first one) and use a darkened version as base
  // This preserves the cover's color palette instead of using generic dark
  const primaryColor = colors[0];
  const primaryBrightness = getPerceivedBrightness(primaryColor);
  
  // Use a darkened version of a mid-range color as background base
  // For bright covers, darken by less; for dark covers, use darker base
  let baseColor: string;
  if (primaryBrightness > 150) {
    // Bright cover - use a moderately darkened version of primary color
    baseColor = darkenColor(primaryColor, 65);
  } else if (primaryBrightness > 80) {
    // Medium brightness - darken more
    baseColor = darkenColor(primaryColor, 55);
  } else {
    // Already dark - use slightly darkened version
    baseColor = darkenColor(primaryColor, 40);
  }
  
  const random = seededRandom(itemId);
  const expandedColors = generateColorVariants(colors, numPoints);
  
  // Predefined position spread to ensure coverage
  const basePositions = [
    { x: 40, y: 20 }, { x: 80, y: 10 }, { x: 10, y: 50 },
    { x: 70, y: 60 }, { x: 20, y: 90 }, { x: 90, y: 80 },
    { x: 5, y: 15 }, { x: 60, y: 40 }, { x: 30, y: 70 },
    { x: 95, y: 45 }
  ];
  
  const gradients: string[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const color = expandedColors[i];
    const basePos = basePositions[i % basePositions.length];
    
    // Add jitter to positions (±15%)
    const x = Math.max(0, Math.min(100, basePos.x + (random() - 0.5) * 30));
    const y = Math.max(0, Math.min(100, basePos.y + (random() - 0.5) * 30));
    
    // Radius varies from 35% to 60% for better coverage
    const baseRadius = 35 + (i / numPoints) * 25;
    const radius = baseRadius + (random() - 0.5) * 10;
    
    // Higher opacity for more vibrant colors showing through
    const opacity = Math.max(0.55, 0.95 - (i * 0.04));
    const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
    
    gradients.push(
      `radial-gradient(at ${x.toFixed(0)}% ${y.toFixed(0)}%, ${color}${opacityHex} 0px, transparent ${radius.toFixed(0)}%)`
    );
  }
  
  return {
    backgroundColor: baseColor,
    backgroundImage: gradients.join(',\n')
  };
}

export default function AudiobookDetail() {
  const [, params] = useRoute("/audiobooks/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const audiobookId = params?.id;
  const isAdmin = user?.role === "admin";

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [showSimilarBooksModal, setShowSimilarBooksModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [showCoverModal, setShowCoverModal] = useState(false);
  
  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Edit metadata state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editNarrator, setEditNarrator] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSeries, setEditSeries] = useState("");
  const [editSeriesIndex, setEditSeriesIndex] = useState("");
  const [editPublisher, setEditPublisher] = useState("");
  const [editPublishedDate, setEditPublishedDate] = useState("");
  const [editIsbn, setEditIsbn] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editTags, setEditTags] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  const { data: audiobook, isLoading } = useQuery<AudiobookWithProgress>({
    queryKey: ["/api/audiobooks", audiobookId],
    enabled: !!audiobookId,
  });

  const { data: collections = [] } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
    enabled: showCollectionDialog,
  });

  // Fetch app config for hero gradient style
  const { data: appConfig } = useQuery<AppConfig>({
    queryKey: ["/api/config"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Check if email delivery service is configured
  const { data: deliveryConfig } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/delivery/configured"],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const addToCollectionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      return apiRequest("POST", `/api/collections/${collectionId}/items`, {
        itemId: audiobookId,
        itemType: "audiobook",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({
        title: "Added to collection",
        description: "Audiobook has been added to the collection.",
      });
      setShowCollectionDialog(false);
      setSelectedCollection("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add to collection",
        description: error.message || "Could not add audiobook to collection.",
        variant: "destructive",
      });
    },
  });

  // Fetch existing rating/review
  const { data: existingRating } = useQuery<{ rating?: number; review?: string } | null>({
    queryKey: ["/api/ratings", audiobookId],
    queryFn: async () => {
      const params = new URLSearchParams({ userId: 'default', itemId: audiobookId! });
      const response = await fetch(`/api/ratings?${params}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!audiobookId,
  });

  // Load existing rating/review when data arrives
  useEffect(() => {
    if (existingRating) {
      setRating(existingRating.rating || 0);
      setReview(existingRating.review || "");
    }
  }, [existingRating]);

  const handleListen = () => {
    setLocation(`/listen/${audiobookId}`);
  };

  const saveRatingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ratings", {
        userId: 'default',
        itemId: audiobookId,
        itemType: 'audiobook',
        rating: rating,
        review: review.trim() || undefined,
      });
      return response.json() as Promise<{ rating?: number; review?: string }>;
    },
    onSuccess: (data) => {
      if (data) {
        setRating(data.rating || 0);
        setReview(data.review || "");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ratings", audiobookId] });
      setHasChanges(false);
      toast({
        title: "Rating saved",
        description: "Your rating and review have been saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save rating",
        description: error.message || "Could not save your rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch series metadata from Open Library
  const fetchSeriesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/audiobooks/${audiobookId}/fetch-series`, {
        autoUpdate: true,
      });
      return response.json();
    },
    onSuccess: (data: { success: boolean; metadata: { seriesName: string | null; seriesIndex: number | null; confidence: string; source: string }; audiobook: AudiobookWithProgress }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks", audiobookId] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      
      if (data.metadata.seriesName) {
        toast({
          title: "Series found",
          description: `Found series: ${data.metadata.seriesName}${data.metadata.seriesIndex ? ` #${data.metadata.seriesIndex}` : ''} (${data.metadata.source === 'openlibrary' ? 'Open Library' : 'title pattern'})`,
        });
      } else {
        toast({
          title: "No series found",
          description: "Could not find series information for this audiobook.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to fetch series",
        description: error.message || "Could not fetch series metadata.",
        variant: "destructive",
      });
    },
  });

  // Update audiobook metadata mutation
  const updateAudiobookMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      author?: string;
      narrator?: string;
      description?: string;
      series?: string;
      seriesIndex?: number;
      publisher?: string;
      publishedDate?: string;
      isbn?: string;
      language?: string;
      tags?: string;
    }) => {
      return apiRequest("PUT", `/api/audiobooks/${audiobookId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks", audiobookId] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Metadata updated",
        description: "Audiobook information has been updated successfully.",
      });
      setShowEditDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update metadata",
        description: error.message || "Could not update audiobook metadata.",
        variant: "destructive",
      });
    },
  });

  // Delete audiobook mutation
  const deleteAudiobookMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/audiobooks/${audiobookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks", audiobookId] });
      queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
      toast({
        title: "Audiobook deleted",
        description: "The audiobook has been permanently deleted from your library.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete audiobook",
        description: error.message || "Could not delete the audiobook.",
        variant: "destructive",
      });
    },
  });

  // Open edit dialog with current values
  const handleOpenEditDialog = () => {
    if (audiobook) {
      setEditTitle(audiobook.title || "");
      setEditAuthor(audiobook.author || "");
      setEditNarrator(audiobook.narrator || "");
      setEditDescription(audiobook.description || "");
      setEditSeries(audiobook.series || "");
      setEditSeriesIndex(audiobook.seriesIndex?.toString() || "");
      setEditPublisher(audiobook.publisher || "");
      setEditPublishedDate(audiobook.publishedDate || "");
      setEditIsbn(audiobook.isbn || "");
      setEditLanguage(audiobook.language || "");
      const tags = parseJsonArray(audiobook.tags);
      setEditTags(tags.join(", "));
      setShowEditDialog(true);
    }
  };

  // Save edited metadata
  const handleSaveMetadata = () => {
    if (!editTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for the audiobook.",
        variant: "destructive",
      });
      return;
    }

    // Validate seriesIndex is a valid number if provided
    let parsedSeriesIndex: number | undefined;
    if (editSeriesIndex.trim()) {
      const parsed = parseFloat(editSeriesIndex);
      if (isNaN(parsed)) {
        toast({
          title: "Invalid series index",
          description: "Please enter a valid number for series index (e.g., 1, 2, 2.5).",
          variant: "destructive",
        });
        return;
      }
      parsedSeriesIndex = parsed;
    }

    const tagsArray = editTags
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    updateAudiobookMutation.mutate({
      title: editTitle.trim(),
      author: editAuthor.trim() || undefined,
      narrator: editNarrator.trim() || undefined,
      description: editDescription.trim() || undefined,
      series: editSeries.trim() || undefined,
      seriesIndex: parsedSeriesIndex,
      publisher: editPublisher.trim() || undefined,
      publishedDate: editPublishedDate.trim() || undefined,
      isbn: editIsbn.trim() || undefined,
      language: editLanguage.trim() || undefined,
      tags: tagsArray.length > 0 ? JSON.stringify(tagsArray) : undefined,
    });
  };

  // ISBN lookup to fetch metadata
  const handleIsbnLookup = async () => {
    const isbn = editIsbn.trim().replace(/[-\s]/g, '');
    
    if (!isbn) {
      toast({
        title: "ISBN required",
        description: "Please enter an ISBN to look up.",
        variant: "destructive",
      });
      return;
    }
    
    // Basic validation
    const isValidIsbn10 = /^[0-9]{9}[0-9X]$/i.test(isbn);
    const isValidIsbn13 = /^[0-9]{13}$/.test(isbn);
    
    if (!isValidIsbn10 && !isValidIsbn13) {
      toast({
        title: "Invalid ISBN format",
        description: "Please enter a valid 10 or 13 digit ISBN.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLookingUp(true);
    
    try {
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const data = await response.json();
      
      const bookData = data[`ISBN:${isbn}`];
      
      if (!bookData) {
        toast({
          title: "No results found",
          description: "Could not find metadata for this ISBN. Try a different ISBN or enter details manually.",
          variant: "destructive",
        });
        return;
      }
      
      // Auto-fill fields from Open Library data
      if (bookData.title && !editTitle.trim()) {
        setEditTitle(bookData.title);
      }
      
      if (bookData.authors?.[0]?.name && !editAuthor.trim()) {
        setEditAuthor(bookData.authors[0].name);
      }
      
      if (bookData.publishers?.[0]?.name && !editPublisher.trim()) {
        setEditPublisher(bookData.publishers[0].name);
      }
      
      if (bookData.publish_date && !editPublishedDate.trim()) {
        setEditPublishedDate(bookData.publish_date);
      }
      
      if (bookData.subjects && !editTags.trim()) {
        const subjects = bookData.subjects.slice(0, 5).map((s: any) => s.name || s);
        setEditTags(subjects.join(", "));
      }
      
      toast({
        title: "Metadata found",
        description: "Fields have been auto-filled from Open Library. Review and save when ready.",
      });
    } catch (error) {
      toast({
        title: "Lookup failed",
        description: "Could not connect to Open Library. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    setHasChanges(true);
  };

  const handleReviewChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReview(e.target.value);
    setHasChanges(true);
  };

  const handleSaveRating = () => {
    if (rating > 0) {
      saveRatingMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!audiobook) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg text-muted-foreground">Audiobook not found</p>
        <Button onClick={() => setLocation("/")} data-testid="button-back-library">
          Back to Library
        </Button>
      </div>
    );
  }

  const progress = audiobook.progress?.progress || 0;
  const hasProgress = progress > 0;

  // Parse tags and dominant colors safely (handles both arrays and JSON strings)
  const audiobookTags = parseJsonArray(audiobook.tags);
  const audiobookColors = parseJsonArray(audiobook.dominantColors);

  // Generate gradient background from dominant colors using configured style
  const generateGradient = (): React.CSSProperties => {
    const darkBase = "rgba(15, 18, 25, 0.98)";
    const style = appConfig?.settings?.heroGradientStyle || 'multi-point';
    // Clamp gradient points between 3-10 with default of 6
    const numPoints = Math.min(10, Math.max(3, appConfig?.settings?.heroGradientPoints || 6));
    
    // Handle multi-point gradient separately - returns object with backgroundColor and backgroundImage
    if (style === 'multi-point') {
      const multiPointResult = generateMultiPointGradient(audiobookColors, numPoints, audiobookId || 'default');
      return {
        backgroundColor: multiPointResult.backgroundColor,
        backgroundImage: multiPointResult.backgroundImage,
      };
    }
    
    if (audiobookColors.length === 0) {
      // Default fallback gradient when no colors
      switch (style) {
        case 'linear':
          return { background: `linear-gradient(135deg, rgb(40, 45, 55) 0%, rgb(25, 30, 40) 50%, ${darkBase} 100%)` };
        case 'inverted-radial':
          return { background: `radial-gradient(ellipse 150% 100% at 75% 100%, rgb(40, 45, 55) 0%, rgb(25, 30, 40) 30%, ${darkBase} 70%)` };
        case 'horizontal':
          return { background: `linear-gradient(90deg, rgb(40, 45, 55) 0%, rgb(25, 30, 40) 40%, ${darkBase} 100%)` };
        case 'vertical':
          return { background: `linear-gradient(180deg, rgb(40, 45, 55) 0%, rgb(25, 30, 40) 30%, ${darkBase} 70%)` };
        default:
          return { background: `radial-gradient(ellipse 150% 100% at 25% 0%, rgb(40, 45, 55) 0%, rgb(25, 30, 40) 30%, ${darkBase} 70%)` };
      }
    }

    const colors = audiobookColors.slice(0, 3);
    
    // Build gradient based on style
    switch (style) {
      case 'linear':
        if (colors.length === 1) {
          return { background: `linear-gradient(135deg, ${colors[0]}88 0%, ${colors[0]}44 40%, ${darkBase} 100%)` };
        } else if (colors.length === 2) {
          return { background: `linear-gradient(135deg, ${colors[0]}88 0%, ${colors[0]}44 30%, ${colors[1]}55 60%, ${darkBase} 100%)` };
        } else {
          return { background: `linear-gradient(135deg, ${colors[0]}77 0%, ${colors[0]}33 20%, ${colors[1]}55 40%, ${colors[1]}22 60%, ${colors[2]}44 80%, ${darkBase} 100%)` };
        }
      
      case 'inverted-radial':
        if (colors.length === 1) {
          return { background: `radial-gradient(ellipse 180% 120% at 80% 90%, ${colors[0]}88 0%, ${colors[0]}44 25%, ${darkBase} 65%)` };
        } else if (colors.length === 2) {
          return { background: `radial-gradient(ellipse 180% 120% at 80% 90%, ${colors[0]}88 0%, ${colors[0]}44 20%, ${colors[1]}55 40%, ${darkBase} 70%)` };
        } else {
          return { background: `radial-gradient(ellipse 200% 150% at 85% 95%, ${colors[0]}77 0%, ${colors[0]}33 15%, ${colors[1]}55 30%, ${colors[1]}22 45%, ${colors[2]}44 55%, ${darkBase} 75%)` };
        }
      
      case 'horizontal':
        if (colors.length === 1) {
          return { background: `linear-gradient(90deg, ${colors[0]}88 0%, ${colors[0]}44 40%, ${darkBase} 100%)` };
        } else if (colors.length === 2) {
          return { background: `linear-gradient(90deg, ${colors[0]}88 0%, ${colors[0]}44 25%, ${colors[1]}55 50%, ${darkBase} 100%)` };
        } else {
          return { background: `linear-gradient(90deg, ${colors[0]}77 0%, ${colors[0]}33 15%, ${colors[1]}55 35%, ${colors[1]}22 50%, ${colors[2]}44 70%, ${darkBase} 100%)` };
        }
      
      case 'vertical':
        if (colors.length === 1) {
          return { background: `linear-gradient(180deg, ${colors[0]}88 0%, ${colors[0]}44 30%, ${darkBase} 70%)` };
        } else if (colors.length === 2) {
          return { background: `linear-gradient(180deg, ${colors[0]}88 0%, ${colors[0]}44 25%, ${colors[1]}55 50%, ${darkBase} 80%)` };
        } else {
          return { background: `linear-gradient(180deg, ${colors[0]}77 0%, ${colors[0]}33 15%, ${colors[1]}55 35%, ${colors[1]}22 50%, ${colors[2]}44 65%, ${darkBase} 85%)` };
        }
      
      default: // 'radial'
        if (colors.length === 1) {
          return { background: `radial-gradient(ellipse 180% 120% at 20% 10%, ${colors[0]}88 0%, ${colors[0]}44 25%, ${darkBase} 65%)` };
        } else if (colors.length === 2) {
          return { background: `radial-gradient(ellipse 180% 120% at 20% 10%, ${colors[0]}88 0%, ${colors[0]}44 20%, ${colors[1]}55 40%, ${darkBase} 70%)` };
        } else {
          return { background: `radial-gradient(ellipse 200% 150% at 15% 5%, ${colors[0]}77 0%, ${colors[0]}33 15%, ${colors[1]}55 30%, ${colors[1]}22 45%, ${colors[2]}44 55%, ${darkBase} 75%)` };
        }
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "Unknown";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen overflow-auto">
      <div 
        className="relative pb-8 pt-6 px-4 md:px-8"
        style={generateGradient()}
      >
        {/* Glassmorphism overlay with blur for text contrast */}
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />
        
        {/* Content Layer */}
        <div className="relative z-10">
          <div className="max-w-7xl mx-auto mb-6">
          <Button variant="ghost" onClick={() => setLocation("/")} className="text-white hover:bg-white/10" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover Image */}
            <div className="flex-shrink-0">
              <div className="w-48 md:w-64 lg:w-72 aspect-[2/3] bg-black/20 rounded-2xl overflow-hidden shadow-2xl relative group">
                {audiobook.coverUrl ? (
                  <>
                    <img
                      src={audiobook.coverUrl}
                      alt={audiobook.title}
                      className="w-full h-full object-cover"
                    />
                    {/* Change cover button - appears on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowCoverModal(true)}
                        className="gap-2"
                        data-testid="button-change-cover"
                      >
                        <Image className="h-4 w-4" />
                        Change Cover
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                    <Headphones className="h-24 w-24 text-white/40" />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowCoverModal(true)}
                      className="gap-2"
                      data-testid="button-find-cover"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Find Cover
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 text-white">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2" data-testid="text-title">
                {audiobook.title}
              </h1>
              
              {audiobook.author && (
                <p className="text-xl md:text-2xl text-white/90 mb-4" data-testid="text-author">
                  {audiobook.author}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
                {audiobook.narrator && (
                  <div className="flex items-start gap-2">
                    <Headphones className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Narrator</div>
                      <div className="text-white">{audiobook.narrator}</div>
                    </div>
                  </div>
                )}

                {audiobook.publisher && (
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Publisher</div>
                      <div className="text-white">{audiobook.publisher}</div>
                    </div>
                  </div>
                )}

                {audiobook.publishedDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Publication</div>
                      <div className="text-white">{audiobook.publishedDate}</div>
                    </div>
                  </div>
                )}

                {audiobook.series && (
                  <div className="flex items-start gap-2">
                    <BookMarked className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Series</div>
                      <div className="text-white">{audiobook.series}</div>
                    </div>
                  </div>
                )}

                {audiobook.duration && (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/70" />
                    <div>
                      <div className="text-white/70 text-xs mb-1">Duration</div>
                      <div className="text-white">{formatDuration(audiobook.duration)}</div>
                    </div>
                  </div>
                )}
              </div>

              {audiobookTags.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-white/70" />
                    <span className="text-white/70 text-xs">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {audiobookTags.map((tag, idx) => (
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
              )}

              {hasProgress && (
                <div className="mt-6 bg-black/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-white/70">Your Progress</span>
                    <span className="text-white font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-white/10" />
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Button 
                  size="lg" 
                  onClick={handleListen}
                  data-testid="button-listen"
                >
                  <Headphones className="h-5 w-5 mr-2" />
                  {hasProgress ? "Continue Listening" : "Start Listening"}
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={() => setLocation(`/car-mode/${audiobookId}`)}
                  data-testid="button-car-mode"
                >
                  <Car className="h-5 w-5 mr-2" />
                  Car Mode
                </Button>
                {deliveryConfig?.configured && (
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => setShowSendModal(true)}
                    data-testid="button-send-audiobook"
                  >
                    <Send className="h-5 w-5 mr-2" />
                    Send to Device
                  </Button>
                )}
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={handleOpenEditDialog}
                  data-testid="button-edit-metadata"
                >
                  <Pencil className="h-5 w-5 mr-2" />
                  Edit Metadata
                </Button>
                {isAdmin && (
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="bg-red-500/20 border-red-500/50 text-white hover:bg-red-500/30"
                    onClick={() => setShowDeleteDialog(true)}
                    data-testid="button-delete-audiobook"
                  >
                    <Trash2 className="h-5 w-5 mr-2" />
                    Delete Audiobook
                  </Button>
                )}
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={() => setShowCollectionDialog(true)}
                  data-testid="button-add-to-collection"
                >
                  <FolderPlus className="h-5 w-5 mr-2" />
                  Add to Collection
                </Button>
                {!audiobook.series && (
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => fetchSeriesMutation.mutate()}
                    disabled={fetchSeriesMutation.isPending}
                    data-testid="button-fetch-series"
                  >
                    {fetchSeriesMutation.isPending ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-5 w-5 mr-2" />
                    )}
                    {fetchSeriesMutation.isPending ? "Finding Series..." : "Find Series Info"}
                  </Button>
                )}
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={() => setShowSimilarBooksModal(true)}
                  data-testid="button-more-like-this"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  More Like This
                </Button>
              </div>
              
              {/* Send to Device Modal */}
              {audiobookId && (
                <SendToDeviceModal
                  isOpen={showSendModal}
                  onClose={() => setShowSendModal(false)}
                  bookId={audiobookId}
                  bookTitle={audiobook.title}
                />
              )}

              {/* Cover Picker Modal */}
              <CoverPickerModal
                open={showCoverModal}
                onOpenChange={setShowCoverModal}
                itemId={audiobookId!}
                itemType="audiobook"
                itemTitle={audiobook.title}
                currentCover={audiobook.coverUrl}
                onCoverUpdated={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/audiobooks", audiobookId] });
                  queryClient.invalidateQueries({ queryKey: ["/api/audiobooks"] });
                }}
              />

              {/* More Like This Modal */}
              <MoreLikeThisModal
                open={showSimilarBooksModal}
                onOpenChange={setShowSimilarBooksModal}
                title={audiobook.title}
                author={audiobook.author || undefined}
                subjects={audiobookTags}
                isbn={audiobook.isbn || undefined}
              />

              {/* Add to Collection Dialog */}
              <Dialog open={showCollectionDialog} onOpenChange={setShowCollectionDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add to Collection</DialogTitle>
                    <DialogDescription>
                      Select a collection to add "{audiobook.title}" to.
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
                        No collections found. Create a collection first from the Collections page.
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCollectionDialog(false)} data-testid="button-cancel-collection">
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => selectedCollection && addToCollectionMutation.mutate(selectedCollection)}
                      disabled={!selectedCollection || addToCollectionMutation.isPending}
                      data-testid="button-confirm-add-to-collection"
                    >
                      {addToCollectionMutation.isPending ? "Adding..." : "Add to Collection"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Edit Metadata Dialog */}
              <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Audiobook Metadata</DialogTitle>
                    <DialogDescription>
                      Update the information for this audiobook.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-title">Title *</Label>
                      <Input
                        id="edit-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Audiobook title"
                        data-testid="input-edit-title"
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="edit-author">Author</Label>
                      <Input
                        id="edit-author"
                        value={editAuthor}
                        onChange={(e) => setEditAuthor(e.target.value)}
                        placeholder="Author name"
                        data-testid="input-edit-author"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="edit-narrator">Narrator</Label>
                      <Input
                        id="edit-narrator"
                        value={editNarrator}
                        onChange={(e) => setEditNarrator(e.target.value)}
                        placeholder="Narrator name"
                        data-testid="input-edit-narrator"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Audiobook description"
                        className="min-h-[100px]"
                        data-testid="textarea-edit-description"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-series">Series</Label>
                        <Input
                          id="edit-series"
                          value={editSeries}
                          onChange={(e) => setEditSeries(e.target.value)}
                          placeholder="Series name"
                          data-testid="input-edit-series"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-series-index">Series Index</Label>
                        <Input
                          id="edit-series-index"
                          type="number"
                          step="0.1"
                          value={editSeriesIndex}
                          onChange={(e) => setEditSeriesIndex(e.target.value)}
                          placeholder="e.g., 1, 2, 2.5"
                          data-testid="input-edit-series-index"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-publisher">Publisher</Label>
                        <Input
                          id="edit-publisher"
                          value={editPublisher}
                          onChange={(e) => setEditPublisher(e.target.value)}
                          placeholder="Publisher name"
                          data-testid="input-edit-publisher"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-published-date">Published Date</Label>
                        <Input
                          id="edit-published-date"
                          value={editPublishedDate}
                          onChange={(e) => setEditPublishedDate(e.target.value)}
                          placeholder="e.g., 2023-01-15"
                          data-testid="input-edit-published-date"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-isbn">ISBN</Label>
                        <div className="flex gap-2">
                          <Input
                            id="edit-isbn"
                            value={editIsbn}
                            onChange={(e) => setEditIsbn(e.target.value)}
                            placeholder="ISBN number"
                            data-testid="input-edit-isbn"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleIsbnLookup}
                            disabled={isLookingUp || !editIsbn.trim()}
                            data-testid="button-isbn-lookup"
                          >
                            {isLookingUp ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Enter ISBN and click search to auto-fill metadata
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-language">Language</Label>
                        <Input
                          id="edit-language"
                          value={editLanguage}
                          onChange={(e) => setEditLanguage(e.target.value)}
                          placeholder="e.g., English"
                          data-testid="input-edit-language"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="edit-tags">Tags</Label>
                      <Input
                        id="edit-tags"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="Comma-separated tags (e.g., Fiction, Mystery, Thriller)"
                        data-testid="input-edit-tags"
                      />
                      <p className="text-xs text-muted-foreground">
                        Separate multiple tags with commas
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-cancel-edit">
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveMetadata}
                      disabled={updateAudiobookMutation.isPending}
                      data-testid="button-save-metadata"
                    >
                      {updateAudiobookMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Confirmation Dialog */}
              {audiobook && (
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Audiobook</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete "{audiobook.title}"? This action cannot be undone. The audiobook file and all associated data (progress, bookmarks) will be permanently removed.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowDeleteDialog(false)} data-testid="button-cancel-delete">
                        Cancel
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => deleteAudiobookMutation.mutate()}
                        disabled={deleteAudiobookMutation.isPending}
                        data-testid="button-confirm-delete"
                      >
                        {deleteAudiobookMutation.isPending ? "Deleting..." : "Delete Audiobook"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-4">
            <TabsTrigger 
              value="details" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              data-testid="tab-details"
            >
              Details
            </TabsTrigger>
            <TabsTrigger 
              value="rating" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              data-testid="tab-rating"
            >
              Rating & Review
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6">
            {audiobook.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Description</h3>
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed [&_p]:mb-4 [&_strong]:font-semibold [&_em]:italic"
                  dangerouslySetInnerHTML={{ __html: sanitizeDescription(audiobook.description) }}
                />
              </div>
            )}

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Format</h4>
                <p className="text-base">{audiobook.format}</p>
              </div>

              {audiobook.language && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Language</h4>
                  <p className="text-base">{audiobook.language}</p>
                </div>
              )}

              {audiobook.isbn && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">ISBN</h4>
                  <p className="text-base">{audiobook.isbn}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rating" className="mt-6">
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-semibold mb-3">Your Rating</h3>
                <div className="flex items-center gap-4">
                  <StarRating 
                    rating={rating} 
                    onRatingChange={handleRatingChange}
                    size="lg"
                    data-testid="star-rating"
                  />
                  {rating > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {rating} {rating === 1 ? "star" : "stars"}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Your Review</h3>
                <Textarea
                  placeholder="Write your thoughts about this audiobook..."
                  value={review}
                  onChange={handleReviewChange}
                  className="min-h-[120px]"
                  data-testid="textarea-review"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveRating}
                  disabled={!hasChanges || rating === 0 || saveRatingMutation.isPending}
                  data-testid="button-save-rating"
                >
                  {saveRatingMutation.isPending ? "Saving..." : "Save Rating & Review"}
                </Button>
                {hasChanges && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRating(existingRating?.rating || 0);
                      setReview(existingRating?.review || "");
                      setHasChanges(false);
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
