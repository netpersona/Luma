import { useEffect, useRef, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Settings, ChevronLeft, ChevronRight, Minus, Plus, Sun, Moon, Highlighter, BookmarkPlus, StickyNote, Trash2, Edit, Bookmark, Search, Volume2, Play, Pause, Square, Settings2 } from "lucide-react";
import { useSwipe } from "@/hooks/use-swipe";
import ePub, { type Book, type Rendition } from "epubjs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BookWithProgress, ReaderPreferences, Highlight, Annotation, Bookmark as BookmarkType } from "@shared/schema";

// Helper function to get highlight color
const getHighlightColor = (color: string): string => {
  const colors: Record<string, string> = {
    yellow: '#ffeb3b',
    green: '#4caf50',
    blue: '#2196f3',
    pink: '#e91e63',
    orange: '#ff9800',
  };
  return colors[color] || colors.yellow;
};

// Shared helper for cottagecore theme colors
const getThemeColors = (themeName: string): { bg: string; text: string } => {
  switch (themeName) {
    case 'dark': return { bg: '#1a1612', text: '#f5ece0' }; // Warm dark - fireplace embers
    case 'sepia': return { bg: '#f5f0e8', text: '#4a3b2e' }; // Warm cream - cottage paper
    case 'parchment': return { bg: '#faf6ee', text: '#3d2f1f' }; // Aged parchment
    case 'fireside': return { bg: '#2d2418', text: '#f0ddc8' }; // Deep warm - by the fire
    default: return { bg: '#f9f5ee', text: '#2d2418' }; // Warm light - cream linen
  }
};

