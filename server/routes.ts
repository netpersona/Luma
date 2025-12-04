import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import {
  saveLocalFile,
  saveLocalFileWithName,
  readLocalFile,
  getLocalFilePath,
  getAbsoluteFilePath,
  getContentType,
  getFileExtension,
  generateUploadId,
  deleteLocalFile,
} from "./localFileStorage";
import {
  insertBookSchema,
  insertAudiobookSchema,
  insertReadingProgressSchema,
  insertListeningProgressSchema,
  insertCollectionSchema,
  insertCollectionItemSchema,
  insertBookmarkSchema,
  insertHighlightSchema,
  insertAnnotationSchema,
  insertReaderPreferencesSchema,
  insertIntegrationSettingSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { extractMetadataFromBuffer, extractDominantColors, extractDominantColorsWithMethod } from "./metadata";
import { optimizeCover } from "./image-optimizer";
import { encrypt, decrypt, maskSecret } from "./encryption";
import { getSourceOrchestrator } from "./integrations/sourceOrchestrator";
import { deliveryService } from "./services/deliveryService";
import { fetchCoverImage, fetchCoverForBook, fetchCoverForAudiobook, searchCoverOptions, saveCoverFromUrl } from "./services/coverFetcher";
import { calibreService } from "./services/calibreService";
import { loadSettings, saveSettings, loadSecrets, saveSecrets, getConfigPaths, type AppSettings, type AppSecrets, type ColorExtractionMethod } from "./config";
import { requireAuth, requireAdmin } from "./authRoutes";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";

// Helper to extract colors using the configured method from settings
async function extractColorsWithSettings(imageBuffer: Buffer): Promise<string[]> {
  const settings = loadSettings();
  return extractDominantColorsWithMethod(imageBuffer, settings.heroColorExtractionMethod);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads (memory storage for cover images)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (_req, file, cb) => {
      // Accept only image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });

  // Protect all API routes except /api/auth/*
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    // Skip auth check for auth routes (handled separately)
    if (req.path.startsWith("/auth")) {
      return next();
    }
    // All other API routes require authentication
    requireAuth(req, res, next);
  });

  // Serve theme mockup HTML files
  app.get("/baroque-mockup.html", async (req, res) => {
    try {
      const htmlContent = await fs.readFile(path.join(process.cwd(), "baroque-mockup.html"), "utf-8");
      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error("Error serving baroque mockup:", error);
      res.status(404).send("Mockup not found");
    }
  });

  app.get("/cottagecore-mockup.html", async (req, res) => {
    try {
      const htmlContent = await fs.readFile(path.join(process.cwd(), "cottagecore-mockup.html"), "utf-8");
      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error("Error serving cottagecore mockup:", error);
      res.status(404).send("Mockup not found");
    }
  });

  // Store pending uploads in memory (file data stored temporarily)
  const pendingUploads = new Map<string, { data: Buffer; filename: string; contentType: string; timestamp: number }>();

  // Local Storage - File upload endpoint
  app.post("/api/upload", async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      
      const data = Buffer.concat(chunks);
      const uploadId = generateUploadId();
      const filename = req.headers['x-filename'] as string || 'file';
      const contentType = req.headers['content-type'] || 'application/octet-stream';
      
      // Store file data temporarily for processing
      pendingUploads.set(uploadId, { 
        data, 
        filename, 
        contentType: contentType as string,
        timestamp: Date.now() 
      });
      
      // Clean up old uploads (older than 10 minutes)
      for (const [id, fileData] of Array.from(pendingUploads.entries())) {
        if (Date.now() - fileData.timestamp > 10 * 60 * 1000) {
          pendingUploads.delete(id);
        }
      }
      
      res.json({ uploadId });
    } catch (error) {
      console.error("Error handling upload:", error);
      res.status(500).json({ error: "Failed to handle upload" });
    }
  });

  // Legacy endpoint for backwards compatibility
  app.post("/api/objects/upload", async (_req, res) => {
    try {
      // Return a local upload endpoint
      const uploadId = generateUploadId();
      res.json({ uploadURL: `/api/upload`, uploadId });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Process uploaded files and extract metadata
  app.post("/api/process-uploads", async (req, res) => {
    try {
      const { uploadIds } = req.body as { uploadIds: string[] };
      
      console.log('[process-uploads] Received upload IDs:', uploadIds);
      
      if (!uploadIds || !Array.isArray(uploadIds)) {
        return res.status(400).json({ error: "Invalid request: uploadIds array required" });
      }
      
      if (uploadIds.length === 0) {
        console.warn('[process-uploads] Empty uploadIds array received');
        return res.json({ results: [] });
      }
      
      // Retrieve the file data from our temporary storage
      const files = uploadIds.map(id => {
        const fileData = pendingUploads.get(id);
        if (!fileData) {
          console.warn('[process-uploads] Upload ID not found:', id);
          return null;
        }
        // Clean up after retrieving
        pendingUploads.delete(id);
        return { 
          data: fileData.data, 
          name: fileData.filename,
          contentType: fileData.contentType
        };
      }).filter(Boolean) as Array<{ data: Buffer; name: string; contentType: string }>;
      
      console.log('[process-uploads] Retrieved files count:', files.length);
      
      if (files.length === 0) {
        console.warn('[process-uploads] No valid files found for upload IDs');
        return res.json({ results: [] });
      }

      const results = [];

      for (const fileInfo of files) {
        console.log('[process-uploads] Processing file:', fileInfo.name);
        try {
          // Determine file type
          const ext = path.extname(fileInfo.name).toLowerCase() || getFileExtension(fileInfo.name, fileInfo.contentType);
          const audioExts = [".m4b", ".mp3", ".m4a"];
          const isAudiobook = audioExts.includes(ext);
          
          // Save file to local storage
          const subdir = isAudiobook ? 'audiobooks' : 'books';
          const filePath = await saveLocalFileWithName(fileInfo.data, subdir, fileInfo.name);
          
          // Extract metadata
          const metadata = await extractMetadataFromBuffer(fileInfo.data, fileInfo.name);
          
          // Extract dominant colors from cover image (serialize to JSON for SQLite)
          let dominantColors: string | undefined;
          if (metadata.coverImageData) {
            const colors = await extractColorsWithSettings(metadata.coverImageData);
            if (colors && colors.length > 0) {
              dominantColors = JSON.stringify(colors);
            }
          }
          
          // Save cover image to local storage (optimized to WebP)
          let coverUrl: string | undefined;
          if (metadata.coverImageData) {
            try {
              let coverData = metadata.coverImageData;
              
              try {
                coverData = await optimizeCover(metadata.coverImageData, {
                  maxWidth: 600,
                  maxHeight: 900,
                  quality: 85,
                  format: "webp",
                });
                console.log(`[process-uploads] Optimized cover: ${metadata.coverImageData.length} -> ${coverData.length} bytes`);
              } catch (optError) {
                console.warn(`[process-uploads] Failed to optimize cover, using original:`, optError);
              }
              
              coverUrl = await saveLocalFile(coverData, 'covers', '.webp');
            } catch (err) {
              console.error(`Error saving cover for ${fileInfo.name}:`, err);
            }
          }
          
          // If no cover found in file, try to fetch from external sources
          if (!coverUrl) {
            console.log(`[process-uploads] No cover in file, attempting to fetch from external sources...`);
            try {
              const fetchResult = await fetchCoverImage(
                metadata.title || path.basename(fileInfo.name, ext),
                metadata.author || undefined,
                metadata.isbn || undefined
              );
              
              if (fetchResult.success && fetchResult.coverUrl) {
                coverUrl = fetchResult.coverUrl;
                console.log(`[process-uploads] Fetched cover from ${fetchResult.source}: ${coverUrl}`);
                
                // Extract dominant colors from the fetched cover
                if (!dominantColors) {
                  try {
                    const coverData = await readLocalFile(coverUrl);
                    if (coverData) {
                      const colors = await extractColorsWithSettings(coverData);
                      if (colors && colors.length > 0) {
                        dominantColors = JSON.stringify(colors);
                      }
                    }
                  } catch (colorErr) {
                    console.warn(`[process-uploads] Failed to extract colors from fetched cover:`, colorErr);
                  }
                }
              } else {
                console.log(`[process-uploads] Could not fetch cover: ${fetchResult.error}`);
              }
            } catch (fetchErr) {
              console.warn(`[process-uploads] Error fetching cover:`, fetchErr);
            }
          }

          if (isAudiobook) {
            // Create audiobook record
            const audiobook = await storage.createAudiobook({
              title: metadata.title || path.basename(fileInfo.name, ext),
              author: metadata.author,
              narrator: metadata.narrator,
              duration: metadata.duration ? Math.floor(metadata.duration) : undefined,
              filePath,
              coverUrl,
              description: metadata.description,
              publisher: metadata.publisher,
              publishedDate: metadata.publishedYear ? String(metadata.publishedYear) : undefined,
              isbn: metadata.isbn,
              language: metadata.language,
              series: metadata.series,
              dominantColors,
              format: ext.slice(1).toUpperCase(),
            });
            results.push({ type: "audiobook", id: audiobook.id });
          } else {
            // Create book record
            const book = await storage.createBook({
              title: metadata.title || path.basename(fileInfo.name, ext),
              author: metadata.author,
              filePath,
              coverUrl,
              description: metadata.description,
              publisher: metadata.publisher,
              publishedDate: metadata.publishedYear ? String(metadata.publishedYear) : undefined,
              isbn: metadata.isbn,
              language: metadata.language,
              series: metadata.series,
              pageCount: metadata.pageCount,
              dominantColors,
              format: ext.slice(1).toUpperCase(),
            });
            results.push({ type: "book", id: book.id });
          }
        } catch (error) {
          console.error(`Error processing file ${fileInfo.name}:`, error);
          results.push({ 
            type: "error", 
            filename: fileInfo.name, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error processing uploads:", error);
      res.status(500).json({ error: "Failed to process uploads" });
    }
  });

  // Local Storage - Serve uploaded files
  // Legacy route for backwards compatibility with existing database records
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      // Try to serve from local storage
      const localPath = `/local-files/${req.params.objectPath}`;
      const fullPath = await getLocalFilePath(localPath);
      
      if (fullPath) {
        const stat = await fs.stat(fullPath);
        const contentType = getContentType(fullPath);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        
        const stream = fsSync.createReadStream(fullPath);
        stream.pipe(res);
        return;
      }
      
      return res.sendStatus(404);
    } catch (error) {
      console.error("Error serving object:", error);
      return res.sendStatus(500);
    }
  });

  // Local Storage - Serve public assets
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    try {
      const localPath = `/local-files/uploads/${req.params.filePath}`;
      const fullPath = await getLocalFilePath(localPath);
      
      if (!fullPath) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const stat = await fs.stat(fullPath);
      const contentType = getContentType(fullPath);
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      const stream = fsSync.createReadStream(fullPath);
      stream.pipe(res);
    } catch (error) {
      console.error("Error serving public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Local Files - Serve files from Calibre libraries (Docker/Unraid mounted volumes)
  app.get("/api/local-file", async (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      // Security: Verify the file path is within a registered Calibre library
      const libraries = await storage.getCalibreLibraries();
      const isAllowedPath = libraries.some(lib => {
        const normalizedLibPath = path.resolve(lib.path);
        const normalizedFilePath = path.resolve(filePath);
        return normalizedFilePath.startsWith(normalizedLibPath + path.sep);
      });

      if (!isAllowedPath) {
        return res.status(403).json({ error: "Access denied: File not in a registered library" });
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: "File not found" });
      }

      // Determine content type
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.epub': 'application/epub+zip',
        '.pdf': 'application/pdf',
        '.mobi': 'application/x-mobipocket-ebook',
        '.cbz': 'application/x-cbz',
        '.cbr': 'application/x-cbr',
        '.m4b': 'audio/mp4',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      const stat = await fs.stat(filePath);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const stream = await import('fs').then(fsSync => fsSync.createReadStream(filePath));
      stream.pipe(res);
    } catch (error) {
      console.error("Error serving local file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Local Storage - Serve files from local storage (Docker deployments)
  app.get("/local-files/:subdir/:filename", async (req, res) => {
    try {
      const { getLocalFilePath } = await import("./localFileStorage");
      const { subdir, filename } = req.params;
      
      // Security: Whitelist valid subdirectories
      const validSubdirs = ['books', 'audiobooks', 'covers', 'uploads'];
      if (!validSubdirs.includes(subdir)) {
        return res.status(400).json({ error: "Invalid subdirectory" });
      }
      
      // Security: Reject filenames containing path traversal patterns
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: "Invalid filename" });
      }
      
      const localPath = `/local-files/${subdir}/${filename}`;
      
      const fullPath = await getLocalFilePath(localPath);
      if (!fullPath) {
        return res.status(404).json({ error: "File not found" });
      }

      const ext = path.extname(filename).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.epub': 'application/epub+zip',
        '.pdf': 'application/pdf',
        '.mobi': 'application/x-mobipocket-ebook',
        '.cbz': 'application/x-cbz',
        '.cbr': 'application/x-cbr',
        '.m4b': 'audio/mp4',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.bin': 'application/octet-stream',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      const stat = await fs.stat(fullPath);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const stream = await import('fs').then(fsSync => fsSync.createReadStream(fullPath));
      stream.pipe(res);
    } catch (error) {
      console.error("Error serving local storage file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Books endpoints
  app.get("/api/books", async (req, res) => {
    try {
      const allBooks = await storage.getAllBooks();
      res.json(allBooks);
    } catch (error) {
      console.error("Error getting books:", error);
      res.status(500).json({ error: "Failed to get books" });
    }
  });

  // Recent items (books and audiobooks with progress)
  app.get("/api/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const recentItems = await storage.getRecentItems(limit);
      res.json(recentItems);
    } catch (error) {
      console.error("Error getting recent items:", error);
      res.status(500).json({ error: "Failed to get recent items" });
    }
  });

  // Reading Goals
  app.get("/api/goals", async (req, res) => {
    try {
      const goals = await storage.getAllGoals();
      res.json(goals);
    } catch (error) {
      console.error("Error getting goals:", error);
      res.status(500).json({ error: "Failed to get goals" });
    }
  });

  app.get("/api/goals/:id", async (req, res) => {
    try {
      const goal = await storage.getGoalById(req.params.id);
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      res.json(goal);
    } catch (error) {
      console.error("Error getting goal:", error);
      res.status(500).json({ error: "Failed to get goal" });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const goalData = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      };
      const goal = await storage.createGoal(goalData);
      res.status(201).json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  app.patch("/api/goals/:id", async (req, res) => {
    try {
      const updateData = { ...req.body };
      if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
      if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
      if (updateData.updatedAt) updateData.updatedAt = new Date(updateData.updatedAt);
      
      const goal = await storage.updateGoal(req.params.id, updateData);
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ error: "Failed to update goal" });
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    try {
      await storage.deleteGoal(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).json({ error: "Failed to delete goal" });
    }
  });

  app.get("/api/books/:id", async (req, res) => {
    try {
      const book = await storage.getBookById(req.params.id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json(book);
    } catch (error) {
      console.error("Error getting book:", error);
      res.status(500).json({ error: "Failed to get book" });
    }
  });

  app.post("/api/books", async (req, res) => {
    try {
      const validated = insertBookSchema.parse(req.body);
      const book = await storage.createBook(validated);
      res.status(201).json(book);
    } catch (error: any) {
      console.error("Error creating book:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to create book" });
    }
  });

  app.put("/api/books/:id", async (req, res) => {
    try {
      const validated = insertBookSchema.partial().parse(req.body);
      const book = await storage.updateBook(req.params.id, validated);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.json(book);
    } catch (error: any) {
      console.error("Error updating book:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to update book" });
    }
  });

  app.delete("/api/books/:id", requireAdmin, async (req, res) => {
    try {
      const bookId = req.params.id;
      
      // Fetch the book to get file paths before deletion
      const book = await storage.getBookById(bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Delete the book file if it exists
      if (book.filePath) {
        try {
          await deleteLocalFile(book.filePath);
        } catch (fileErr) {
          console.warn(`[deleteBook] Could not delete book file ${book.filePath}:`, fileErr);
        }
      }
      
      // Delete the cover file if it exists
      if (book.coverUrl) {
        try {
          await deleteLocalFile(book.coverUrl);
        } catch (coverErr) {
          console.warn(`[deleteBook] Could not delete cover file ${book.coverUrl}:`, coverErr);
        }
      }
      
      // Delete the database record
      await storage.deleteBook(bookId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting book:", error);
      res.status(500).json({ error: "Failed to delete book" });
    }
  });

  // Fetch cover for a book from external sources (auto-select first available)
  app.post("/api/books/:id/fetch-cover", async (req, res) => {
    try {
      const bookId = req.params.id;
      const book = await storage.getBookById(bookId);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Get user's Google Books API key if available
      let googleBooksApiKey: string | undefined;
      try {
        const userId = (req as any).user?.id || 'default';
        const apiKeySetting = await storage.getIntegrationSetting(`user:${userId}:googleBooksApiKey`);
        if (apiKeySetting?.value) {
          googleBooksApiKey = apiKeySetting.isSecret ? decrypt(apiKeySetting.value) : apiKeySetting.value;
        }
      } catch (keyErr) {
        console.warn('[fetch-cover] Could not get Google Books API key:', keyErr);
      }
      
      const result = await fetchCoverForBook(bookId, storage, googleBooksApiKey);
      
      if (result.success) {
        // Also update dominant colors from the new cover
        if (result.coverUrl) {
          try {
            const coverData = await readLocalFile(result.coverUrl);
            if (coverData) {
              const colors = await extractColorsWithSettings(coverData);
              if (colors && colors.length > 0) {
                await storage.updateBook(bookId, { dominantColors: JSON.stringify(colors) });
              }
            }
          } catch (colorErr) {
            console.warn('[fetch-cover] Failed to extract colors:', colorErr);
          }
        }
        
        const updatedBook = await storage.getBookById(bookId);
        res.json({ success: true, book: updatedBook, source: result.source });
      } else {
        res.status(404).json({ success: false, error: result.error || "Could not find cover" });
      }
    } catch (error: any) {
      console.error("Error fetching book cover:", error);
      res.status(500).json({ error: error.message || "Failed to fetch cover" });
    }
  });

  // Search for available cover options for a book
  app.get("/api/books/:id/covers", async (req, res) => {
    try {
      const bookId = req.params.id;
      const book = await storage.getBookById(bookId);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Get user's Google Books API key if available
      let googleBooksApiKey: string | undefined;
      try {
        const userId = (req as any).user?.id || 'default';
        const apiKeySetting = await storage.getIntegrationSetting(`user:${userId}:googleBooksApiKey`);
        if (apiKeySetting?.value) {
          googleBooksApiKey = apiKeySetting.isSecret ? decrypt(apiKeySetting.value) : apiKeySetting.value;
        }
      } catch (keyErr) {
        console.warn('[covers-search] Could not get Google Books API key:', keyErr);
      }
      
      const result = await searchCoverOptions(
        book.title,
        book.author || undefined,
        book.isbn || undefined,
        googleBooksApiKey
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error searching for covers:", error);
      res.status(500).json({ error: error.message || "Failed to search covers" });
    }
  });

  // Select a cover from URL for a book
  app.post("/api/books/:id/cover/select", async (req, res) => {
    try {
      const bookId = req.params.id;
      const { coverUrl: sourceUrl } = req.body;
      
      if (!sourceUrl) {
        return res.status(400).json({ error: "Cover URL is required" });
      }
      
      const book = await storage.getBookById(bookId);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      // Download, optimize and save the cover
      const result = await saveCoverFromUrl(sourceUrl);
      
      if (!result.success || !result.coverUrl) {
        return res.status(400).json({ error: result.error || "Failed to save cover" });
      }
      
      // Update book with new cover
      await storage.updateBook(bookId, { coverUrl: result.coverUrl });
      
      // Extract and update dominant colors
      try {
        const coverData = await readLocalFile(result.coverUrl);
        if (coverData) {
          const colors = await extractColorsWithSettings(coverData);
          if (colors && colors.length > 0) {
            await storage.updateBook(bookId, { dominantColors: JSON.stringify(colors) });
          }
        }
      } catch (colorErr) {
        console.warn('[cover-select] Failed to extract colors:', colorErr);
      }
      
      const updatedBook = await storage.getBookById(bookId);
      res.json({ success: true, book: updatedBook, source: result.source });
    } catch (error: any) {
      console.error("Error selecting cover:", error);
      res.status(500).json({ error: error.message || "Failed to select cover" });
    }
  });

  // Upload a custom cover for a book
  app.post("/api/books/:id/cover/upload", upload.single('cover'), async (req, res) => {
    try {
      const bookId = req.params.id;
      const book = await storage.getBookById(bookId);
      
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "Cover file is required" });
      }
      
      // Optimize and save the cover
      const optimizedCover = await optimizeCover(req.file.buffer, {
        maxWidth: 600,
        maxHeight: 900,
        quality: 85,
        format: 'webp',
      });
      
      const coverUrl = await saveLocalFile(optimizedCover, 'covers', '.webp');
      
      // Update book with new cover
      await storage.updateBook(bookId, { coverUrl });
      
      // Extract and update dominant colors
      try {
        const colors = await extractColorsWithSettings(optimizedCover);
        if (colors && colors.length > 0) {
          await storage.updateBook(bookId, { dominantColors: JSON.stringify(colors) });
        }
      } catch (colorErr) {
        console.warn('[cover-upload] Failed to extract colors:', colorErr);
      }
      
      const updatedBook = await storage.getBookById(bookId);
      res.json({ success: true, book: updatedBook });
    } catch (error: any) {
      console.error("Error uploading cover:", error);
      res.status(500).json({ error: error.message || "Failed to upload cover" });
    }
  });

  // Audiobooks endpoints
  app.get("/api/audiobooks", async (req, res) => {
    try {
      const allAudiobooks = await storage.getAllAudiobooks();
      res.json(allAudiobooks);
    } catch (error) {
      console.error("Error getting audiobooks:", error);
      res.status(500).json({ error: "Failed to get audiobooks" });
    }
  });

  app.get("/api/audiobooks/:id", async (req, res) => {
    try {
      const audiobook = await storage.getAudiobookById(req.params.id);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      res.json(audiobook);
    } catch (error) {
      console.error("Error getting audiobook:", error);
      res.status(500).json({ error: "Failed to get audiobook" });
    }
  });

  app.post("/api/audiobooks", async (req, res) => {
    try {
      const validated = insertAudiobookSchema.parse(req.body);
      const audiobook = await storage.createAudiobook(validated);
      res.status(201).json(audiobook);
    } catch (error: any) {
      console.error("Error creating audiobook:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to create audiobook" });
    }
  });

  app.put("/api/audiobooks/:id", async (req, res) => {
    try {
      const validated = insertAudiobookSchema.partial().parse(req.body);
      const audiobook = await storage.updateAudiobook(req.params.id, validated);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      res.json(audiobook);
    } catch (error: any) {
      console.error("Error updating audiobook:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to update audiobook" });
    }
  });

  app.delete("/api/audiobooks/:id", async (req, res) => {
    try {
      await storage.deleteAudiobook(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting audiobook:", error);
      res.status(500).json({ error: "Failed to delete audiobook" });
    }
  });

  // Fetch cover for an audiobook from external sources (auto-select first available)
  app.post("/api/audiobooks/:id/fetch-cover", async (req, res) => {
    try {
      const audiobookId = req.params.id;
      const audiobook = await storage.getAudiobookById(audiobookId);
      
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      // Get user's Google Books API key if available
      let googleBooksApiKey: string | undefined;
      try {
        const userId = (req as any).user?.id || 'default';
        const apiKeySetting = await storage.getIntegrationSetting(`user:${userId}:googleBooksApiKey`);
        if (apiKeySetting?.value) {
          googleBooksApiKey = apiKeySetting.isSecret ? decrypt(apiKeySetting.value) : apiKeySetting.value;
        }
      } catch (keyErr) {
        console.warn('[fetch-cover] Could not get Google Books API key:', keyErr);
      }
      
      const result = await fetchCoverForAudiobook(audiobookId, storage, googleBooksApiKey);
      
      if (result.success) {
        // Also update dominant colors from the new cover
        if (result.coverUrl) {
          try {
            const coverData = await readLocalFile(result.coverUrl);
            if (coverData) {
              const colors = await extractColorsWithSettings(coverData);
              if (colors && colors.length > 0) {
                await storage.updateAudiobook(audiobookId, { dominantColors: JSON.stringify(colors) });
              }
            }
          } catch (colorErr) {
            console.warn('[fetch-cover] Failed to extract colors:', colorErr);
          }
        }
        
        const updatedAudiobook = await storage.getAudiobookById(audiobookId);
        res.json({ success: true, audiobook: updatedAudiobook, source: result.source });
      } else {
        res.status(404).json({ success: false, error: result.error || "Could not find cover" });
      }
    } catch (error: any) {
      console.error("Error fetching audiobook cover:", error);
      res.status(500).json({ error: error.message || "Failed to fetch cover" });
    }
  });

  // Search for available cover options for an audiobook
  app.get("/api/audiobooks/:id/covers", async (req, res) => {
    try {
      const audiobookId = req.params.id;
      const audiobook = await storage.getAudiobookById(audiobookId);
      
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      // Get user's Google Books API key if available
      let googleBooksApiKey: string | undefined;
      try {
        const userId = (req as any).user?.id || 'default';
        const apiKeySetting = await storage.getIntegrationSetting(`user:${userId}:googleBooksApiKey`);
        if (apiKeySetting?.value) {
          googleBooksApiKey = apiKeySetting.isSecret ? decrypt(apiKeySetting.value) : apiKeySetting.value;
        }
      } catch (keyErr) {
        console.warn('[covers-search] Could not get Google Books API key:', keyErr);
      }
      
      const result = await searchCoverOptions(
        audiobook.title,
        audiobook.author || undefined,
        audiobook.isbn || undefined,
        googleBooksApiKey
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error searching for covers:", error);
      res.status(500).json({ error: error.message || "Failed to search covers" });
    }
  });

  // Select a cover from URL for an audiobook
  app.post("/api/audiobooks/:id/cover/select", async (req, res) => {
    try {
      const audiobookId = req.params.id;
      const { coverUrl: sourceUrl } = req.body;
      
      if (!sourceUrl) {
        return res.status(400).json({ error: "Cover URL is required" });
      }
      
      const audiobook = await storage.getAudiobookById(audiobookId);
      
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      // Download, optimize and save the cover
      const result = await saveCoverFromUrl(sourceUrl);
      
      if (!result.success || !result.coverUrl) {
        return res.status(400).json({ error: result.error || "Failed to save cover" });
      }
      
      // Update audiobook with new cover
      await storage.updateAudiobook(audiobookId, { coverUrl: result.coverUrl });
      
      // Extract and update dominant colors
      try {
        const coverData = await readLocalFile(result.coverUrl);
        if (coverData) {
          const colors = await extractColorsWithSettings(coverData);
          if (colors && colors.length > 0) {
            await storage.updateAudiobook(audiobookId, { dominantColors: JSON.stringify(colors) });
          }
        }
      } catch (colorErr) {
        console.warn('[cover-select] Failed to extract colors:', colorErr);
      }
      
      const updatedAudiobook = await storage.getAudiobookById(audiobookId);
      res.json({ success: true, audiobook: updatedAudiobook, source: result.source });
    } catch (error: any) {
      console.error("Error selecting cover:", error);
      res.status(500).json({ error: error.message || "Failed to select cover" });
    }
  });

  // Upload a custom cover for an audiobook
  app.post("/api/audiobooks/:id/cover/upload", upload.single('cover'), async (req, res) => {
    try {
      const audiobookId = req.params.id;
      const audiobook = await storage.getAudiobookById(audiobookId);
      
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "Cover file is required" });
      }
      
      // Optimize and save the cover
      const optimizedCover = await optimizeCover(req.file.buffer, {
        maxWidth: 600,
        maxHeight: 900,
        quality: 85,
        format: 'webp',
      });
      
      const coverUrl = await saveLocalFile(optimizedCover, 'covers', '.webp');
      
      // Update audiobook with new cover
      await storage.updateAudiobook(audiobookId, { coverUrl });
      
      // Extract and update dominant colors
      try {
        const colors = await extractColorsWithSettings(optimizedCover);
        if (colors && colors.length > 0) {
          await storage.updateAudiobook(audiobookId, { dominantColors: JSON.stringify(colors) });
        }
      } catch (colorErr) {
        console.warn('[cover-upload] Failed to extract colors:', colorErr);
      }
      
      const updatedAudiobook = await storage.getAudiobookById(audiobookId);
      res.json({ success: true, audiobook: updatedAudiobook });
    } catch (error: any) {
      console.error("Error uploading cover:", error);
      res.status(500).json({ error: error.message || "Failed to upload cover" });
    }
  });

  // Reading Progress endpoints
  app.get("/api/reading-progress/:bookId", async (req, res) => {
    try {
      const progress = await storage.getReadingProgress(req.params.bookId);
      if (!progress) {
        return res.status(404).json({ error: "Progress not found" });
      }
      res.json(progress);
    } catch (error) {
      console.error("Error getting reading progress:", error);
      res.status(500).json({ error: "Failed to get reading progress" });
    }
  });

  app.put("/api/reading-progress", async (req, res) => {
    try {
      const validated = insertReadingProgressSchema.parse(req.body);
      const progress = await storage.updateReadingProgress(validated);
      res.json(progress);
    } catch (error: any) {
      console.error("Error updating reading progress:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to update reading progress" });
    }
  });

  // Listening Progress endpoints
  app.get("/api/listening-progress/:audiobookId", async (req, res) => {
    try {
      const progress = await storage.getListeningProgress(req.params.audiobookId);
      if (!progress) {
        return res.status(404).json({ error: "Progress not found" });
      }
      res.json(progress);
    } catch (error) {
      console.error("Error getting listening progress:", error);
      res.status(500).json({ error: "Failed to get listening progress" });
    }
  });

  app.put("/api/listening-progress", async (req, res) => {
    try {
      const validated = insertListeningProgressSchema.parse(req.body);
      const progress = await storage.updateListeningProgress(validated);
      res.json(progress);
    } catch (error: any) {
      console.error("Error updating listening progress:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to update listening progress" });
    }
  });

  // Collections endpoints
  app.get("/api/collections", async (req, res) => {
    try {
      const allCollections = await storage.getAllCollections();
      res.json(allCollections);
    } catch (error) {
      console.error("Error getting collections:", error);
      res.status(500).json({ error: "Failed to get collections" });
    }
  });

  app.get("/api/collections/:id", async (req, res) => {
    try {
      const collection = await storage.getCollectionById(req.params.id);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      res.json(collection);
    } catch (error) {
      console.error("Error getting collection:", error);
      res.status(500).json({ error: "Failed to get collection" });
    }
  });

  app.post("/api/collections", async (req, res) => {
    try {
      const validated = insertCollectionSchema.parse(req.body);
      const collection = await storage.createCollection(validated);
      res.status(201).json(collection);
    } catch (error: any) {
      console.error("Error creating collection:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to create collection" });
    }
  });

  app.put("/api/collections/:id", async (req, res) => {
    try {
      const validated = insertCollectionSchema.partial().parse(req.body);
      const collection = await storage.updateCollection(req.params.id, validated);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      res.json(collection);
    } catch (error: any) {
      console.error("Error updating collection:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to update collection" });
    }
  });

  app.delete("/api/collections/:id", async (req, res) => {
    try {
      await storage.deleteCollection(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting collection:", error);
      res.status(500).json({ error: "Failed to delete collection" });
    }
  });

  // Collection Items endpoints
  app.post("/api/collections/:collectionId/items", async (req, res) => {
    try {
      const validated = insertCollectionItemSchema.parse({
        ...req.body,
        collectionId: req.params.collectionId,
      });
      const item = await storage.addItemToCollection(validated);
      res.status(201).json(item);
    } catch (error: any) {
      console.error("Error adding item to collection:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to add item to collection" });
    }
  });

  app.delete("/api/collections/:collectionId/items/:itemId", async (req, res) => {
    try {
      await storage.removeItemFromCollection(req.params.collectionId, req.params.itemId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing item from collection:", error);
      res.status(500).json({ error: "Failed to remove item from collection" });
    }
  });

  // Bookmarks endpoints
  app.get("/api/bookmarks/:itemType/:itemId", async (req, res) => {
    try {
      const bookmarks = await storage.getBookmarks(req.params.itemId, req.params.itemType);
      res.json(bookmarks);
    } catch (error) {
      console.error("Error getting bookmarks:", error);
      res.status(500).json({ error: "Failed to get bookmarks" });
    }
  });

  app.post("/api/bookmarks", async (req, res) => {
    try {
      const validated = insertBookmarkSchema.parse(req.body);
      const bookmark = await storage.createBookmark(validated);
      res.status(201).json(bookmark);
    } catch (error: any) {
      console.error("Error creating bookmark:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });

  app.delete("/api/bookmarks/:id", async (req, res) => {
    try {
      await storage.deleteBookmark(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });

  // Integration Settings endpoints
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      
      // Mask secrets before returning
      const maskedSettings = settings.map(setting => ({
        ...setting,
        value: setting.isSecret && setting.value ? maskSecret(setting.value) : setting.value,
      }));
      
      res.json(maskedSettings);
    } catch (error) {
      console.error("Error getting settings:", error);
      res.status(500).json({ error: "Failed to get settings" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      // Mask secret if needed
      const result = {
        ...setting,
        value: setting.isSecret && setting.value ? maskSecret(setting.value) : setting.value,
      };
      
      res.json(result);
    } catch (error) {
      console.error("Error getting setting:", error);
      res.status(500).json({ error: "Failed to get setting" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const validated = insertIntegrationSettingSchema.parse(req.body);
      
      // Encrypt value if it's marked as secret
      const settingData = {
        ...validated,
        value: validated.isSecret && validated.value ? encrypt(validated.value) : validated.value,
      };
      
      const setting = await storage.upsertSetting(settingData);
      
      // Mask secret in response
      const result = {
        ...setting,
        value: setting.isSecret && setting.value ? maskSecret(setting.value) : setting.value,
      };
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating/updating setting:", error);
      if (error.name === "ZodError") {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      res.status(500).json({ error: "Failed to create/update setting" });
    }
  });

  app.delete("/api/settings/:key", async (req, res) => {
    try {
      await storage.deleteSetting(req.params.key);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting setting:", error);
      res.status(500).json({ error: "Failed to delete setting" });
    }
  });

  // Library Cleanup Utility - Detect and remove orphaned records
  app.get("/api/library/orphaned", async (req, res) => {
    try {
      console.log('[Cleanup] Scanning for orphaned records...');
      
      const books = await storage.getAllBooks();
      const audiobooks = await storage.getAllAudiobooks();
      
      const orphanedBooks: Array<{ id: string; title: string; author?: string; filePath: string; reason: string }> = [];
      const orphanedAudiobooks: Array<{ id: string; title: string; author?: string; filePath: string; reason: string }> = [];
      
      // Check each book's file path
      for (const book of books) {
        if (!book.filePath) {
          orphanedBooks.push({
            id: book.id,
            title: book.title,
            author: book.author || undefined,
            filePath: 'No file path',
            reason: 'Missing file path'
          });
          continue;
        }
        
        // Check if file exists
        try {
          const fullPath = await getAbsoluteFilePath(book.filePath);
          if (!fullPath) {
            orphanedBooks.push({
              id: book.id,
              title: book.title,
              author: book.author || undefined,
              filePath: book.filePath,
              reason: 'File not found'
            });
          } else {
            // Verify the file actually exists on disk
            try {
              await fs.access(fullPath);
            } catch {
              orphanedBooks.push({
                id: book.id,
                title: book.title,
                author: book.author || undefined,
                filePath: book.filePath,
                reason: 'File does not exist on disk'
              });
            }
          }
        } catch (err) {
          orphanedBooks.push({
            id: book.id,
            title: book.title,
            author: book.author || undefined,
            filePath: book.filePath,
            reason: 'Error checking file: ' + (err instanceof Error ? err.message : String(err))
          });
        }
      }
      
      // Check each audiobook's file path
      for (const audiobook of audiobooks) {
        if (!audiobook.filePath) {
          orphanedAudiobooks.push({
            id: audiobook.id,
            title: audiobook.title,
            author: audiobook.author || undefined,
            filePath: 'No file path',
            reason: 'Missing file path'
          });
          continue;
        }
        
        // Check if file exists
        try {
          const fullPath = await getAbsoluteFilePath(audiobook.filePath);
          if (!fullPath) {
            orphanedAudiobooks.push({
              id: audiobook.id,
              title: audiobook.title,
              author: audiobook.author || undefined,
              filePath: audiobook.filePath,
              reason: 'File not found'
            });
          } else {
            // Verify the file actually exists on disk
            try {
              await fs.access(fullPath);
            } catch {
              orphanedAudiobooks.push({
                id: audiobook.id,
                title: audiobook.title,
                author: audiobook.author || undefined,
                filePath: audiobook.filePath,
                reason: 'File does not exist on disk'
              });
            }
          }
        } catch (err) {
          orphanedAudiobooks.push({
            id: audiobook.id,
            title: audiobook.title,
            author: audiobook.author || undefined,
            filePath: audiobook.filePath,
            reason: 'Error checking file: ' + (err instanceof Error ? err.message : String(err))
          });
        }
      }
      
      console.log(`[Cleanup] Found ${orphanedBooks.length} orphaned books, ${orphanedAudiobooks.length} orphaned audiobooks`);
      
      res.json({
        orphanedBooks,
        orphanedAudiobooks,
        totalBooks: books.length,
        totalAudiobooks: audiobooks.length,
      });
    } catch (error: any) {
      console.error("Error scanning for orphaned records:", error);
      res.status(500).json({ error: error.message || "Failed to scan for orphaned records" });
    }
  });

  // Delete multiple orphaned books
  app.post("/api/library/cleanup/books", async (req, res) => {
    try {
      const { bookIds } = req.body;
      
      if (!Array.isArray(bookIds) || bookIds.length === 0) {
        return res.status(400).json({ error: "bookIds must be a non-empty array" });
      }
      
      console.log(`[Cleanup] Deleting ${bookIds.length} orphaned books...`);
      
      let deleted = 0;
      const errors: string[] = [];
      
      for (const bookId of bookIds) {
        try {
          await storage.deleteBook(bookId);
          deleted++;
        } catch (err) {
          errors.push(`Failed to delete book ${bookId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      console.log(`[Cleanup] Deleted ${deleted} books, ${errors.length} errors`);
      
      res.json({ deleted, errors });
    } catch (error: any) {
      console.error("Error cleaning up books:", error);
      res.status(500).json({ error: error.message || "Failed to cleanup books" });
    }
  });

  // Delete multiple orphaned audiobooks
  app.post("/api/library/cleanup/audiobooks", async (req, res) => {
    try {
      const { audiobookIds } = req.body;
      
      if (!Array.isArray(audiobookIds) || audiobookIds.length === 0) {
        return res.status(400).json({ error: "audiobookIds must be a non-empty array" });
      }
      
      console.log(`[Cleanup] Deleting ${audiobookIds.length} orphaned audiobooks...`);
      
      let deleted = 0;
      const errors: string[] = [];
      
      for (const audiobookId of audiobookIds) {
        try {
          await storage.deleteAudiobook(audiobookId);
          deleted++;
        } catch (err) {
          errors.push(`Failed to delete audiobook ${audiobookId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      console.log(`[Cleanup] Deleted ${deleted} audiobooks, ${errors.length} errors`);
      
      res.json({ deleted, errors });
    } catch (error: any) {
      console.error("Error cleaning up audiobooks:", error);
      res.status(500).json({ error: error.message || "Failed to cleanup audiobooks" });
    }
  });

  // App-level Configuration (stored in /config directory for Docker persistence)
  app.get("/api/config", async (req, res) => {
    try {
      const settings = loadSettings();
      const paths = getConfigPaths();
      res.json({
        settings,
        configDir: paths.configDir,
      });
    } catch (error) {
      console.error("Error getting app config:", error);
      res.status(500).json({ error: "Failed to get app configuration" });
    }
  });

  app.put("/api/config", async (req, res) => {
    try {
      const updates = req.body as Partial<AppSettings>;
      const settings = saveSettings(updates);
      res.json({ settings });
    } catch (error) {
      console.error("Error updating app config:", error);
      res.status(500).json({ error: "Failed to update app configuration" });
    }
  });

  // Also support PATCH for partial updates (used by admin panel)
  app.patch("/api/config/settings", async (req, res) => {
    try {
      const updates = req.body as Partial<AppSettings>;
      const settings = saveSettings(updates);
      res.json({ settings });
    } catch (error) {
      console.error("Error updating app config:", error);
      res.status(500).json({ error: "Failed to update app configuration" });
    }
  });

  // Re-extract colors for all books and audiobooks using current extraction method
  app.post("/api/config/reextract-colors", requireAdmin, async (req, res) => {
    console.log("[Re-extract Colors] Starting color re-extraction...");
    try {
      const settings = loadSettings();
      const method = settings.heroColorExtractionMethod || 'mmcq';
      console.log(`[Re-extract Colors] Using method: ${method}`);
      
      let booksUpdated = 0;
      let audiobooksUpdated = 0;
      let errors: string[] = [];

      // Get all books
      console.log("[Re-extract Colors] Fetching books...");
      const books = await storage.getAllBooks();
      console.log(`[Re-extract Colors] Found ${books.length} books`);
      
      for (const book of books) {
        try {
          if (book.coverUrl) {
            console.log(`[Re-extract Colors] Processing book "${book.title}" with coverUrl: ${book.coverUrl}`);
            // Get absolute path from cover URL (expects /local-files/... format)
            const fullPath = getAbsoluteFilePath(book.coverUrl);
            console.log(`[Re-extract Colors] Full path resolved to: ${fullPath}`);
            
            if (fullPath && fsSync.existsSync(fullPath)) {
              const coverBuffer = await fs.readFile(fullPath);
              console.log(`[Re-extract Colors] Read cover file, size: ${coverBuffer.length} bytes`);
              const colors = await extractDominantColorsWithMethod(coverBuffer, method);
              console.log(`[Re-extract Colors] Extracted colors: ${JSON.stringify(colors)}`);
              // dominantColors is stored as JSON string in the database
              await storage.updateBook(book.id, { dominantColors: JSON.stringify(colors) as any });
              booksUpdated++;
            } else {
              console.log(`[Re-extract Colors] Cover file not found or path invalid`);
            }
          }
        } catch (err) {
          console.error(`[Re-extract Colors] Error processing book "${book.title}":`, err);
          errors.push(`Book "${book.title}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Get all audiobooks
      console.log("[Re-extract Colors] Fetching audiobooks...");
      const audiobooks = await storage.getAllAudiobooks();
      console.log(`[Re-extract Colors] Found ${audiobooks.length} audiobooks`);
      
      for (const audiobook of audiobooks) {
        try {
          if (audiobook.coverUrl) {
            console.log(`[Re-extract Colors] Processing audiobook "${audiobook.title}" with coverUrl: ${audiobook.coverUrl}`);
            // Get absolute path from cover URL (expects /local-files/... format)
            const fullPath = getAbsoluteFilePath(audiobook.coverUrl);
            console.log(`[Re-extract Colors] Full path resolved to: ${fullPath}`);
            
            if (fullPath && fsSync.existsSync(fullPath)) {
              const coverBuffer = await fs.readFile(fullPath);
              console.log(`[Re-extract Colors] Read cover file, size: ${coverBuffer.length} bytes`);
              const colors = await extractDominantColorsWithMethod(coverBuffer, method);
              console.log(`[Re-extract Colors] Extracted colors: ${JSON.stringify(colors)}`);
              // dominantColors is stored as JSON string in the database
              await storage.updateAudiobook(audiobook.id, { dominantColors: JSON.stringify(colors) as any });
              audiobooksUpdated++;
            } else {
              console.log(`[Re-extract Colors] Cover file not found or path invalid`);
            }
          }
        } catch (err) {
          console.error(`[Re-extract Colors] Error processing audiobook "${audiobook.title}":`, err);
          errors.push(`Audiobook "${audiobook.title}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      console.log(`[Re-extract Colors] Completed. Updated ${booksUpdated} books, ${audiobooksUpdated} audiobooks using ${method} method. Errors: ${errors.length}`);
      
      res.json({
        method,
        booksUpdated,
        audiobooksUpdated,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("[Re-extract Colors] Fatal error:", error);
      res.status(500).json({ error: "Failed to re-extract colors" });
    }
  });

  // API Keys/Secrets (stored in /config directory for Docker persistence)
  app.get("/api/config/secrets", async (req, res) => {
    try {
      const secrets = loadSecrets();
      // Return which secrets are configured (not the actual values)
      const configured: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(secrets)) {
        configured[key] = !!value;
      }
      res.json({ configured });
    } catch (error) {
      console.error("Error getting secrets status:", error);
      res.status(500).json({ error: "Failed to get secrets status" });
    }
  });

  app.put("/api/config/secrets", async (req, res) => {
    try {
      const updates = req.body as Partial<AppSecrets>;
      saveSecrets(updates);
      
      // Return which secrets are now configured
      const secrets = loadSecrets();
      const configured: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(secrets)) {
        configured[key] = !!value;
      }
      res.json({ configured, message: "Secrets updated successfully" });
    } catch (error) {
      console.error("Error updating secrets:", error);
      res.status(500).json({ error: "Failed to update secrets" });
    }
  });

  // File Scanner endpoints
  const { scanDirectory, scanWatchDirectories, getScanProgress } = await import("./file-scanner");

  app.get("/api/scanner/status", async (req, res) => {
    try {
      const progress = getScanProgress();
      res.json(progress);
    } catch (error: any) {
      console.error("Error getting scanner status:", error);
      res.status(500).json({ error: "Failed to get scanner status" });
    }
  });

  app.post("/api/scanner/scan", async (req, res) => {
    try {
      const { directory } = req.body;

      if (directory) {
        const result = await scanDirectory(directory);
        res.json(result);
      } else {
        const results = await scanWatchDirectories();
        res.json({
          scannedFiles: results.reduce((acc, r) => acc + r.scannedFiles, 0),
          importedBooks: results.reduce((acc, r) => acc + r.importedBooks, 0),
          importedAudiobooks: results.reduce((acc, r) => acc + r.importedAudiobooks, 0),
          duplicatesSkipped: results.reduce((acc, r) => acc + r.duplicatesSkipped, 0),
          errors: results.flatMap((r) => r.errors),
        });
      }
    } catch (error: any) {
      console.error("Error scanning directory:", error);
      res.status(500).json({ error: error.message || "Failed to scan directory" });
    }
  });

  app.post("/api/scanner/scan-directory", async (req, res) => {
    try {
      const { directory } = req.body;

      if (!directory) {
        return res.status(400).json({ error: "Directory path is required" });
      }

      const result = await scanDirectory(directory);
      res.json(result);
    } catch (error: any) {
      console.error("Error scanning directory:", error);
      res.status(500).json({ error: error.message || "Failed to scan directory" });
    }
  });

  // Anna's Archive Integration endpoints
  app.get("/api/integrations/annas-archive/search", async (req, res) => {
    try {
      // Function to get API type from settings
      const getApiType = async (): Promise<'rapidapi' | 'direct' | null> => {
        const setting = await storage.getSetting("annasArchiveApiType");
        if (!setting || !setting.value) {
          console.log('[Routes] No API type found in settings, defaulting to rapidapi');
          return 'rapidapi';
        }
        console.log('[Routes] API type:', setting.value);
        return setting.value as 'rapidapi' | 'direct';
      };

      // Function to get API key from settings
      const getApiKey = async () => {
        const setting = await storage.getSetting("annasArchiveApiKey");
        if (!setting || !setting.value) {
          console.log('[Routes] No API key found in settings');
          return null;
        }
        const key = setting.isSecret ? decrypt(setting.value) : setting.value;
        console.log('[Routes] API key:', key ? 'configured' : 'none');
        return key;
      };

      // Function to get donator key from settings
      const getDonatorKey = async () => {
        const setting = await storage.getSetting("annasArchiveDonatorKey");
        if (!setting || !setting.value) {
          console.log('[Routes] No donator key found in settings');
          return null;
        }
        const key = setting.isSecret ? decrypt(setting.value) : setting.value;
        console.log('[Routes] Donator key:', key ? 'configured' : 'none');
        return key;
      };
      
      const orchestrator = await getSourceOrchestrator({ getApiKey, getDonatorKey, getApiType });
      
      // Get search parameters
      const { query, language, format, limit } = req.query;
      
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query parameter is required" });
      }
      
      const results = await orchestrator.search({
        query,
        language: typeof language === "string" ? language : "en",
        format: typeof format === "string" ? format : "epub",
        limit: typeof limit === "string" ? parseInt(limit) : 25,
      });
      
      res.json(results);
    } catch (error: any) {
      console.error("Error searching Anna's Archive:", error);
      res.status(500).json({ error: error.message || "Failed to search Anna's Archive" });
    }
  });

  app.post("/api/integrations/annas-archive/download", async (req, res) => {
    try {
      const { md5, title, author, format, cover_url } = req.body;
      
      if (!md5) {
        return res.status(400).json({ error: "MD5 hash is required" });
      }
      
      // Function to get API type from settings
      const getApiType = async (): Promise<'rapidapi' | 'direct' | null> => {
        const setting = await storage.getSetting("annasArchiveApiType");
        if (!setting || !setting.value) {
          return 'rapidapi';
        }
        return setting.value as 'rapidapi' | 'direct';
      };

      // Function to get API key from settings
      const getApiKey = async () => {
        const setting = await storage.getSetting("annasArchiveApiKey");
        if (!setting || !setting.value) {
          return null;
        }
        return setting.isSecret ? decrypt(setting.value) : setting.value;
      };

      // Function to get donator key from settings
      const getDonatorKey = async () => {
        const setting = await storage.getSetting("annasArchiveDonatorKey");
        if (!setting || !setting.value) {
          return null;
        }
        return setting.isSecret ? decrypt(setting.value) : setting.value;
      };
      
      const orchestrator = await getSourceOrchestrator({ getApiKey, getDonatorKey, getApiType });
      
      // Download the book using orchestrator (tries all sources with fallbacks)
      // Pass metadata to enable direct mirror downloads without scraping
      const downloadResult = await orchestrator.downloadById(md5, 'anna', {
        title,
        author,
        format,
        cover_url,
      });
      const fileBuffer = downloadResult.buffer;
      
      // Save to local storage
      const fileExtension = `.${format || 'epub'}`;
      const filePath = await saveLocalFileWithName(fileBuffer, 'books', `${title || 'book'}${fileExtension}`);
      
      const filename = `${title || 'book'}.${format || 'epub'}`;
      
      // Extract metadata from file buffer
      const metadata = await extractMetadataFromBuffer(fileBuffer, filename);
      
      // Extract dominant colors from cover if available (serialize to JSON for SQLite)
      let dominantColors: string | undefined;
      let coverUrl: string | undefined;
      
      // Try to download and use the cover from the API search result first
      if (cover_url) {
        try {
          const coverResponse = await fetch(cover_url);
          if (coverResponse.ok) {
            const rawCoverBuffer = Buffer.from(await coverResponse.arrayBuffer());
            
            // Extract dominant colors from the downloaded cover
            const colors = await extractColorsWithSettings(rawCoverBuffer);
            if (colors && colors.length > 0) {
              dominantColors = JSON.stringify(colors);
            }
            
            // Optimize cover before saving
            let coverBuffer = rawCoverBuffer;
            try {
              coverBuffer = await optimizeCover(rawCoverBuffer, {
                maxWidth: 600,
                maxHeight: 900,
                quality: 85,
                format: "webp",
              });
              console.log(`[annas-archive] Optimized cover: ${rawCoverBuffer.length} -> ${coverBuffer.length} bytes`);
            } catch (optError) {
              console.warn("[annas-archive] Failed to optimize cover, using original:", optError);
            }
            
            // Save cover to local storage
            coverUrl = await saveLocalFile(coverBuffer, 'covers', '.webp');
          }
        } catch (coverError) {
          console.error("Failed to download cover from API, will try metadata extraction:", coverError);
        }
      }
      
      // Fallback to metadata extraction if no cover from API
      if (!coverUrl && metadata.coverImageData) {
        const colors = await extractColorsWithSettings(metadata.coverImageData);
        if (colors && colors.length > 0) {
          dominantColors = JSON.stringify(colors);
        }
        
        // Optimize and save cover
        let coverData = metadata.coverImageData;
        try {
          coverData = await optimizeCover(metadata.coverImageData, {
            maxWidth: 600,
            maxHeight: 900,
            quality: 85,
            format: "webp",
          });
          console.log(`[annas-archive] Optimized metadata cover: ${metadata.coverImageData.length} -> ${coverData.length} bytes`);
        } catch (optError) {
          console.warn("[annas-archive] Failed to optimize metadata cover, using original:", optError);
        }
        
        coverUrl = await saveLocalFile(coverData, 'covers', '.webp');
      }
      
      // Create book record
      const bookData = {
        title: metadata.title || title || "Unknown",
        author: metadata.author || author,
        description: metadata.description,
        publisher: metadata.publisher,
        publishedDate: metadata.publishedYear ? String(metadata.publishedYear) : undefined,
        language: metadata.language,
        isbn: metadata.isbn,
        format: format || "epub",
        pageCount: metadata.pageCount,
        filePath,
        coverUrl,
        dominantColors,
        source: "annas-archive",
        sourceId: md5,
        tags: metadata.tags ? JSON.stringify(metadata.tags) : undefined,
      };
      
      const book = await storage.createBook(bookData);
      
      res.status(201).json({ success: true, book });
    } catch (error: any) {
      console.error("Error downloading from Anna's Archive:", error);
      res.status(500).json({ error: error.message || "Failed to download book" });
    }
  });

  // Highlights routes
  app.get("/api/books/:bookId/highlights", async (req, res) => {
    try {
      const { bookId } = req.params;
      const highlights = await storage.getHighlights(bookId);
      res.json(highlights);
    } catch (error: any) {
      console.error("Error getting highlights:", error);
      res.status(500).json({ error: error.message || "Failed to get highlights" });
    }
  });

  app.post("/api/highlights", async (req, res) => {
    try {
      const result = insertHighlightSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ error: validationError.message });
      }
      const highlight = await storage.createHighlight(result.data);
      res.status(201).json(highlight);
    } catch (error: any) {
      console.error("Error creating highlight:", error);
      res.status(500).json({ error: error.message || "Failed to create highlight" });
    }
  });

  app.patch("/api/highlights/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const highlight = await storage.updateHighlight(id, req.body);
      if (!highlight) {
        return res.status(404).json({ error: "Highlight not found" });
      }
      res.json(highlight);
    } catch (error: any) {
      console.error("Error updating highlight:", error);
      res.status(500).json({ error: error.message || "Failed to update highlight" });
    }
  });

  app.delete("/api/highlights/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteHighlight(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting highlight:", error);
      res.status(500).json({ error: error.message || "Failed to delete highlight" });
    }
  });

  // Annotations routes
  // Get all annotations for all highlights in a book
  app.get("/api/books/:bookId/annotations", async (req, res) => {
    try {
      const { bookId } = req.params;
      const annotations = await storage.getAnnotationsForBook(bookId);
      res.json(annotations);
    } catch (error: any) {
      console.error("Error getting annotations for book:", error);
      res.status(500).json({ error: error.message || "Failed to get annotations for book" });
    }
  });

  app.get("/api/highlights/:highlightId/annotations", async (req, res) => {
    try {
      const { highlightId } = req.params;
      const annotations = await storage.getAnnotations(highlightId);
      res.json(annotations);
    } catch (error: any) {
      console.error("Error getting annotations:", error);
      res.status(500).json({ error: error.message || "Failed to get annotations" });
    }
  });

  app.post("/api/annotations", async (req, res) => {
    try {
      const result = insertAnnotationSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ error: validationError.message });
      }
      const annotation = await storage.createAnnotation(result.data);
      res.status(201).json(annotation);
    } catch (error: any) {
      console.error("Error creating annotation:", error);
      res.status(500).json({ error: error.message || "Failed to create annotation" });
    }
  });

  app.patch("/api/annotations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const annotation = await storage.updateAnnotation(id, req.body);
      if (!annotation) {
        return res.status(404).json({ error: "Annotation not found" });
      }
      res.json(annotation);
    } catch (error: any) {
      console.error("Error updating annotation:", error);
      res.status(500).json({ error: error.message || "Failed to update annotation" });
    }
  });

  app.delete("/api/annotations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAnnotation(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting annotation:", error);
      res.status(500).json({ error: error.message || "Failed to delete annotation" });
    }
  });

  // Dictionary lookup proxy route
  app.get("/api/dictionary/:word", async (req, res) => {
    try {
      const { word } = req.params;
      const cleanWord = word.trim().toLowerCase();
      
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
      
      if (!response.ok) {
        return res.status(404).json({ error: 'Word not found' });
      }
      
      const data = await response.json();
      res.json(data[0]);
    } catch (error: any) {
      console.error("Error fetching dictionary definition:", error);
      res.status(500).json({ error: error.message || "Failed to fetch definition" });
    }
  });

  // Reader Preferences routes
  app.get("/api/reader-preferences", async (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'default';
      const preferences = await storage.getReaderPreferences(userId);
      
      // Return default preferences if none exist
      if (!preferences) {
        return res.json({
          userId,
          fontSize: 16,
          fontFamily: 'serif',
          lineHeight: 1.6,
          theme: 'light',
          backgroundColor: '#ffffff',
          textColor: '#000000',
          linkColor: '#0066cc',
          brightness: 100,
        });
      }
      
      res.json(preferences);
    } catch (error: any) {
      console.error("Error getting reader preferences:", error);
      res.status(500).json({ error: error.message || "Failed to get reader preferences" });
    }
  });

  app.post("/api/reader-preferences", async (req, res) => {
    try {
      const result = insertReaderPreferencesSchema.safeParse(req.body);
      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ error: validationError.message });
      }
      const preferences = await storage.upsertReaderPreferences(result.data);
      res.json(preferences);
    } catch (error: any) {
      console.error("Error saving reader preferences:", error);
      res.status(500).json({ error: error.message || "Failed to save reader preferences" });
    }
  });

  // API Integration routes
  app.post("/api/integrations/validate-google-books", async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ valid: false, error: "API key required" });
      }

      const { validateGoogleBooksApiKey } = await import("./services/googleBooksAdapter");
      const result = await validateGoogleBooksApiKey(apiKey);
      
      res.json(result);
    } catch (error: any) {
      console.error("Error validating Google Books API key:", error);
      res.status(500).json({ valid: false, error: error.message || "Validation failed" });
    }
  });

  // ISBN Metadata Lookup route
  // Simple in-memory cache for ISBN lookups (1 hour TTL)
  const isbnCache = new Map<string, { data: any; expiresAt: number }>();
  
  app.get("/api/metadata/isbn/:isbn", async (req, res) => {
    try {
      const rawIsbn = req.params.isbn;
      
      // Normalize ISBN: remove dashes, spaces, and convert to uppercase
      const isbn = rawIsbn.replace(/[-\s]/g, '').toUpperCase();
      
      // Validate ISBN format (10 or 13 digits)
      const isValidIsbn10 = /^[0-9]{9}[0-9X]$/.test(isbn);
      const isValidIsbn13 = /^[0-9]{13}$/.test(isbn);
      
      if (!isValidIsbn10 && !isValidIsbn13) {
        return res.status(400).json({ 
          error: "Invalid ISBN format",
          message: "Please enter a valid ISBN-10 or ISBN-13"
        });
      }
      
      // Check cache first
      const cached = isbnCache.get(isbn);
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`[ISBN Lookup] Cache hit for ${isbn}`);
        return res.json(cached.data);
      }
      
      console.log(`[ISBN Lookup] Fetching metadata for ISBN: ${isbn}`);
      
      // Try Open Library API first (free, no key required)
      let metadata = null;
      
      try {
        const openLibraryUrl = `https://openlibrary.org/isbn/${isbn}.json`;
        const olResponse = await fetch(openLibraryUrl);
        
        if (olResponse.ok) {
          const olData = await olResponse.json();
          
          // Fetch additional work data for description
          let description = '';
          let subjects: string[] = [];
          
          if (olData.works && olData.works[0]?.key) {
            try {
              const workResponse = await fetch(`https://openlibrary.org${olData.works[0].key}.json`);
              if (workResponse.ok) {
                const workData = await workResponse.json();
                description = typeof workData.description === 'string' 
                  ? workData.description 
                  : workData.description?.value || '';
                subjects = workData.subjects?.slice(0, 10) || [];
              }
            } catch (workErr) {
              console.warn('[ISBN Lookup] Could not fetch work data:', workErr);
            }
          }
          
          // Fetch author names
          let authors: string[] = [];
          if (olData.authors && olData.authors.length > 0) {
            for (const author of olData.authors.slice(0, 5)) {
              try {
                const authorResponse = await fetch(`https://openlibrary.org${author.key}.json`);
                if (authorResponse.ok) {
                  const authorData = await authorResponse.json();
                  if (authorData.name) {
                    authors.push(authorData.name);
                  }
                }
              } catch (authorErr) {
                console.warn('[ISBN Lookup] Could not fetch author:', authorErr);
              }
            }
          }
          
          // Build cover URL
          let coverUrl = null;
          if (olData.covers && olData.covers[0]) {
            coverUrl = `https://covers.openlibrary.org/b/id/${olData.covers[0]}-L.jpg`;
          }
          
          // Check if description appears to be non-English (contains Spanish/non-ASCII patterns)
          const isNonEnglishDescription = description && (
            /[áéíóúüñ¿¡]/i.test(description) || // Spanish characters
            /[àâäçèêëïîôùûü]/i.test(description) || // French characters
            /[äöüß]/i.test(description) // German characters
          );
          
          const detectedLanguage = olData.languages?.[0]?.key?.replace('/languages/', '') || null;
          const isEnglishEdition = !detectedLanguage || detectedLanguage === 'eng' || detectedLanguage === 'en';
          
          // Only use Open Library result if it appears to be English
          if (isEnglishEdition && !isNonEnglishDescription) {
            metadata = {
              title: olData.title || null,
              author: authors.join(', ') || null,
              description: description || null,
              publisher: olData.publishers?.[0] || null,
              publishedDate: olData.publish_date || null,
              pageCount: olData.number_of_pages || null,
              language: detectedLanguage,
              isbn10: olData.isbn_10?.[0] || (isValidIsbn10 ? isbn : null),
              isbn13: olData.isbn_13?.[0] || (isValidIsbn13 ? isbn : null),
              coverUrl: coverUrl,
              tags: subjects,
              source: 'openlibrary'
            };
            
            console.log(`[ISBN Lookup] Found on Open Library: ${metadata.title}`);
          } else {
            console.log(`[ISBN Lookup] Open Library returned non-English content (lang: ${detectedLanguage}), trying Google Books...`);
          }
        }
      } catch (olErr) {
        console.warn('[ISBN Lookup] Open Library error:', olErr);
      }
      
      // If Open Library didn't find it or returned non-English, try Google Books API
      if (!metadata) {
        try {
          // Try with API key first if available, otherwise use without (rate limited)
          const userId = (req as any).user?.id || 'default';
          const apiKeySetting = await storage.getIntegrationSetting(`user:${userId}:googleBooksApiKey`);
          
          let googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
          if (apiKeySetting?.value) {
            const apiKey = apiKeySetting.isSecret ? decrypt(apiKeySetting.value) : apiKeySetting.value;
            googleUrl += `&key=${apiKey}`;
          }
          
          const googleResponse = await fetch(googleUrl);
          
          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            
            if (googleData.items && googleData.items.length > 0) {
              const volumeInfo = googleData.items[0].volumeInfo;
              
              metadata = {
                title: volumeInfo.title || null,
                author: volumeInfo.authors?.join(', ') || null,
                description: volumeInfo.description || null,
                publisher: volumeInfo.publisher || null,
                publishedDate: volumeInfo.publishedDate || null,
                pageCount: volumeInfo.pageCount || null,
                language: volumeInfo.language || null,
                isbn10: volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')?.identifier || null,
                isbn13: volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier || null,
                coverUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
                tags: volumeInfo.categories || [],
                source: 'googlebooks'
              };
              
              console.log(`[ISBN Lookup] Found on Google Books: ${metadata.title}`);
            }
          }
        } catch (googleErr) {
          console.warn('[ISBN Lookup] Google Books error:', googleErr);
        }
      }
      
      if (!metadata) {
        return res.status(404).json({ 
          error: "Book not found",
          message: "Could not find metadata for this ISBN. Please enter the information manually."
        });
      }
      
      // Cache the result for 1 hour
      isbnCache.set(isbn, { 
        data: metadata, 
        expiresAt: Date.now() + 60 * 60 * 1000 
      });
      
      // Clean up old cache entries periodically
      if (isbnCache.size > 1000) {
        const now = Date.now();
        for (const [key, value] of isbnCache.entries()) {
          if (value.expiresAt < now) {
            isbnCache.delete(key);
          }
        }
      }
      
      res.json(metadata);
    } catch (error: any) {
      console.error('[ISBN Lookup] Error:', error);
      res.status(500).json({ 
        error: "Lookup failed",
        message: error.message || "Failed to fetch book metadata"
      });
    }
  });

  // Recommendations routes
  app.get("/api/recommendations", async (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'default';
      const forceRefresh = req.query.refresh === 'true';
      
      // Get user's Google Books API key
      const apiKeySetting = await storage.getIntegrationSetting(`user:${userId}:googleBooksApiKey`);
      if (!apiKeySetting || !apiKeySetting.value) {
        return res.status(400).json({ 
          error: "Google Books API key not configured",
          needsSetup: true 
        });
      }

      const apiKey = apiKeySetting.isSecret ? decrypt(apiKeySetting.value) : apiKeySetting.value;

      // Get user's library
      const books = await storage.getAllBooks();
      const audiobooks = await storage.getAllAudiobooks();

      // Check cache first (skip if force refresh)
      const { generateCacheKey, analyzeLibrary, fetchRecommendations, scoreRecommendations, diversifyRecommendations, addRecommendationReasons } = 
        await import("./services/recommendationEngine");
      
      const cacheKey = generateCacheKey(books, audiobooks, userId);
      
      if (!forceRefresh) {
        const cached = await storage.getRecommendationCache(userId, cacheKey);
        
        if (cached && new Date(cached.expiresAt) > new Date()) {
          console.log('[Recommendations] Serving from cache');
          return res.json(JSON.parse(cached.recommendations));
        }
      }

      // Generate new recommendations
      console.log('[Recommendations] Generating fresh recommendations');
      const profile = analyzeLibrary(books, audiobooks);
      const recommendations = await fetchRecommendations(profile, apiKey, 50);

      // Score and filter recommendations
      const existingItems = new Set<string>();
      for (const book of books) {
        if (book.isbn) existingItems.add(book.isbn);
        existingItems.add(book.title.toLowerCase());
      }
      for (const audiobook of audiobooks) {
        if (audiobook.isbn) existingItems.add(audiobook.isbn);
        existingItems.add(audiobook.title.toLowerCase());
      }

      const scored = scoreRecommendations(recommendations, profile, existingItems);
      
      // Apply diversity (max 3 books per author) and add reasons
      const diversified = diversifyRecommendations(scored, 3);
      const withReasons = addRecommendationReasons(diversified, profile);
      
      // Limit to 30 recommendations
      const finalRecommendations = withReasons.slice(0, 30);

      // Cache the results (24 hour TTL)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.saveRecommendationCache({
        userId,
        cacheKey,
        recommendations: JSON.stringify(finalRecommendations),
        expiresAt,
      });

      res.json(finalRecommendations);
    } catch (error: any) {
      console.error("Error getting recommendations:", error);
      res.status(500).json({ error: error.message || "Failed to get recommendations" });
    }
  });
  
  // Clear recommendations cache
  app.delete("/api/recommendations/cache", async (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'default';
      await storage.clearRecommendationCache(userId);
      console.log(`[Recommendations] Cache cleared for user ${userId}`);
      res.json({ success: true, message: "Recommendations cache cleared" });
    } catch (error: any) {
      console.error("Error clearing recommendations cache:", error);
      res.status(500).json({ error: error.message || "Failed to clear cache" });
    }
  });

  // User Ratings routes
  app.get("/api/ratings", async (req, res) => {
    try {
      const userId = (req.query.userId as string) || 'default';
      const itemId = req.query.itemId as string;
      
      if (itemId) {
        const rating = await storage.getUserRating(userId, itemId);
        return res.json(rating);
      }
      
      const ratings = await storage.getAllUserRatings(userId);
      res.json(ratings);
    } catch (error: any) {
      console.error("Error getting ratings:", error);
      res.status(500).json({ error: error.message || "Failed to get ratings" });
    }
  });

  app.post("/api/ratings", async (req, res) => {
    try {
      const { userId = 'default', itemId, itemType, rating, review } = req.body;
      
      if (!itemId || !itemType || rating === undefined) {
        return res.status(400).json({ error: "itemId, itemType, and rating are required" });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      const userRating = await storage.upsertUserRating({
        userId,
        itemId,
        itemType,
        rating,
        review: review || null,
        syncStatus: 'pending',
      });

      res.json(userRating);
    } catch (error: any) {
      console.error("Error saving rating:", error);
      res.status(500).json({ error: error.message || "Failed to save rating" });
    }
  });

  app.delete("/api/ratings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUserRating(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting rating:", error);
      res.status(500).json({ error: error.message || "Failed to delete rating" });
    }
  });

  // Export notes/highlights endpoint
  app.get("/api/exports/notes", async (req, res) => {
    try {
      const { bookId, format = 'json' } = req.query as { bookId?: string; format?: 'json' | 'markdown' | 'text' };
      
      interface ExportedNote {
        bookTitle: string;
        bookAuthor?: string | null;
        highlights: Array<{
          text: string;
          color: string;
          createdAt: Date | null;
          notes: Array<{
            text: string;
            createdAt: Date | null;
          }>;
        }>;
        bookmarks: Array<{
          note?: string | null;
          createdAt: Date | null;
        }>;
      }

      let exportData: ExportedNote[] = [];

      if (bookId) {
        // Export for a single book
        const book = await storage.getBookById(bookId);
        if (!book) {
          return res.status(404).json({ error: "Book not found" });
        }

        const highlights = await storage.getHighlights(bookId);
        const bookmarks = await storage.getBookmarks(bookId, 'book');

        exportData.push({
          bookTitle: book.title,
          bookAuthor: book.author,
          highlights: highlights.map(h => ({
            text: h.selectedText,
            color: h.color,
            createdAt: h.createdAt,
            notes: (h.annotations || []).map(a => ({
              text: a.note,
              createdAt: a.createdAt,
            })),
          })),
          bookmarks: bookmarks.filter(b => b.note).map(b => ({
            note: b.note,
            createdAt: b.createdAt,
          })),
        });
      } else {
        // Export for all books
        const books = await storage.getAllBooks();
        
        for (const book of books) {
          const highlights = await storage.getHighlights(book.id);
          const bookmarks = await storage.getBookmarks(book.id, 'book');

          // Only include books that have highlights or bookmarks with notes
          if (highlights.length > 0 || bookmarks.some(b => b.note)) {
            exportData.push({
              bookTitle: book.title,
              bookAuthor: book.author,
              highlights: highlights.map(h => ({
                text: h.selectedText,
                color: h.color,
                createdAt: h.createdAt,
                notes: (h.annotations || []).map(a => ({
                  text: a.note,
                  createdAt: a.createdAt,
                })),
              })),
              bookmarks: bookmarks.filter(b => b.note).map(b => ({
                note: b.note,
                createdAt: b.createdAt,
              })),
            });
          }
        }
      }

      // Format the response based on requested format
      if (format === 'markdown') {
        let markdown = '# My Reading Notes\n\n';
        markdown += `*Exported on ${new Date().toLocaleDateString()}*\n\n`;

        for (const book of exportData) {
          markdown += `## ${book.bookTitle}\n`;
          if (book.bookAuthor) {
            markdown += `*by ${book.bookAuthor}*\n`;
          }
          markdown += '\n';

          if (book.highlights.length > 0) {
            markdown += '### Highlights\n\n';
            for (const h of book.highlights) {
              markdown += `> ${h.text}\n\n`;
              for (const note of h.notes) {
                markdown += `**Note:** ${note.text}\n\n`;
              }
            }
          }

          if (book.bookmarks.length > 0) {
            markdown += '### Bookmarks\n\n';
            for (const b of book.bookmarks) {
              if (b.note) {
                markdown += `- ${b.note}\n`;
              }
            }
            markdown += '\n';
          }

          markdown += '---\n\n';
        }

        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="reading-notes.md"');
        return res.send(markdown);
      }

      if (format === 'text') {
        let text = 'MY READING NOTES\n';
        text += `Exported on ${new Date().toLocaleDateString()}\n`;
        text += '='.repeat(50) + '\n\n';

        for (const book of exportData) {
          text += `${book.bookTitle.toUpperCase()}\n`;
          if (book.bookAuthor) {
            text += `by ${book.bookAuthor}\n`;
          }
          text += '-'.repeat(40) + '\n\n';

          if (book.highlights.length > 0) {
            text += 'HIGHLIGHTS:\n\n';
            for (const h of book.highlights) {
              text += `"${h.text}"\n`;
              for (const note of h.notes) {
                text += `  Note: ${note.text}\n`;
              }
              text += '\n';
            }
          }

          if (book.bookmarks.length > 0) {
            text += 'BOOKMARKS:\n';
            for (const b of book.bookmarks) {
              if (b.note) {
                text += `• ${b.note}\n`;
              }
            }
            text += '\n';
          }

          text += '\n';
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="reading-notes.txt"');
        return res.send(text);
      }

      // Default: JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="reading-notes.json"');
      res.json({
        exportedAt: new Date().toISOString(),
        books: exportData,
      });
    } catch (error: any) {
      console.error("Error exporting notes:", error);
      res.status(500).json({ error: error.message || "Failed to export notes" });
    }
  });

  // Book/Audiobook delivery endpoints
  app.post("/api/delivery/kindle", async (req, res) => {
    try {
      const { bookId, kindleEmail } = req.body;
      
      if (!bookId || !kindleEmail) {
        return res.status(400).json({ error: "bookId and kindleEmail are required" });
      }

      const result = await deliveryService.sendToKindle(bookId, kindleEmail);
      
      if (result.success) {
        res.json({ success: true, message: "Book sent to Kindle successfully", jobId: result.jobId });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error("Error sending to Kindle:", error);
      res.status(500).json({ error: error.message || "Failed to send to Kindle" });
    }
  });

  app.post("/api/delivery/email", async (req, res) => {
    try {
      const { bookId, email } = req.body;
      
      if (!bookId || !email) {
        return res.status(400).json({ error: "bookId and email are required" });
      }

      const result = await deliveryService.sendToEmail(bookId, email);
      
      if (result.success) {
        res.json({ success: true, message: "Book sent via email successfully", jobId: result.jobId });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  app.get("/api/delivery/status/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const status = await deliveryService.getDeliveryStatus(jobId);
      
      if (status) {
        res.json(status);
      } else {
        res.status(404).json({ error: "Delivery job not found" });
      }
    } catch (error: any) {
      console.error("Error getting delivery status:", error);
      res.status(500).json({ error: error.message || "Failed to get delivery status" });
    }
  });

  // Calibre Import endpoints
  app.post("/api/calibre/validate", async (req, res) => {
    try {
      const { libraryPath } = req.body;
      
      if (!libraryPath) {
        return res.status(400).json({ error: "libraryPath is required" });
      }

      const result = await calibreService.validateLibraryPath(libraryPath);
      res.json(result);
    } catch (error: any) {
      console.error("Error validating Calibre library:", error);
      res.status(500).json({ error: error.message || "Failed to validate library" });
    }
  });

  app.post("/api/calibre/scan", async (req, res) => {
    try {
      const { libraryPath } = req.body;
      
      if (!libraryPath) {
        return res.status(400).json({ error: "libraryPath is required" });
      }

      const result = await calibreService.scanLibrary(libraryPath);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error: any) {
      console.error("Error scanning Calibre library:", error);
      res.status(500).json({ error: error.message || "Failed to scan library" });
    }
  });

  app.post("/api/calibre/import", async (req, res) => {
    try {
      const { libraryPath, bookIds, libraryName } = req.body;
      
      if (!libraryPath) {
        return res.status(400).json({ error: "libraryPath is required" });
      }

      // Register the library first if not already registered
      const libraries = await storage.getCalibreLibraries();
      const existingLibrary = libraries.find(lib => lib.path === libraryPath);
      
      if (!existingLibrary) {
        const name = libraryName || path.basename(libraryPath) || "Calibre Library";
        await storage.createCalibreLibrary({ name, path: libraryPath });
      } else {
        // Update lastSyncedAt timestamp
        await storage.updateCalibreLibrary(existingLibrary.id, { 
          lastSyncedAt: new Date() 
        });
      }

      const result = await calibreService.importBooks(libraryPath, bookIds);
      res.json(result);
    } catch (error: any) {
      console.error("Error importing from Calibre:", error);
      res.status(500).json({ error: error.message || "Failed to import books" });
    }
  });

  app.get("/api/calibre/libraries", async (_req, res) => {
    try {
      const libraries = await calibreService.getLibraries();
      res.json(libraries);
    } catch (error: any) {
      console.error("Error getting Calibre libraries:", error);
      res.status(500).json({ error: error.message || "Failed to get libraries" });
    }
  });

  app.post("/api/calibre/libraries", async (req, res) => {
    try {
      const { libraryPath, name } = req.body;
      
      if (!libraryPath) {
        return res.status(400).json({ error: "libraryPath is required" });
      }

      const library = await calibreService.registerLibrary(libraryPath, name);
      
      if (library) {
        res.json(library);
      } else {
        res.status(400).json({ error: "Failed to register library" });
      }
    } catch (error: any) {
      console.error("Error registering Calibre library:", error);
      res.status(500).json({ error: error.message || "Failed to register library" });
    }
  });

  app.post("/api/calibre/libraries/:id/sync", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await calibreService.syncLibrary(id);
      res.json(result);
    } catch (error: any) {
      console.error("Error syncing Calibre library:", error);
      res.status(500).json({ error: error.message || "Failed to sync library" });
    }
  });

  app.delete("/api/calibre/libraries/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCalibreLibrary(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting Calibre library:", error);
      res.status(500).json({ error: error.message || "Failed to delete library" });
    }
  });

  // OPDS endpoints
  app.get("/api/opds/sources", async (_req, res) => {
    try {
      const { opdsService } = await import("./services/opdsService");
      const sources = await opdsService.getSources();
      res.json(sources);
    } catch (error: any) {
      console.error("Error getting OPDS sources:", error);
      res.status(500).json({ error: error.message || "Failed to get sources" });
    }
  });

  app.post("/api/opds/sources", async (req, res) => {
    try {
      const { opdsService } = await import("./services/opdsService");
      const { name, url, username, password } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ error: "Name and URL are required" });
      }

      const testResult = await opdsService.testSource(url, username, password);
      if (!testResult.valid) {
        return res.status(400).json({ error: testResult.error || "Invalid OPDS feed" });
      }

      const source = await opdsService.createSource({ name, url, username, password });
      res.json(source);
    } catch (error: any) {
      console.error("Error creating OPDS source:", error);
      res.status(500).json({ error: error.message || "Failed to create source" });
    }
  });

  app.get("/api/opds/sources/:id", async (req, res) => {
    try {
      const { opdsService } = await import("./services/opdsService");
      const source = await opdsService.getSource(req.params.id);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      res.json(source);
    } catch (error: any) {
      console.error("Error getting OPDS source:", error);
      res.status(500).json({ error: error.message || "Failed to get source" });
    }
  });

  app.patch("/api/opds/sources/:id", async (req, res) => {
    try {
      const { opdsService } = await import("./services/opdsService");
      const { name, url, username, password } = req.body;
      
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (url !== undefined) updates.url = url;
      if (username !== undefined) updates.username = username;
      if (password !== undefined) updates.password = password;

      const source = await opdsService.updateSource(req.params.id, updates);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      res.json(source);
    } catch (error: any) {
      console.error("Error updating OPDS source:", error);
      res.status(500).json({ error: error.message || "Failed to update source" });
    }
  });

  app.delete("/api/opds/sources/:id", async (req, res) => {
    try {
      const { opdsService } = await import("./services/opdsService");
      await opdsService.deleteSource(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting OPDS source:", error);
      res.status(500).json({ error: error.message || "Failed to delete source" });
    }
  });

  app.post("/api/opds/sources/:id/test", async (req, res) => {
    try {
      const { opdsService } = await import("./services/opdsService");
      const source = await opdsService.getSource(req.params.id);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }

      const result = await opdsService.testSource(source.url, source.username ?? undefined, source.password ?? undefined);
      res.json(result);
    } catch (error: any) {
      console.error("Error testing OPDS source:", error);
      res.status(500).json({ error: error.message || "Failed to test source" });
    }
  });

  app.post("/api/opds/browse", async (req, res) => {
    try {
      const { opdsService } = await import("./services/opdsService");
      const { url, sourceId } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      let source: any;
      if (sourceId) {
        source = await opdsService.getSource(sourceId);
      }

      const result = await opdsService.fetchFeed(url, source);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const navigation = opdsService.getNavigationLinks(result.feed!);
      
      const entries = result.feed!.entries.map(entry => ({
        ...entry,
        isNavigation: opdsService.isNavigationEntry(entry),
        subsectionLinks: opdsService.getSubsectionLinks(entry),
        acquisitionLinks: opdsService.getAcquisitionLinks(entry),
      }));

      res.json({
        feed: {
          ...result.feed,
          entries,
        },
        navigation,
      });
    } catch (error: any) {
      console.error("Error browsing OPDS feed:", error);
      res.status(500).json({ error: error.message || "Failed to browse feed" });
    }
  });

  app.post("/api/opds/download", async (req, res) => {
    try {
      const { opdsService } = await import("./services/opdsService");
      const { extractMetadataFromBuffer } = await import("./metadata");
      const { url, sourceId, title } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      let source: any;
      if (sourceId) {
        source = await opdsService.getSource(sourceId);
      }

      const result = await opdsService.downloadBook(url, source);
      if (!result.success || !result.data) {
        return res.status(400).json({ error: result.error });
      }

      let format = "epub";
      if (result.contentType?.includes("pdf")) format = "pdf";
      else if (result.contentType?.includes("mobi") || result.contentType?.includes("mobipocket")) format = "mobi";

      let coverUrl: string | undefined;
      let extractedMetadata: any = {};

      // Save file to local storage
      const filePath = await saveLocalFile(result.data, 'books', `.${format}`);
      
      try {
        const filename = result.filename || `book.${format}`;
        extractedMetadata = await extractMetadataFromBuffer(result.data, filename);
        
        if (extractedMetadata.coverImageData) {
          coverUrl = await saveLocalFile(extractedMetadata.coverImageData, 'covers', '.jpg');
        }
      } catch (metadataError) {
        console.error("Error extracting metadata from OPDS download:", metadataError);
      }

      const bookData = {
        title: title || extractedMetadata.title || result.filename || "Untitled",
        author: extractedMetadata.author,
        filePath,
        coverUrl,
        format: format.toUpperCase(),
        fileSize: result.data.length,
        source: "opds" as const,
        description: extractedMetadata.description,
        language: extractedMetadata.language,
        publisher: extractedMetadata.publisher,
        isbn: extractedMetadata.isbn,
        dominantColors: extractedMetadata.dominantColors,
      };

      const book = await storage.createBook(bookData);

      if (sourceId) {
        await storage.updateOpdsSource(sourceId, { lastSyncedAt: new Date() });
      }

      // Auto-fetch cover if no embedded cover was found
      if (!coverUrl && book.id) {
        try {
          const secrets = await loadSecrets();
          const googleBooksApiKey = secrets?.googleBooksApiKey;
          console.log(`[OPDS] No embedded cover, attempting to fetch from external sources for "${book.title}"`);
          const fetchResult = await fetchCoverForBook(book.id, storage, googleBooksApiKey);
          if (fetchResult.success) {
            console.log(`[OPDS] Successfully fetched cover from ${fetchResult.source}`);
            // Get updated book with cover
            const updatedBook = await storage.getBookById(book.id);
            return res.json({ success: true, book: updatedBook });
          }
        } catch (coverError) {
          console.warn('[OPDS] Auto-cover fetch failed:', coverError);
          // Continue without cover - not a critical error
        }
      }

      res.json({ success: true, book });
    } catch (error: any) {
      console.error("Error downloading from OPDS:", error);
      res.status(500).json({ error: error.message || "Failed to download book" });
    }
  });

  // Backup & Export routes
  app.get("/api/backup/export", async (_req, res) => {
    try {
      const { exportLibraryBackup } = await import("./backup");
      const backupData = await exportLibraryBackup();
      
      const filename = `luma-backup-${new Date().toISOString().split('T')[0]}.json`;
      const jsonData = JSON.stringify(backupData, null, 2);
      
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", Buffer.byteLength(jsonData, 'utf8'));
      res.send(jsonData);
    } catch (error: any) {
      console.error("Error exporting backup:", error);
      res.status(500).json({ error: error.message || "Failed to export backup" });
    }
  });

  app.get("/api/backup/preview", async (_req, res) => {
    try {
      const { exportLibraryBackup } = await import("./backup");
      const backupData = await exportLibraryBackup();
      
      res.json({
        version: backupData.version,
        exportedAt: backupData.exportedAt,
        metadata: backupData.metadata,
      });
    } catch (error: any) {
      console.error("Error generating backup preview:", error);
      res.status(500).json({ error: error.message || "Failed to generate preview" });
    }
  });

  app.post("/api/backup/import", async (req, res) => {
    try {
      const { validateBackupData, importLibraryBackup } = await import("./backup");
      const { data, options } = req.body as { data: any; options?: { skipExisting?: boolean } };
      
      if (!data) {
        return res.status(400).json({ error: "Backup data is required" });
      }

      const dataSize = JSON.stringify(data).length;
      const maxSize = 100 * 1024 * 1024;
      if (dataSize > maxSize) {
        return res.status(413).json({ 
          error: "Backup file too large", 
          details: [`Maximum size is 100MB, received ${(dataSize / 1024 / 1024).toFixed(2)}MB`] 
        });
      }

      const validation = validateBackupData(data);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: "Invalid backup file", 
          details: validation.errors 
        });
      }

      const safeOptions = { skipExisting: options?.skipExisting ?? true };
      const result = await importLibraryBackup(validation.parsedData || data, safeOptions);
      
      res.json(result);
    } catch (error: any) {
      console.error("Error importing backup:", error);
      res.status(500).json({ error: error.message || "Failed to import backup" });
    }
  });

  app.post("/api/backup/validate", async (req, res) => {
    try {
      const { validateBackupData } = await import("./backup");
      const { data } = req.body as { data: any };
      
      if (!data) {
        return res.status(400).json({ error: "Backup data is required" });
      }

      const dataSize = JSON.stringify(data).length;
      const maxSize = 100 * 1024 * 1024;
      if (dataSize > maxSize) {
        return res.status(413).json({ 
          valid: false,
          errors: [`Backup file too large. Maximum size is 100MB, received ${(dataSize / 1024 / 1024).toFixed(2)}MB`] 
        });
      }

      const validation = validateBackupData(data);
      
      if (validation.valid && data.metadata) {
        res.json({
          valid: true,
          metadata: data.metadata,
          version: data.version,
          exportedAt: data.exportedAt,
        });
      } else {
        res.json(validation);
      }
    } catch (error: any) {
      console.error("Error validating backup:", error);
      res.status(500).json({ error: error.message || "Failed to validate backup" });
    }
  });

  // ==================== BOOK CLUBS ====================

  // Get all book clubs
  app.get("/api/book-clubs", async (_req, res) => {
    try {
      const clubs = await storage.getAllBookClubs();
      res.json(clubs);
    } catch (error) {
      console.error("Error getting book clubs:", error);
      res.status(500).json({ error: "Failed to get book clubs" });
    }
  });

  // Get single book club
  app.get("/api/book-clubs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const club = await storage.getBookClubById(id);
      
      if (!club) {
        return res.status(404).json({ error: "Book club not found" });
      }
      
      res.json(club);
    } catch (error) {
      console.error("Error getting book club:", error);
      res.status(500).json({ error: "Failed to get book club" });
    }
  });

  // Create book club
  app.post("/api/book-clubs", async (req, res) => {
    try {
      const { name, description, isPrivate, createdBy } = req.body;
      
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ error: "Club name is required" });
      }

      const club = await storage.createBookClub({
        name: name.trim(),
        description: description || null,
        isPrivate: isPrivate || false,
        createdBy: createdBy || "default",
      });

      // Auto-add creator as admin member
      await storage.addBookClubMember({
        clubId: club.id,
        userId: createdBy || "default",
        role: "admin",
      });

      res.status(201).json(club);
    } catch (error) {
      console.error("Error creating book club:", error);
      res.status(500).json({ error: "Failed to create book club" });
    }
  });

  // Update book club
  app.patch("/api/book-clubs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const club = await storage.updateBookClub(id, updates);
      
      if (!club) {
        return res.status(404).json({ error: "Book club not found" });
      }
      
      res.json(club);
    } catch (error) {
      console.error("Error updating book club:", error);
      res.status(500).json({ error: "Failed to update book club" });
    }
  });

  // Delete book club (creator or admin only)
  app.delete("/api/book-clubs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;
      
      // Get the club to check ownership
      const club = await storage.getBookClubById(id);
      if (!club) {
        return res.status(404).json({ error: "Book club not found" });
      }
      
      // Allow deletion if user is admin or the creator
      const isAdmin = userRole === "admin";
      const isCreator = club.createdBy === userId;
      
      if (!isAdmin && !isCreator) {
        return res.status(403).json({ error: "Only the club creator or an admin can delete this club" });
      }
      
      await storage.deleteBookClub(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting book club:", error);
      res.status(500).json({ error: "Failed to delete book club" });
    }
  });

  // Set current book for club
  app.post("/api/book-clubs/:id/current-book", async (req, res) => {
    try {
      const { id } = req.params;
      const { bookId, bookType, readingDeadline } = req.body;

      const club = await storage.updateBookClub(id, {
        currentBookId: bookId || null,
        currentBookType: bookType || null,
        readingDeadline: readingDeadline ? new Date(readingDeadline) : null,
      });

      if (!club) {
        return res.status(404).json({ error: "Book club not found" });
      }

      res.json(club);
    } catch (error) {
      console.error("Error setting current book:", error);
      res.status(500).json({ error: "Failed to set current book" });
    }
  });

  // ==================== BOOK CLUB MEMBERS ====================

  // Get club members
  app.get("/api/book-clubs/:id/members", async (req, res) => {
    try {
      const { id } = req.params;
      const members = await storage.getBookClubMembers(id);
      res.json(members);
    } catch (error) {
      console.error("Error getting club members:", error);
      res.status(500).json({ error: "Failed to get club members" });
    }
  });

  // Join club
  app.post("/api/book-clubs/:id/join", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, userName } = req.body;
      const userIdToUse = userId || "default";

      // Check if already a member
      const isMember = await storage.isBookClubMember(id, userIdToUse);
      if (isMember) {
        return res.status(400).json({ error: "Already a member of this club" });
      }

      const member = await storage.addBookClubMember({
        clubId: id,
        userId: userIdToUse,
        role: "member",
      });

      res.status(201).json(member);
    } catch (error) {
      console.error("Error joining club:", error);
      res.status(500).json({ error: "Failed to join club" });
    }
  });

  // Leave club
  app.post("/api/book-clubs/:id/leave", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const userIdToUse = userId || "default";

      await storage.removeBookClubMember(id, userIdToUse);
      res.status(204).send();
    } catch (error) {
      console.error("Error leaving club:", error);
      res.status(500).json({ error: "Failed to leave club" });
    }
  });

  // Update member role
  app.patch("/api/book-clubs/:clubId/members/:memberId", async (req, res) => {
    try {
      const { memberId } = req.params;
      const { role } = req.body;

      const member = await storage.updateBookClubMember(memberId, { role });
      
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      res.json(member);
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  // ==================== BOOK CLUB DISCUSSIONS ====================

  // Get club discussion topics (only top-level discussions, not replies)
  app.get("/api/book-clubs/:id/discussions", async (req, res) => {
    try {
      const { id } = req.params;
      const { topicsOnly, bookId } = req.query;
      
      const discussions = await storage.getBookClubDiscussions(id, {
        topicsOnly: topicsOnly === 'true',
        bookId: bookId as string | undefined,
      });
      res.json(discussions);
    } catch (error) {
      console.error("Error getting discussions:", error);
      res.status(500).json({ error: "Failed to get discussions" });
    }
  });

  // Get a specific discussion topic with its replies
  app.get("/api/book-clubs/:clubId/discussions/:topicId", async (req, res) => {
    try {
      const { topicId } = req.params;
      const topic = await storage.getBookClubDiscussionWithReplies(topicId);
      
      if (!topic) {
        return res.status(404).json({ error: "Discussion topic not found" });
      }
      
      res.json(topic);
    } catch (error) {
      console.error("Error getting discussion topic:", error);
      res.status(500).json({ error: "Failed to get discussion topic" });
    }
  });

  // Create discussion topic or reply
  app.post("/api/book-clubs/:id/discussions", async (req, res) => {
    try {
      const { id } = req.params;
      const { content, userId, userName, parentId, bookId, bookType, title, chapterInfo } = req.body;

      if (!content || typeof content !== "string" || content.trim() === "") {
        return res.status(400).json({ error: "Discussion content is required" });
      }

      // If it's a topic (no parentId), title is required
      if (!parentId && (!title || typeof title !== "string" || title.trim() === "")) {
        return res.status(400).json({ error: "Discussion topic title is required" });
      }

      const discussion = await storage.createBookClubDiscussion({
        clubId: id,
        content: content.trim(),
        userId: userId || "default",
        userName: userName || "Anonymous",
        parentId: parentId || null,
        bookId: bookId || null,
        bookType: bookType || null,
        title: parentId ? null : (title?.trim() || null),
        chapterInfo: chapterInfo || null,
      });

      // If this is a reply, increment the parent's reply count
      if (parentId) {
        await storage.incrementDiscussionReplyCount(parentId);
      }

      res.status(201).json(discussion);
    } catch (error) {
      console.error("Error creating discussion:", error);
      res.status(500).json({ error: "Failed to create discussion" });
    }
  });

  // Update discussion post
  app.patch("/api/book-clubs/:clubId/discussions/:discussionId", async (req, res) => {
    try {
      const { discussionId } = req.params;
      const { content } = req.body;

      const discussion = await storage.updateBookClubDiscussion(discussionId, { content });
      
      if (!discussion) {
        return res.status(404).json({ error: "Discussion not found" });
      }
      
      res.json(discussion);
    } catch (error) {
      console.error("Error updating discussion:", error);
      res.status(500).json({ error: "Failed to update discussion" });
    }
  });

  // Delete discussion post
  app.delete("/api/book-clubs/:clubId/discussions/:discussionId", async (req, res) => {
    try {
      const { discussionId } = req.params;
      await storage.deleteBookClubDiscussion(discussionId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting discussion:", error);
      res.status(500).json({ error: "Failed to delete discussion" });
    }
  });

  // ========== Book Club Meetings ==========

  // Get meetings for a club
  app.get("/api/book-clubs/:id/meetings", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'default';
      const meetings = await storage.getBookClubMeetings(id, userId);
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  // Get single meeting with RSVP details
  app.get("/api/book-clubs/:clubId/meetings/:meetingId", async (req, res) => {
    try {
      const { meetingId } = req.params;
      const userId = (req as any).user?.id || 'default';
      const meeting = await storage.getBookClubMeeting(meetingId, userId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error fetching meeting:", error);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  // Create meeting
  app.post("/api/book-clubs/:id/meetings", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'default';
      const { title, description, meetingDate, locationName, address, isVirtual, virtualLink } = req.body;

      if (!title || !meetingDate) {
        return res.status(400).json({ error: "Title and meeting date are required" });
      }

      const meeting = await storage.createBookClubMeeting({
        clubId: id,
        title,
        description,
        meetingDate: new Date(meetingDate),
        locationName,
        address,
        isVirtual: isVirtual || false,
        virtualLink,
        createdBy: userId,
      });

      res.status(201).json(meeting);
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  // Update meeting
  app.patch("/api/book-clubs/:clubId/meetings/:meetingId", async (req, res) => {
    try {
      const { meetingId } = req.params;
      const updates = req.body;

      if (updates.meetingDate) {
        updates.meetingDate = new Date(updates.meetingDate);
      }

      const meeting = await storage.updateBookClubMeeting(meetingId, updates);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error updating meeting:", error);
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  // Delete meeting
  app.delete("/api/book-clubs/:clubId/meetings/:meetingId", async (req, res) => {
    try {
      const { meetingId } = req.params;
      await storage.deleteBookClubMeeting(meetingId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // RSVP to meeting
  app.post("/api/book-clubs/:clubId/meetings/:meetingId/rsvp", async (req, res) => {
    try {
      const { meetingId } = req.params;
      const userId = (req as any).user?.id || 'default';
      const { status } = req.body;

      if (!['going', 'maybe', 'not_going'].includes(status)) {
        return res.status(400).json({ error: "Invalid RSVP status" });
      }

      const rsvp = await storage.upsertMeetingRsvp(meetingId, userId, status);
      res.json(rsvp);
    } catch (error) {
      console.error("Error updating RSVP:", error);
      res.status(500).json({ error: "Failed to update RSVP" });
    }
  });

  // Get upcoming meetings for all clubs (for notifications)
  app.get("/api/meetings/upcoming", async (req, res) => {
    try {
      const userId = (req as any).user?.id || 'default';
      const meetings = await storage.getUpcomingMeetingsForUser(userId);
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching upcoming meetings:", error);
      res.status(500).json({ error: "Failed to fetch upcoming meetings" });
    }
  });

  app.get("/api/health", async (_req, res) => {
    try {
      await storage.getAllBooks();
      res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({ status: "error", message: "Database connection failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