export default function EpubReader() {
  const [, params] = useRoute("/reader/epub/:id");
  const [, setLocation] = useLocation();
  const bookId = params?.id;
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookInstanceRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const currentLocationRef = useRef<string>("");
  const currentProgressRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for highlights - must be declared before useEffect that uses them
  const highlightsRef = useRef<Highlight[]>([]);
  const annotationsRef = useRef<Annotation[]>([]);
  
  // Reader preferences state
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('serif');
  const [lineHeight, setLineHeight] = useState(1.6);
  const [theme, setTheme] = useState('light');
  const [brightness, setBrightness] = useState(100);
  const [progress, setProgress] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<string>("");
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Highlights and annotations state
  const [selectedText, setSelectedText] = useState("");
  const [selectedCfiRange, setSelectedCfiRange] = useState("");
  const [showHighlightDialog, setShowHighlightDialog] = useState(false);
  const [highlightColor, setHighlightColor] = useState("yellow");
  const [annotationText, setAnnotationText] = useState("");
  const [showAnnotationsPanel, setShowAnnotationsPanel] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<{highlightId: string; annotationId?: string; text: string} | null>(null);
  
  // Bookmarks state
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);
  
  // Search state
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Dictionary state
  const [showDictionaryDialog, setShowDictionaryDialog] = useState(false);
  const [selectedWord, setSelectedWord] = useState("");
  const [dictionaryData, setDictionaryData] = useState<any>(null);
  const [isLoadingDictionary, setIsLoadingDictionary] = useState(false);

  // Text-to-Speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Epub loading error state
  const [epubLoadError, setEpubLoadError] = useState<string | null>(null);
  
  // Fullscreen mode (hide header/footer for immersive reading)
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Highlight mode - when active, navigation zones are disabled and text selection/highlighting is enabled
  const [highlightMode, setHighlightMode] = useState(false);
  const highlightModeRef = useRef(false);
  
  // Quick color picker state - shows when text is selected
  const [showQuickColorPicker, setShowQuickColorPicker] = useState(false);
  const [hasActiveSelection, setHasActiveSelection] = useState(false);
  
  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    highlightModeRef.current = highlightMode;
    // Hide color picker when exiting highlight mode
    if (!highlightMode) {
      setShowQuickColorPicker(false);
      setHasActiveSelection(false);
    }
  }, [highlightMode]);
  
  // Track latest preferences in ref to avoid stale closures
  const preferencesRef = useRef({
    fontSize,
    fontFamily,
    lineHeight,
    theme,
    brightness,
  });

  // Update ref whenever preferences change
  useEffect(() => {
    preferencesRef.current = {
      fontSize,
      fontFamily,
      lineHeight,
      theme,
      brightness,
    };
  }, [fontSize, fontFamily, lineHeight, theme, brightness]);

  const { data: book, isLoading, error } = useQuery<BookWithProgress>({
    queryKey: ["/api/books", bookId],
    enabled: !!bookId,
  });

  // Load reader preferences
  const { data: readerPrefs, isSuccess, isError } = useQuery<ReaderPreferences>({
    queryKey: ["/api/reader-preferences"],
  });

  // Initialize preferences when loaded successfully (only on success, not on error)
  // Only run once on initial load to prevent infinite loops
  useEffect(() => {
    // Only hydrate once - skip if already hydrated
    if (isHydrated) return;
    
    if (isSuccess) {
      if (readerPrefs) {
        // Apply saved preferences
        setFontSize(readerPrefs.fontSize);
        setFontFamily(readerPrefs.fontFamily);
        setLineHeight(readerPrefs.lineHeight);
        setTheme(readerPrefs.theme);
        setBrightness(readerPrefs.brightness || 100);
      }
      // Mark as hydrated only after successful query (whether prefs exist or not)
      // This prevents overwriting existing data during network/server errors
      setIsHydrated(true);
    }
  }, [readerPrefs, isSuccess, isHydrated]);

  const updateProgressMutation = useMutation({
    mutationFn: async (data: { bookId: string; lastPosition: string; progress: number }) => {
      return apiRequest("PUT", "/api/reading-progress", data);
    },
  });

  const savePreferencesMutation = useMutation({
    mutationFn: async (prefs: Partial<ReaderPreferences>) => {
      return apiRequest("POST", "/api/reader-preferences", prefs);
    },
    // NOTE: Do NOT invalidate the query here - we already have the latest state locally.
    // Invalidating would cause a refetch, triggering the preferences loading effect,
    // which could create an infinite loop of save -> refetch -> load -> save.
  });

  // Fetch highlights for this book
  const { data: highlights = [] } = useQuery<Highlight[]>({
    queryKey: [`/api/books/${bookId}/highlights`],
    enabled: !!bookId,
  });

  // Fetch all annotations for all highlights
  const { data: annotations = [] } = useQuery<Annotation[]>({
    queryKey: [`/api/books/${bookId}/annotations`],
    enabled: !!bookId && highlights.length > 0,
  });

  // Create highlight mutation
  const createHighlightMutation = useMutation({
    mutationFn: async (data: { bookId: string; cfiRange: string; selectedText: string; color: string }) => {
      return apiRequest("POST", "/api/highlights", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/books/${bookId}/highlights`] });
    },
  });

  // Delete highlight mutation
  const deleteHighlightMutation = useMutation({
    mutationFn: async (highlightId: string) => {
      return apiRequest("DELETE", `/api/highlights/${highlightId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/books/${bookId}/highlights`] });
      queryClient.invalidateQueries({ queryKey: [`/api/books/${bookId}/annotations`] });
    },
  });

  // Create/update annotation mutation
  const saveAnnotationMutation = useMutation({
    mutationFn: async (data: { highlightId: string; note: string; annotationId?: string }) => {
      if (data.annotationId) {
        return apiRequest("PATCH", `/api/annotations/${data.annotationId}`, { note: data.note });
      }
      return apiRequest("POST", "/api/annotations", { highlightId: data.highlightId, note: data.note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/books/${bookId}/annotations`] });
    },
  });

  // Delete annotation mutation
  const deleteAnnotationMutation = useMutation({
    mutationFn: async (annotationId: string) => {
      return apiRequest("DELETE", `/api/annotations/${annotationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/books/${bookId}/annotations`] });
    },
  });

  // Fetch bookmarks for this book
  const { data: bookmarks = [] } = useQuery<BookmarkType[]>({
    queryKey: [`/api/bookmarks/book/${bookId}`],
    enabled: !!bookId,
  });

  // Create bookmark mutation
  const createBookmarkMutation = useMutation({
    mutationFn: async (data: { itemId: string; itemType: string; position: string; note?: string }) => {
      return apiRequest("POST", "/api/bookmarks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bookmarks/book/${bookId}`] });
    },
  });

  // Delete bookmark mutation
  const deleteBookmarkMutation = useMutation({
    mutationFn: async (bookmarkId: string) => {
      return apiRequest("DELETE", `/api/bookmarks/${bookmarkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bookmarks/book/${bookId}`] });
    },
  });

  // Ref to hold mutation function to avoid dependency issues
  const savePreferencesMutationRef = useRef(savePreferencesMutation);
  useEffect(() => {
    savePreferencesMutationRef.current = savePreferencesMutation;
  }, [savePreferencesMutation]);

  // Helper function to save current preferences from ref
  // Note: We use a ref for the mutation to avoid infinite loops caused by
  // useCallback recreating when mutation reference changes
  const saveCurrentPreferences = useCallback(() => {
    const current = preferencesRef.current;
    const themeColors = getThemeColors(current.theme);
    const linkColor = current.theme === 'dark' ? '#60a5fa' : '#0066cc';
    
    savePreferencesMutationRef.current.mutate({
      userId: 'default',
      fontSize: current.fontSize,
      fontFamily: current.fontFamily,
      lineHeight: current.lineHeight,
      theme: current.theme,
      backgroundColor: themeColors.bg,
      textColor: themeColors.text,
      linkColor,
      brightness: current.brightness,
    });
  }, []); // Empty dependency array - uses refs for all mutable values

  // Debounced save when preferences change (only after hydration)
  useEffect(() => {
    if (!isHydrated) return;

    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveCurrentPreferences();
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [fontSize, fontFamily, lineHeight, theme, brightness, saveCurrentPreferences, isHydrated]);

  // Save on component unmount to ensure no data loss (only if hydrated)
  useEffect(() => {
    return () => {
      if (!isHydrated) return;
      
      // Flush any pending timeout and save immediately
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveCurrentPreferences();
    };
  }, [saveCurrentPreferences, isHydrated]);

  useEffect(() => {
    if (!book || !viewerRef.current) return;

    // Reset error state when book changes
    setEpubLoadError(null);
    
    const container = viewerRef.current;
    container.innerHTML = "";

    let bookInstance: Book | null = null;
    let rendition: Rendition | null = null;
    let isDestroyed = false;
    
    // Verify file path is valid before attempting to load
    if (!book.filePath) {
      setEpubLoadError("Book file path is missing");
      return;
    }
    
    try {
      bookInstance = ePub(book.filePath);
      bookInstanceRef.current = bookInstance;
      
      // Add error handler for book loading failures (e.g., 404 errors)
      bookInstance.loaded.spine.catch((err: Error) => {
        if (!isDestroyed) {
          console.error("Failed to load book spine:", err);
          setEpubLoadError(`Failed to load book file: The file may not exist or is corrupted.`);
        }
      });
      
      bookInstance.loaded.metadata.catch((err: Error) => {
        if (!isDestroyed) {
          console.error("Failed to load book metadata:", err);
        }
      });

      rendition = bookInstance.renderTo(container, {
        width: "100%",
        height: "100%",
        spread: "none",
        flow: "paginated",
        manager: "default",
      });
      renditionRef.current = rendition;

      // Apply theme styles
      const getFontFamilyCSS = (family: string) => {
        switch (family) {
          case 'serif': return 'Lora, Georgia, serif';
          case 'sans-serif': return 'Inter, system-ui, sans-serif';
          case 'monospace': return 'JetBrains Mono, Courier, monospace';
          case 'OpenDyslexic': return 'OpenDyslexic, sans-serif';
          default: return 'Lora, Georgia, serif';
        }
      };

      const themeColors = getThemeColors(theme);

      // Inject OpenDyslexic font into epub iframe via CSS
      const openDyslexicFontCSS = `
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Regular.woff') format('woff');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Bold.woff') format('woff');
          font-weight: bold;
          font-style: normal;
        }
        @font-face {
          font-family: 'OpenDyslexic';
          src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Italic.woff') format('woff');
          font-weight: normal;
          font-style: italic;
        }
      `;

      // Register font injection hook for each rendered section
      rendition.hooks.content.register((contents: any) => {
        const doc = contents.document;
        if (doc) {
          const style = doc.createElement('style');
          // Inject fonts
          style.textContent = `
            ${openDyslexicFontCSS}
          `;
          doc.head.appendChild(style);
        }
      });

      rendition.themes.default({
        body: {
          "font-family": `${getFontFamilyCSS(fontFamily)} !important`,
          "font-size": `${fontSize}px !important`,
          "line-height": `${lineHeight} !important`,
          "color": `${themeColors.text} !important`,
          "background": `${themeColors.bg} !important`,
          "filter": `brightness(${brightness}%)`,
          "overflow-wrap": "break-word !important",
          "word-wrap": "break-word !important",
          "max-width": "100% !important",
          "padding": "20px !important",
          "box-sizing": "border-box !important",
        },
        "p": {
          "margin": "0.5em 0 !important",
          "overflow-wrap": "break-word !important",
          "word-wrap": "break-word !important",
        },
        "a": {
          "color": theme === 'dark' ? '#60a5fa' : '#0066cc',
        },
        "*": {
          "max-width": "100% !important",
          "box-sizing": "border-box !important",
        },
        "::selection": {
          "background": "rgba(255, 255, 0, 0.3)",
        },
        ".epubjs-hl": {
          "fill": "yellow",
          "fill-opacity": "0.3",
          "mix-blend-mode": "multiply",
        },
      });

      let startLocation: string | undefined;
      try {
        if (book.progress?.lastPosition) {
          const parsed = JSON.parse(book.progress.lastPosition);
          startLocation = parsed.cfi;
        }
      } catch (error) {
        console.error("Failed to parse lastPosition:", error);
        startLocation = undefined;
      }

      // Wait for book to be ready before displaying to ensure proper pagination
      bookInstance.ready.then(() => {
        if (isDestroyed || !rendition) return;
        
        // Log the book's flow metadata for debugging
        console.log("Book flow metadata:", (bookInstance.package?.metadata as any)?.flow);
        
        return rendition.display(startLocation);
      }).then(() => {
        if (isDestroyed) return;
        if (book.progress?.progress) {
          setProgress(book.progress.progress);
        }
      }).catch((err: Error) => {
        console.error("Failed to display epub:", err);
        if (!isDestroyed) {
          setEpubLoadError(`Failed to render book: ${err.message || "Unknown error"}`);
        }
      });

      // Generate locations for accurate progress percentage tracking
      // This is required for epub.js to calculate location.start.percentage
      bookInstance.ready.then(() => {
        if (isDestroyed || !bookInstance) return;
        // Generate locations with ~1000 chars per location for reasonable granularity
        return bookInstance.locations.generate(1024);
      }).then(() => {
        if (isDestroyed) return;
        console.log("EPUB locations generated for progress tracking");
      }).catch((err: Error) => {
        console.warn("Failed to generate book locations:", err);
        // Non-fatal - progress tracking will use fallback
      });

      // Track which documents have listeners to avoid duplicates
      const docsWithListeners = new WeakSet<Document>();
      
      // Store current contents reference for mouseup handler
      let currentContents: any = null;
      
      // Add event listeners for text selection, dictionary lookup, and click navigation
      rendition.on("rendered", (section: any, view: any) => {
        if (!rendition) return;
        
        // Get the current contents object that has cfiFromRange method
        const allContents = rendition.getContents() as any;
        currentContents = allContents[0];
        
        if (currentContents && currentContents.document) {
          const doc = currentContents.document;
          const win = currentContents.window;
          
          // Skip if we already added listeners to this document
          if (docsWithListeners.has(doc)) {
            return;
          }
          docsWithListeners.add(doc);
          
          // Handle text selection for highlighting - store selection on mouseup for later use
          doc.addEventListener('mouseup', (e: MouseEvent) => {
            // Only process if highlight mode is active
            if (!highlightModeRef.current) {
              return;
            }
            
            // Small delay to ensure selection is complete
            setTimeout(() => {
              // Get current contents from rendition
              const contents = rendition?.getContents?.() as any;
              const currentContent = contents?.[0];
              if (!currentContent) return;
              
              const currentWin = currentContent.window;
              if (!currentWin) return;
              
              const selection = currentWin.getSelection();
              const text = selection?.toString().trim();
              
              if (text && text.length > 0) {
                try {
                  const range = selection.getRangeAt(0);
                  const cfiRange = currentContent.cfiFromRange(range);
                  
                  if (cfiRange) {
                    // Store the selection for when user clicks capture button
                    pendingSelectionRef.current = { text, cfiRange };
                    console.log('[Highlight] Selection stored:', text.substring(0, 50) + '...');
                  }
                } catch (e) {
                  console.warn('Failed to get CFI range:', e);
                }
              }
            }, 50);
          });
          
          // Also listen for selectionchange to continuously track selection and show color picker
          // Use 'win' directly since that's the window where the document lives
          doc.addEventListener('selectionchange', () => {
            console.log('[Highlight] selectionchange fired, highlightModeRef:', highlightModeRef.current);
            if (!highlightModeRef.current) return;
            
            // Get selection directly from 'win' which is the iframe's window
            const selection = win.getSelection();
            const text = selection?.toString().trim();
            console.log('[Highlight] Selection text from win:', text?.substring(0, 30));
            
            if (text && text.length > 0) {
              try {
                const range = selection.getRangeAt(0);
                // Use currentContents from the closure to get CFI
                const cfiRange = currentContents?.cfiFromRange?.(range);
                console.log('[Highlight] Got CFI range:', !!cfiRange);
                
                if (cfiRange) {
                  pendingSelectionRef.current = { text, cfiRange };
                  // Show the quick color picker
                  setHasActiveSelection(true);
                  setShowQuickColorPicker(true);
                  console.log('[Highlight] Showing quick color picker');
                }
              } catch (e) {
                console.log('[Highlight] Error getting CFI:', e);
              }
            } else {
              // No text selected - hide color picker after a short delay
              setTimeout(() => {
                const currentSel = win.getSelection();
                if (!currentSel || !currentSel.toString().trim()) {
                  setHasActiveSelection(false);
                }
              }, 200);
            }
          });
          
          // Double-click for dictionary lookup
          doc.addEventListener('dblclick', (e: any) => {
            const selection = win.getSelection();
            const word = selection?.toString().trim();
            
            // Check if it's a single word (no spaces)
            if (word && !word.includes(' ')) {
              handleDictionaryLookup(word);
            }
          });
          
          // Click navigation - left/right/center zones
          doc.addEventListener('click', (e: any) => {
            // Don't trigger navigation if highlight mode is active
            // Don't clear selection here - let the mouseup handler process it first
            if (highlightModeRef.current) {
              return;
            }
            
            const selection = win.getSelection();
            
            // Don't trigger navigation if text is selected - also clear it for next click
            if (selection && selection.toString().trim().length > 0) {
              // Clear the selection so the next click works
              selection.removeAllRanges();
              return;
            }
            
            // Don't trigger navigation if clicking on a link or input
            const target = e.target as HTMLElement;
            if (target.tagName === 'A' || target.tagName === 'INPUT' || target.tagName === 'BUTTON' ||
                target.closest('a') || target.closest('input') || target.closest('button')) {
              return;
            }
            
            // Calculate click position relative to viewport
            const viewerContainer = viewerRef.current;
            if (!viewerContainer) return;
            
            const rect = viewerContainer.getBoundingClientRect();
            const x = e.clientX;
            const clickPosition = (x - rect.left) / rect.width;
            
            // Left third: previous page
            if (clickPosition < 0.33) {
              prevPage();
            }
            // Right third: next page
            else if (clickPosition > 0.67) {
              nextPage();
            }
            // Center third: toggle fullscreen mode
            else {
              setIsFullscreen((prev: boolean) => !prev);
            }
          });
        }
        
        // Apply highlights after section is rendered - this is critical for epub.js
        // Highlights must be applied AFTER the section DOM is ready
        setTimeout(() => {
          const currentHighlights = highlightsRef.current;
          if (!rendition || !currentHighlights.length) return;
          
          console.log('[Rendered Event] Applying', currentHighlights.length, 'highlights to section');
          
          currentHighlights.forEach((highlight: any) => {
            if (!highlight.cfiRange || typeof highlight.cfiRange !== 'string') return;
            
            try {
              // Remove existing highlight first to prevent stacking
              rendition.annotations.remove(highlight.cfiRange, 'highlight');
              
              // Then add the highlight fresh
              rendition.annotations.highlight(
                highlight.cfiRange,
                {},
                () => {}, // Click handler
                `highlight-${highlight.color}`,
                {
                  fill: getHighlightColor(highlight.color),
                  "fill-opacity": "0.3",
                  "mix-blend-mode": "multiply"
                }
              );
            } catch (e) {
              // Silently ignore - CFI may be for a different section
            }
          });
        }, 50);
      });

      // Use the official epub.js selected event for highlighting
      // This provides a properly formatted CFI that works reliably
      rendition.on("selected", (cfiRange: string, contents: any) => {
        console.log('[epub.js selected] Got CFI:', cfiRange);
        
        // Only process if highlight mode is active
        if (!highlightModeRef.current) {
          console.log('[epub.js selected] Highlight mode not active, skipping');
          return;
        }
        
        // Get the selected text
        const selection = contents.window.getSelection();
        const text = selection?.toString().trim();
        
        if (text && text.length > 0 && cfiRange) {
          console.log('[epub.js selected] Text:', text.substring(0, 50));
          
          // Store for the UI to use
          pendingSelectionRef.current = { text, cfiRange };
          setHasActiveSelection(true);
          setShowQuickColorPicker(true);
        }
      });

      rendition.on("relocated", (location: any) => {
        const percent = Math.round((location.start.percentage || 0) * 100);
        const cfi = location.start.cfi;
        
        currentLocationRef.current = cfi;
        currentProgressRef.current = percent;
        setProgress(percent);
        setCurrentLocation(cfi);

        if (bookId && cfi) {
          const progressData = {
            bookId,
            lastPosition: JSON.stringify({ cfi, progress: percent }),
            progress: percent,
          };
          updateProgressMutation.mutate(progressData);
        }
      });

    } catch (err: any) {
      console.error("Failed to initialize epub reader:", err);
      setEpubLoadError(`Failed to load book: ${err.message || "Unknown error"}`);
    }

    return () => {
      isDestroyed = true;
      if (rendition) {
        try {
          rendition.destroy();
        } catch (e) {
          console.error("Error destroying rendition:", e);
        }
      }
      if (bookInstance) {
        try {
          bookInstance.destroy();
        } catch (e) {
          console.error("Error destroying book instance:", e);
        }
      }
    };
  }, [book, bookId]);

  // Resize rendition when fullscreen mode changes
  useEffect(() => {
    if (!renditionRef.current) return;
    
    // Small delay to let the layout settle before resizing
    const timeoutId = setTimeout(() => {
      const rendition = renditionRef.current;
      // Check that rendition and its manager are fully initialized before resizing
      if (rendition && (rendition as any).manager) {
        try {
          rendition.resize(undefined as any, undefined as any);
        } catch (e) {
          console.warn('Failed to resize rendition:', e);
        }
      }
    }, 200);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isFullscreen]);

  // Keep highlights refs in sync with query data
  useEffect(() => {
    highlightsRef.current = highlights || [];
  }, [highlights]);
  
  useEffect(() => {
    annotationsRef.current = annotations || [];
  }, [annotations]);
  
  // Function to apply highlights to the current view
  const applyHighlights = useCallback(() => {
    const rendition = renditionRef.current;
    const currentHighlights = highlightsRef.current;
    
    if (!rendition || !currentHighlights.length) return;
    
    console.log('[Render Highlights] Applying', currentHighlights.length, 'highlights');
    
    currentHighlights.forEach((highlight) => {
      if (!highlight.cfiRange || typeof highlight.cfiRange !== 'string') return;
      
      try {
        rendition.annotations.highlight(
          highlight.cfiRange,
          {},
          (e: any) => {
            const annotation = annotationsRef.current.find(a => a.highlightId === highlight.id);
            if (annotation) {
              setEditingAnnotation({
                highlightId: highlight.id,
                annotationId: annotation.id,
                text: annotation.note,
              });
            }
          },
          `highlight-${highlight.color}`,
          {
            fill: getHighlightColor(highlight.color),
            "fill-opacity": "0.3",
            "mix-blend-mode": "multiply"
          }
        );
      } catch (e) {
        // Silently ignore - CFI may be for a different section
      }
    });
  }, []);
  
  // Re-apply highlights when highlights data changes (for newly created highlights)
  useEffect(() => {
    if (!renditionRef.current || !highlights?.length) return;
    
    // Small delay to ensure the view is ready
    const timeoutId = setTimeout(() => {
      applyHighlights();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [highlights, applyHighlights]);

  // Handle creating a highlight
  const handleCreateHighlight = () => {
    if (!bookId || !selectedCfiRange || !selectedText) return;
    
    const cfiToHighlight = selectedCfiRange;
    const colorToUse = highlightColor;
    
    // CRITICAL: Apply the highlight immediately while the CFI is still valid
    // This is how the official epub.js example does it
    if (renditionRef.current) {
      try {
        renditionRef.current.annotations.highlight(
          cfiToHighlight,
          {},
          () => {}, // Click handler
          `highlight-${colorToUse}`,
          {
            fill: getHighlightColor(colorToUse),
            "fill-opacity": "0.3",
            "mix-blend-mode": "multiply"
          }
        );
        console.log('[Highlight] Applied immediately:', cfiToHighlight.substring(0, 50));
      } catch (e) {
        console.warn('[Highlight] Failed to apply immediately:', e);
      }
    }
    
    // Save to database (this will also refresh the highlights list)
    createHighlightMutation.mutate({
      bookId,
      cfiRange: cfiToHighlight,
      selectedText,
      color: colorToUse,
    });
    
    setShowHighlightDialog(false);
    setSelectedText("");
    setSelectedCfiRange("");
    setAnnotationText("");
    
    // Turn off highlight mode and clear selection after creating highlight
    setHighlightMode(false);
    const contents = renditionRef.current?.getContents?.() as any;
    if (contents?.[0]) {
      const win = contents[0].window;
      win?.getSelection()?.removeAllRanges();
    }
  };

  // Handle creating highlight with annotation
  const handleCreateHighlightWithNote = async () => {
    if (!bookId || !selectedCfiRange || !selectedText) return;
    
    const cfiToHighlight = selectedCfiRange;
    const colorToUse = highlightColor;
    
    // CRITICAL: Apply the highlight immediately while the CFI is still valid
    if (renditionRef.current) {
      try {
        renditionRef.current.annotations.highlight(
          cfiToHighlight,
          {},
          () => {},
          `highlight-${colorToUse}`,
          {
            fill: getHighlightColor(colorToUse),
            "fill-opacity": "0.3",
            "mix-blend-mode": "multiply"
          }
        );
        console.log('[Highlight] Applied with note immediately:', cfiToHighlight.substring(0, 50));
      } catch (e) {
        console.warn('[Highlight] Failed to apply with note immediately:', e);
      }
    }
    
    try {
      const highlightData = {
        bookId,
        cfiRange: cfiToHighlight,
        selectedText,
        color: colorToUse,
      };
      
      // apiRequest returns a Response object, so we need to parse the JSON
      const response = await createHighlightMutation.mutateAsync(highlightData);
      const highlight = await (response as Response).json();
      
      if (annotationText.trim() && highlight && highlight.id) {
        await saveAnnotationMutation.mutateAsync({
          highlightId: highlight.id,
          note: annotationText,
        });
      }
      
      setShowHighlightDialog(false);
      setSelectedText("");
      setSelectedCfiRange("");
      setAnnotationText("");
      
      // Turn off highlight mode and clear selection after creating highlight
      setHighlightMode(false);
      const contents = renditionRef.current?.getContents?.() as any;
      if (contents?.[0]) {
        const win = contents[0].window;
        win?.getSelection()?.removeAllRanges();
      }
    } catch (error) {
      console.error('Failed to create highlight with note:', error);
    }
  };

  // Handle saving/updating annotation
  const handleSaveAnnotation = () => {
    if (!editingAnnotation) return;
    
    saveAnnotationMutation.mutate({
      highlightId: editingAnnotation.highlightId,
      note: editingAnnotation.text,
      annotationId: editingAnnotation.annotationId,
    });
    
    setEditingAnnotation(null);
  };

  // Handle creating a bookmark at current position
  const handleCreateBookmark = () => {
    if (!bookId || !currentLocationRef.current || !renditionRef.current) return;
    
    const cfi = currentLocationRef.current;
    const progress = currentProgressRef.current;
    
    createBookmarkMutation.mutate({
      itemId: bookId,
      itemType: 'book',
      position: JSON.stringify({ cfi, progress }),
      note: `${Math.round(progress)}% - Bookmarked`,
    });
  };

  // Store pending selection data (captured continuously as user selects)
  const pendingSelectionRef = useRef<{ text: string; cfiRange: string } | null>(null);
  
  // Quick highlight with a specific color - opens dialog with color pre-selected
  const handleQuickHighlight = (color: string) => {
    console.log('[Highlight] handleQuickHighlight called with color:', color);
    
    if (!pendingSelectionRef.current) {
      console.log('[Highlight] No pending selection for quick highlight');
      return;
    }
    
    const { text, cfiRange } = pendingSelectionRef.current;
    
    if (!text || !cfiRange) {
      console.log('[Highlight] Invalid pending selection');
      return;
    }
    
    // Set the state and open the dialog - this uses the same working code path
    setSelectedText(text);
    setSelectedCfiRange(cfiRange);
    setHighlightColor(color);
    setShowHighlightDialog(true);
    
    // Clear the quick picker state
    pendingSelectionRef.current = null;
    setShowQuickColorPicker(false);
    setHasActiveSelection(false);
  };
  
  // Manual capture of current text selection for highlighting
  const handleCaptureSelection = () => {
    // First try to use the stored pending selection
    if (pendingSelectionRef.current) {
      const { text, cfiRange } = pendingSelectionRef.current;
      if (text && cfiRange) {
        setSelectedText(text);
        setSelectedCfiRange(cfiRange);
        setShowHighlightDialog(true);
        pendingSelectionRef.current = null;
        return;
      }
    }
    
    // Fallback: try to capture current selection
    if (!renditionRef.current) return;
    
    try {
      const contents = renditionRef.current.getContents() as any;
      const currentContent = contents?.[0];
      if (!currentContent) {
        console.log('[Highlight] No content found');
        return;
      }
      
      const win = currentContent.window;
      if (!win) {
        console.log('[Highlight] No window found');
        return;
      }
      
      const selection = win.getSelection();
      const text = selection?.toString().trim();
      
      if (!text || text.length === 0) {
        console.log('[Highlight] No text selected - use pending selection if available');
        return;
      }
      
      const range = selection.getRangeAt(0);
      const cfiRange = currentContent.cfiFromRange(range);
      
      if (cfiRange) {
        setSelectedText(text);
        setSelectedCfiRange(cfiRange);
        setShowHighlightDialog(true);
      }
    } catch (e) {
      console.warn('Failed to capture selection:', e);
    }
  };

  // Handle search within the book using epub.js search API
  const handleSearch = async () => {
    if (!bookInstanceRef.current || !searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const results: any = await (bookInstanceRef.current as any).search(searchQuery);
      setSearchResults(results || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle dictionary lookup via backend proxy
  const handleDictionaryLookup = async (word: string) => {
    if (!word || word.trim().length === 0) return;
    
    const cleanWord = word.trim().toLowerCase();
    setSelectedWord(cleanWord);
    setShowDictionaryDialog(true);
    setIsLoadingDictionary(true);
    setDictionaryData(null);
    
    try {
      const response = await fetch(`/api/dictionary/${encodeURIComponent(cleanWord)}`);
      if (response.ok) {
        const data = await response.json();
        setDictionaryData(data);
      } else {
        setDictionaryData({ error: 'Word not found' });
      }
    } catch (error) {
      console.error('Dictionary lookup error:', error);
      setDictionaryData({ error: 'Failed to fetch definition' });
    } finally {
      setIsLoadingDictionary(false);
    }
  };

  // Initialize available voices for TTS
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      
      // Set default voice (prefer English voices)
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      setSelectedVoice(englishVoice || voices[0] || null);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // TTS: Start speaking current chapter
  const handleStartTTS = async () => {
    if (!renditionRef.current || !bookInstanceRef.current) return;

    try {
      // Get current chapter text
      const currentSection = renditionRef.current.location?.start?.href;
      if (!currentSection) return;

      // Get the section content
      const section = bookInstanceRef.current.spine.get(currentSection);
      await section.load(bookInstanceRef.current.load.bind(bookInstanceRef.current));
      
      const sectionContent = section.document?.body?.textContent || "";
      await section.unload();

      if (!sectionContent.trim()) return;

      // Stop any existing speech
      window.speechSynthesis.cancel();

      // Create new speech utterance
      const utterance = new SpeechSynthesisUtterance(sectionContent);
      utterance.rate = speechRate;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utterance.onerror = (error) => {
        console.error('TTS error:', error);
        setIsSpeaking(false);
        setIsPaused(false);
      };

      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to start TTS:', error);
    }
  };

  // TTS: Pause/Resume
  const handleTogglePauseTTS = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  // TTS: Stop speaking
  const handleStopTTS = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    speechSynthesisRef.current = null;
  };

  // TTS: Update speech rate
  const handleRateChange = (newRate: number) => {
    setSpeechRate(newRate);
    
    // If currently speaking, restart with new rate
    if (isSpeaking && speechSynthesisRef.current) {
      const wasPlaying = !isPaused;
      handleStopTTS();
      
      if (wasPlaying) {
        setTimeout(() => handleStartTTS(), 100);
      }
    }
  };

  const nextPage = useCallback(() => {
    if (renditionRef.current) {
      renditionRef.current.next();
    }
  }, []);

  const prevPage = useCallback(() => {
    if (renditionRef.current) {
      renditionRef.current.prev();
    }
  }, []);

  // Swipe gesture support for touch devices
  const { handlers: swipeHandlers } = useSwipe({
    onSwipeLeft: nextPage,
    onSwipeRight: prevPage,
  }, { threshold: 50 });

  const handleBackClick = () => {
    if (bookId && currentLocationRef.current) {
      const progressData = {
        bookId,
        lastPosition: JSON.stringify({ 
          cfi: currentLocationRef.current, 
          progress: currentProgressRef.current 
        }),
        progress: currentProgressRef.current,
      };
      fetch('/api/reading-progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressData),
        keepalive: true,
      }).catch(console.error);
    }
    setLocation(`/books/${bookId}`);
  };

  // Update theme when preferences change (real-time visual update)
  useEffect(() => {
    if (!renditionRef.current) return;

    const getFontFamilyCSS = (family: string) => {
      switch (family) {
        case 'serif': return 'Lora, Georgia, serif';
        case 'sans-serif': return 'Inter, system-ui, sans-serif';
        case 'monospace': return 'JetBrains Mono, Courier, monospace';
        case 'OpenDyslexic': return 'OpenDyslexic, sans-serif';
        default: return 'Lora, Georgia, serif';
      }
    };

    const themeColors = getThemeColors(theme);

    renditionRef.current.themes.default({
      body: {
        "font-family": `${getFontFamilyCSS(fontFamily)} !important`,
        "font-size": `${fontSize}px !important`,
        "line-height": `${lineHeight} !important`,
        "color": `${themeColors.text} !important`,
        "background": `${themeColors.bg} !important`,
        "filter": `brightness(${brightness}%)`,
      },
      "p": {
        "margin": "0.5em 0 !important",
      },
      "a": {
        "color": theme === 'dark' ? '#60a5fa' : '#0066cc',
      },
    });
  }, [fontSize, fontFamily, lineHeight, theme, brightness]);

  useEffect(() => {
    return () => {
      if (bookId && currentLocationRef.current) {
        const progressData = {
          bookId,
          lastPosition: JSON.stringify({ 
            cfi: currentLocationRef.current, 
            progress: currentProgressRef.current 
          }),
          progress: currentProgressRef.current,
        };
        fetch('/api/reading-progress', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(progressData),
          keepalive: true,
        }).catch(console.error);
      }
    };
  }, [bookId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading book...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-destructive">Failed to load book</p>
        <Button onClick={() => setLocation("/books")} data-testid="button-back-to-library">
          Back to Library
        </Button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">Book not found</p>
        <Button onClick={() => setLocation("/books")} data-testid="button-back-to-library">
          Back to Library
        </Button>
      </div>
    );
  }

  if (epubLoadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-6">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-xl font-semibold text-destructive">Unable to Open Book</h2>
          <p className="text-muted-foreground">
            There was a problem loading this book. The file may be corrupted or in an unsupported format.
          </p>
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
            {epubLoadError}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setLocation("/books")} data-testid="button-back-to-library">
              Back to Library
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setEpubLoadError(null);
                window.location.reload();
              }}
              data-testid="button-retry"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header - hidden in fullscreen mode */}
      {!isFullscreen && (
        <header className="flex items-center justify-between p-4 border-b bg-background z-10 shrink-0">
          <Button
            variant="ghost"
            onClick={handleBackClick}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="hidden md:block">
              {book.title}
            </Badge>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearchDialog(true)}
              data-testid="button-search"
              title="Search in book"
            >
              <Search className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCreateBookmark}
              data-testid="button-add-bookmark"
              title="Add Bookmark"
            >
              <BookmarkPlus className="h-5 w-5" />
            </Button>

            {/* Highlight Mode Toggle with Quick Color Picker */}
            <div className="relative">
              <Button
                variant={highlightMode ? "default" : "ghost"}
                size="icon"
                onClick={() => {
                  console.log('[Highlight] Button clicked, current highlightMode:', highlightMode);
                  if (!highlightMode) {
                    // Turn on highlight mode
                    setHighlightMode(true);
                    console.log('[Highlight] Turning ON highlight mode');
                  }
                }}
                data-testid="button-highlight-mode"
                title={highlightMode ? "Highlight Mode Active - Select text" : "Enable Highlight Mode"}
                className={highlightMode ? "ring-2 ring-primary ring-offset-2" : ""}
              >
                <Highlighter className="h-5 w-5" />
              </Button>
              
              {/* Quick Color Picker - appears when text is selected in highlight mode */}
              {highlightMode && showQuickColorPicker && hasActiveSelection && (
                <div 
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card border rounded-lg shadow-lg p-2 z-50"
                  data-testid="quick-color-picker"
                >
                  <div className="flex gap-1.5">
                    {[
                      { color: 'yellow', bg: 'bg-yellow-300', hoverBg: 'hover:bg-yellow-400' },
                      { color: 'green', bg: 'bg-green-300', hoverBg: 'hover:bg-green-400' },
                      { color: 'blue', bg: 'bg-blue-300', hoverBg: 'hover:bg-blue-400' },
                      { color: 'pink', bg: 'bg-pink-300', hoverBg: 'hover:bg-pink-400' },
                      { color: 'orange', bg: 'bg-orange-300', hoverBg: 'hover:bg-orange-400' },
                    ].map(({ color, bg, hoverBg }) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-6 h-6 rounded-full ${bg} ${hoverBg} transition-transform hover:scale-110 ring-2 ring-transparent hover:ring-foreground/20`}
                        onClick={() => handleQuickHighlight(color)}
                        data-testid={`quick-color-${color}`}
                        title={`Highlight ${color}`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground text-center mt-1.5">
                    Pick a color
                  </div>
                </div>
              )}
            </div>
            
            {/* Exit Highlight Mode button - only shown when in highlight mode */}
            {highlightMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setHighlightMode(false);
                  setShowQuickColorPicker(false);
                  setHasActiveSelection(false);
                  // Clear any existing selection when toggling off
                  const contents = renditionRef.current?.getContents?.() as any;
                  if (contents?.[0]) {
                    const win = contents[0].window;
                    win?.getSelection()?.removeAllRanges();
                  }
                }}
                data-testid="button-exit-highlight-mode"
                title="Exit Highlight Mode"
                className="text-xs"
              >
                Exit
              </Button>
            )}

            {/* TTS Controls */}
          {!isSpeaking ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStartTTS}
              data-testid="button-tts-play"
              title="Read Aloud"
            >
              <Volume2 className="h-5 w-5" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleTogglePauseTTS}
                data-testid="button-tts-pause"
                title={isPaused ? "Resume" : "Pause"}
              >
                {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStopTTS}
                data-testid="button-tts-stop"
                title="Stop"
              >
                <Square className="h-5 w-5" />
              </Button>
            </>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-tts-settings" title="TTS Settings">
                <Settings2 className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Speech Rate: {speechRate.toFixed(1)}x</Label>
                  <Slider
                    value={[speechRate]}
                    onValueChange={(values) => handleRateChange(values[0])}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    data-testid="slider-speech-rate"
                  />
                </div>
                
                {availableVoices.length > 0 && (
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select
                      value={selectedVoice?.name || ""}
                      onValueChange={(voiceName) => {
                        const voice = availableVoices.find(v => v.name === voiceName);
                        if (voice) setSelectedVoice(voice);
                      }}
                    >
                      <SelectTrigger data-testid="select-voice">
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices
                          .filter(v => v.lang.startsWith('en'))
                          .map((voice) => (
                            <SelectItem key={voice.name} value={voice.name}>
                              {voice.name} ({voice.lang})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Sheet open={showBookmarksPanel} onOpenChange={setShowBookmarksPanel}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-bookmarks">
                <Bookmark className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Bookmarks</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
                {bookmarks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No bookmarks yet</p>
                    <p className="text-sm mt-1">Click the bookmark button to save your current position</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookmarks.map((bookmark) => {
                      let position = '';
                      try {
                        const parsed = JSON.parse(bookmark.position);
                        position = `${Math.round(parsed.progress)}%`;
                      } catch {
                        position = 'Unknown position';
                      }
                      
                      return (
                        <div key={bookmark.id} className="border rounded-lg p-4 hover-elevate cursor-pointer" onClick={() => {
                          try {
                            const parsed = JSON.parse(bookmark.position);
                            if (renditionRef.current && parsed.cfi) {
                              renditionRef.current.display(parsed.cfi);
                              setShowBookmarksPanel(false);
                            }
                          } catch (error) {
                            console.error('Failed to navigate to bookmark:', error);
                          }
                        }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Bookmark className="h-4 w-4 text-primary" />
                                <span className="font-medium">{position}</span>
                              </div>
                              {bookmark.note && (
                                <p className="text-sm text-muted-foreground">{bookmark.note}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {bookmark.createdAt ? new Date(bookmark.createdAt).toLocaleDateString() : ''}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteBookmarkMutation.mutate(bookmark.id);
                              }}
                              data-testid={`button-delete-bookmark-${bookmark.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Sheet open={showAnnotationsPanel} onOpenChange={setShowAnnotationsPanel}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-annotations">
                <StickyNote className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Highlights & Notes</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
                {highlights.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Highlighter className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No highlights yet</p>
                    <p className="text-sm mt-1">Select text to create your first highlight</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {highlights.map((highlight) => {
                      const annotation = annotations.find(a => a.highlightId === highlight.id);
                      return (
                        <div key={highlight.id} className="border rounded-lg p-4 space-y-3">
                          <div 
                            className="p-3 rounded-md cursor-pointer hover-elevate"
                            style={{ backgroundColor: `${getHighlightColor(highlight.color)}40` }}
                            onClick={() => {
                              if (renditionRef.current) {
                                renditionRef.current.display(highlight.cfiRange);
                                setShowAnnotationsPanel(false);
                              }
                            }}
                          >
                            <p className="text-sm leading-relaxed">{highlight.selectedText}</p>
                          </div>
                          
                          {annotation ? (
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 p-3 bg-muted rounded-md">
                                  <p className="text-sm text-muted-foreground">{annotation.note}</p>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingAnnotation({
                                      highlightId: highlight.id,
                                      annotationId: annotation.id,
                                      text: annotation.note,
                                    })}
                                    data-testid={`button-edit-annotation-${highlight.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteAnnotationMutation.mutate(annotation.id)}
                                    data-testid={`button-delete-annotation-${highlight.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingAnnotation({
                                highlightId: highlight.id,
                                text: '',
                              })}
                              data-testid={`button-add-note-${highlight.id}`}
                            >
                              <StickyNote className="h-4 w-4 mr-2" />
                              Add Note
                            </Button>
                          )}
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{highlight.createdAt ? new Date(highlight.createdAt).toLocaleDateString() : ''}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteHighlightMutation.mutate(highlight.id)}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-highlight-${highlight.id}`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Reader Settings</SheetTitle>
            </SheetHeader>
            <div className="space-y-6 mt-6">
              {/* Theme Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Theme</Label>
                <RadioGroup value={theme} onValueChange={setTheme}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="cursor-pointer flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Cream Linen
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="parchment" id="parchment" />
                    <Label htmlFor="parchment" className="cursor-pointer">
                      Aged Parchment
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sepia" id="sepia" />
                    <Label htmlFor="sepia" className="cursor-pointer">
                      Cottage Paper
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fireside" id="fireside" />
                    <Label htmlFor="fireside" className="cursor-pointer">
                      By the Fire
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark" className="cursor-pointer flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Fireplace Embers
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Font Family */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Font Family</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serif">Serif (Traditional)</SelectItem>
                    <SelectItem value="sans-serif">Sans Serif (Modern)</SelectItem>
                    <SelectItem value="monospace">Monospace (Code)</SelectItem>
                    <SelectItem value="OpenDyslexic">OpenDyslexic (Dyslexia-Friendly)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Font Size</Label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                    data-testid="button-decrease-font"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm tabular-nums w-12 text-center">{fontSize}px</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                    data-testid="button-increase-font"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Slider
                  value={[fontSize]}
                  onValueChange={(values) => setFontSize(values[0])}
                  min={12}
                  max={32}
                  step={1}
                  className="mt-2"
                />
              </div>

              {/* Line Height */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Line Spacing</Label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setLineHeight(Math.max(1.2, lineHeight - 0.2))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm tabular-nums w-12 text-center">{lineHeight.toFixed(1)}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setLineHeight(Math.min(2.4, lineHeight + 0.2))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Slider
                  value={[lineHeight]}
                  onValueChange={(values) => setLineHeight(values[0])}
                  min={1.2}
                  max={2.4}
                  step={0.1}
                  className="mt-2"
                />
              </div>

              {/* Brightness */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Brightness</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm tabular-nums w-16">{brightness}%</span>
                  <Slider
                    value={[brightness]}
                    onValueChange={(values) => setBrightness(values[0])}
                    min={50}
                    max={150}
                    step={5}
                  />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
          </div>
        </header>
      )}

      {/* Main reading area with click navigation zones */}
      <div 
        className="flex-1 relative overflow-hidden"
        data-testid="epub-reader-wrapper"
      >
        {/* The actual epub content */}
        <div 
          className="h-full w-full"
          ref={viewerRef}
          {...swipeHandlers}
          data-testid="epub-viewer-container"
        />
        
        {/* Navigation overlay - only active when highlight mode is off */}
        {!highlightMode && (
          <div className="absolute inset-0 flex pointer-events-none z-10">
            {/* Left zone - previous page */}
            <div 
              className="w-1/3 h-full pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                prevPage();
              }}
              data-testid="nav-zone-prev"
            />
            {/* Center zone - toggle fullscreen */}
            <div 
              className="w-1/3 h-full pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen((prev) => !prev);
              }}
              data-testid="nav-zone-center"
            />
            {/* Right zone - next page */}
            <div 
              className="w-1/3 h-full pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                nextPage();
              }}
              data-testid="nav-zone-next"
            />
          </div>
        )}
        
        {/* Visual indicator for highlight mode */}
        {highlightMode && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 z-20 pointer-events-none">
            <Highlighter className="h-4 w-4" />
            Highlight Mode - Select text to highlight
          </div>
        )}
        
        {/* Visual indicator for navigation zones (only visible on first tap in fullscreen) */}
        {isFullscreen && !highlightMode && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-muted-foreground/60 pointer-events-none">
            Tap center to show controls
          </div>
        )}
      </div>

      {/* Footer - hidden in fullscreen mode */}
      {!isFullscreen && (
        <footer className="border-t p-4 bg-background shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevPage}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <div className="flex-1 text-center">
              <span className="text-sm text-muted-foreground">{progress}% complete</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={nextPage}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </footer>
      )}

      {/* Highlight Creation Dialog */}
      <Dialog open={showHighlightDialog} onOpenChange={(open) => {
        setShowHighlightDialog(open);
        if (!open) {
          // Clear selection state when dialog is closed without creating highlight
          setSelectedText("");
          setSelectedCfiRange("");
          setAnnotationText("");
          // Clear iframe selection so user can make a fresh selection
          const contents = renditionRef.current?.getContents?.() as any;
          if (contents?.[0]) {
            const win = contents[0].window;
            win?.getSelection()?.removeAllRanges();
          }
          // Keep highlight mode on so user can select more text
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Highlight</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm">{selectedText}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Highlight Color</Label>
              <div className="flex gap-2">
                {['yellow', 'green', 'blue', 'pink', 'orange'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setHighlightColor(color)}
                    className={`w-10 h-10 rounded-md border-2 ${
                      highlightColor === color ? 'border-primary' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: getHighlightColor(color) }}
                    data-testid={`color-${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="annotation">Add Note (Optional)</Label>
              <Textarea
                id="annotation"
                placeholder="Add your thoughts or notes..."
                value={annotationText}
                onChange={(e) => setAnnotationText(e.target.value)}
                rows={3}
                data-testid="textarea-annotation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHighlightDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={annotationText.trim() ? handleCreateHighlightWithNote : handleCreateHighlight}
              data-testid="button-save-highlight"
            >
              <Highlighter className="h-4 w-4 mr-2" />
              Save Highlight
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Annotation Edit Dialog */}
      <Dialog open={!!editingAnnotation} onOpenChange={() => setEditingAnnotation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-annotation">Note</Label>
              <Textarea
                id="edit-annotation"
                value={editingAnnotation?.text || ''}
                onChange={(e) => setEditingAnnotation(prev => 
                  prev ? { ...prev, text: e.target.value } : null
                )}
                rows={4}
                data-testid="textarea-edit-annotation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAnnotation(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAnnotation} data-testid="button-update-annotation">
              <StickyNote className="h-4 w-4 mr-2" />
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Search in Book</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter search term..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                data-testid="input-search"
              />
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} data-testid="button-execute-search">
                <Search className="h-4 w-4 mr-2" />
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            <ScrollArea className="h-[400px]">
              {searchResults.length === 0 && !isSearching && searchQuery && (
                <div className="text-center text-muted-foreground py-8">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No results found</p>
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">{searchResults.length} results found</p>
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-3 cursor-pointer hover-elevate"
                      onClick={() => {
                        if (renditionRef.current && result.cfi) {
                          renditionRef.current.display(result.cfi);
                          setShowSearchDialog(false);
                        }
                      }}
                      data-testid={`search-result-${index}`}
                    >
                      <p className="text-sm" dangerouslySetInnerHTML={{ __html: result.excerpt }} />
                    </div>
                  ))}
                </div>
              )}
              
              {isSearching && (
                <div className="text-center text-muted-foreground py-8">
                  <p>Searching...</p>
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSearchDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dictionary Dialog */}
      <Dialog open={showDictionaryDialog} onOpenChange={setShowDictionaryDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedWord}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[500px]">
            {isLoadingDictionary && (
              <div className="text-center text-muted-foreground py-8">
                <p>Loading definition...</p>
              </div>
            )}
            
            {!isLoadingDictionary && dictionaryData && dictionaryData.error && (
              <div className="text-center text-muted-foreground py-8">
                <p>{dictionaryData.error}</p>
              </div>
            )}
            
            {!isLoadingDictionary && dictionaryData && !dictionaryData.error && (
              <div className="space-y-4">
                {dictionaryData.phonetic && (
                  <p className="text-sm text-muted-foreground italic">{dictionaryData.phonetic}</p>
                )}
                
                {dictionaryData.meanings?.map((meaning: any, index: number) => (
                  <div key={index} className="space-y-2">
                    <Badge variant="outline" className="capitalize">{meaning.partOfSpeech}</Badge>
                    
                    {meaning.definitions?.slice(0, 3).map((def: any, defIndex: number) => (
                      <div key={defIndex} className="pl-4 border-l-2">
                        <p className="text-sm">{def.definition}</p>
                        {def.example && (
                          <p className="text-sm text-muted-foreground italic mt-1">&ldquo;{def.example}&rdquo;</p>
                        )}
                      </div>
                    ))}
                    
                    {meaning.synonyms && meaning.synonyms.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium">Synonyms: </span>
                        <span className="text-muted-foreground">{meaning.synonyms.slice(0, 5).join(', ')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDictionaryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
