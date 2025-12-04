import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";
import { extractMetadataFromBuffer, type ExtractedMetadata } from "./metadata";
import { optimizeCover } from "./image-optimizer";
import type { InsertBook, InsertAudiobook, Book, Audiobook, BookWithProgress, AudiobookWithProgress } from "@shared/schema";

const BOOK_EXTENSIONS = [".epub", ".pdf", ".mobi", ".cbz", ".cbr"];
const AUDIOBOOK_EXTENSIONS = [".m4b", ".mp3", ".m4a"];

export interface ScanResult {
  scannedFiles: number;
  importedBooks: number;
  importedAudiobooks: number;
  duplicatesSkipped: number;
  errors: string[];
}

export interface ScanProgress {
  status: "idle" | "scanning" | "completed" | "error";
  currentFile?: string;
  scannedFiles: number;
  totalFiles: number;
  importedBooks: number;
  importedAudiobooks: number;
  duplicatesSkipped: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
}

let currentScanProgress: ScanProgress = {
  status: "idle",
  scannedFiles: 0,
  totalFiles: 0,
  importedBooks: 0,
  importedAudiobooks: 0,
  duplicatesSkipped: 0,
  errors: [],
};

export function getScanProgress(): ScanProgress {
  return { ...currentScanProgress };
}

function resetScanProgress(): void {
  currentScanProgress = {
    status: "idle",
    scannedFiles: 0,
    totalFiles: 0,
    importedBooks: 0,
    importedAudiobooks: 0,
    duplicatesSkipped: 0,
    errors: [],
  };
}

async function findMediaFiles(directory: string): Promise<string[]> {
  const allFiles: string[] = [];
  const allExtensions = [...BOOK_EXTENSIONS, ...AUDIOBOOK_EXTENSIONS];

  async function scanDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allExtensions.includes(ext)) {
            allFiles.push(fullPath);
          }
        }
      }
    } catch (error: any) {
      console.error(`Error scanning directory ${dir}:`, error.message);
    }
  }

  await scanDir(directory);
  return allFiles;
}

async function checkDuplicate(
  filePath: string,
  existingBooks: BookWithProgress[],
  existingAudiobooks: AudiobookWithProgress[]
): Promise<boolean> {
  for (const book of existingBooks) {
    if (book.filePath === filePath) {
      return true;
    }
  }

  for (const audiobook of existingAudiobooks) {
    if (audiobook.filePath === filePath) {
      return true;
    }
  }

  return false;
}

async function validateDirectory(directory: string): Promise<{ valid: boolean; error?: string }> {
  const normalizedPath = path.resolve(directory);

  const allSettings = await storage.getAllSettings();
  const booksPath = allSettings.find((s) => s.key === "booksDirectoryPath")?.value;
  const audiobooksPath = allSettings.find((s) => s.key === "audiobooksDirectoryPath")?.value;
  const watchDirsSetting = allSettings.find((s) => s.key === "watchDirectories")?.value;
  
  let additionalDirs: string[] = [];
  if (watchDirsSetting) {
    try {
      additionalDirs = JSON.parse(watchDirsSetting);
    } catch (error) {
      console.error("[Scanner] Failed to parse watchDirectories setting:", error);
    }
  }

  const allowedPaths: string[] = [];
  if (booksPath) allowedPaths.push(path.resolve(booksPath));
  if (audiobooksPath) allowedPaths.push(path.resolve(audiobooksPath));
  additionalDirs.forEach((dir) => allowedPaths.push(path.resolve(dir)));

  if (allowedPaths.length === 0) {
    return { valid: false, error: "No library paths configured. Please configure library paths in Settings first." };
  }

  const isAllowed = allowedPaths.some((allowedPath) => {
    return normalizedPath === allowedPath || normalizedPath.startsWith(allowedPath + path.sep);
  });

  if (!isAllowed) {
    return { 
      valid: false, 
      error: `Access denied: "${directory}" is not within allowed library paths. Configure allowed paths in Settings.` 
    };
  }

  return { valid: true };
}

export async function scanDirectory(directory: string): Promise<ScanResult> {
  resetScanProgress();
  currentScanProgress.status = "scanning";
  currentScanProgress.startedAt = new Date();

  const result: ScanResult = {
    scannedFiles: 0,
    importedBooks: 0,
    importedAudiobooks: 0,
    duplicatesSkipped: 0,
    errors: [],
  };

  const validation = await validateDirectory(directory);
  if (!validation.valid) {
    currentScanProgress.status = "error";
    currentScanProgress.errors.push(validation.error!);
    result.errors.push(validation.error!);
    return result;
  }

  try {
    await fs.access(directory);
  } catch {
    currentScanProgress.status = "error";
    currentScanProgress.errors.push(`Directory not accessible: ${directory}`);
    result.errors.push(`Directory not accessible: ${directory}`);
    return result;
  }

  console.log(`[Scanner] Starting scan of directory: ${directory}`);

  const files = await findMediaFiles(directory);
  currentScanProgress.totalFiles = files.length;
  console.log(`[Scanner] Found ${files.length} media files`);

  const existingBooks = await storage.getAllBooks();
  const existingAudiobooks = await storage.getAllAudiobooks();

  const processedPaths = new Set<string>();

  for (const filePath of files) {
    try {
      currentScanProgress.currentFile = filePath;
      currentScanProgress.scannedFiles++;
      result.scannedFiles++;

      if (processedPaths.has(filePath)) {
        currentScanProgress.duplicatesSkipped++;
        result.duplicatesSkipped++;
        console.log(`[Scanner] Skipping duplicate (in-scan): ${filePath}`);
        continue;
      }

      if (await checkDuplicate(filePath, existingBooks, existingAudiobooks)) {
        currentScanProgress.duplicatesSkipped++;
        result.duplicatesSkipped++;
        console.log(`[Scanner] Skipping duplicate (existing): ${filePath}`);
        processedPaths.add(filePath);
        continue;
      }

      processedPaths.add(filePath);

      const ext = path.extname(filePath).toLowerCase();
      const isBook = BOOK_EXTENSIONS.includes(ext);
      const isAudiobook = AUDIOBOOK_EXTENSIONS.includes(ext);

      const fileBuffer = await fs.readFile(filePath);
      const metadata = await extractMetadataFromBuffer(fileBuffer, path.basename(filePath));

      if (isBook) {
        const format = ext.replace(".", "").toUpperCase() as "EPUB" | "PDF" | "MOBI" | "CBZ" | "CBR";
        const stats = await fs.stat(filePath);

        const bookData: InsertBook = {
          title: metadata.title || path.basename(filePath, ext),
          author: metadata.author,
          filePath: filePath,
          format,
          fileSize: stats.size,
          description: metadata.description,
          publisher: metadata.publisher,
          publishedDate: metadata.publishedYear?.toString(),
          isbn: metadata.isbn,
          language: metadata.language,
          pageCount: metadata.pageCount,
          tags: metadata.tags,
        };

        if (metadata.coverImageData) {
          const coverPath = await saveCoverImage(filePath, metadata.coverImageData, "book");
          bookData.coverUrl = coverPath;
        }

        if (metadata.dominantColors && metadata.dominantColors.length > 0) {
          bookData.dominantColors = metadata.dominantColors;
        }

        await storage.createBook(bookData);
        currentScanProgress.importedBooks++;
        result.importedBooks++;
        console.log(`[Scanner] Imported book: ${bookData.title}`);
      } else if (isAudiobook) {
        const format = ext.replace(".", "").toUpperCase() as "M4B" | "MP3" | "M4A";
        const stats = await fs.stat(filePath);

        const audiobookData: InsertAudiobook = {
          title: metadata.title || path.basename(filePath, ext),
          author: metadata.author,
          narrator: metadata.narrator,
          filePath: filePath,
          format,
          fileSize: stats.size,
          duration: metadata.duration ? Math.floor(metadata.duration) : undefined,
          description: metadata.description,
          publisher: metadata.publisher,
          publishedDate: metadata.publishedYear?.toString(),
          isbn: metadata.isbn,
          language: metadata.language,
          tags: metadata.tags,
        };

        if (metadata.coverImageData) {
          const coverPath = await saveCoverImage(filePath, metadata.coverImageData, "audiobook");
          audiobookData.coverUrl = coverPath;
        }

        if (metadata.dominantColors && metadata.dominantColors.length > 0) {
          audiobookData.dominantColors = metadata.dominantColors;
        }

        await storage.createAudiobook(audiobookData);
        currentScanProgress.importedAudiobooks++;
        result.importedAudiobooks++;
        console.log(`[Scanner] Imported audiobook: ${audiobookData.title}`);
      }
    } catch (error: any) {
      const errorMsg = `Error processing ${filePath}: ${error.message}`;
      console.error(`[Scanner] ${errorMsg}`);
      currentScanProgress.errors.push(errorMsg);
      result.errors.push(errorMsg);
    }
  }

  currentScanProgress.status = "completed";
  currentScanProgress.completedAt = new Date();
  currentScanProgress.currentFile = undefined;

  console.log(`[Scanner] Scan complete. Imported ${result.importedBooks} books and ${result.importedAudiobooks} audiobooks. Skipped ${result.duplicatesSkipped} duplicates.`);

  return result;
}

async function saveCoverImage(
  sourceFilePath: string,
  imageData: Buffer,
  type: "book" | "audiobook"
): Promise<string> {
  const coversDir = "/tmp/covers";
  await fs.mkdir(coversDir, { recursive: true });

  const filename = path.basename(sourceFilePath, path.extname(sourceFilePath));
  const safeFilename = filename.replace(/[^a-zA-Z0-9-_]/g, "_");
  const coverPath = path.join(coversDir, `${type}_${safeFilename}_${Date.now()}.webp`);

  try {
    const optimizedImage = await optimizeCover(imageData, {
      maxWidth: 600,
      maxHeight: 900,
      quality: 85,
      format: "webp",
    });
    await fs.writeFile(coverPath, optimizedImage);
    console.log(`[Scanner] Optimized cover saved: ${coverPath} (${imageData.length} -> ${optimizedImage.length} bytes)`);
  } catch (error) {
    console.warn(`[Scanner] Failed to optimize cover, saving original: ${error}`);
    await fs.writeFile(coverPath.replace(".webp", ".jpg"), imageData);
    return coverPath.replace(".webp", ".jpg");
  }

  return coverPath;
}

export async function scanWatchDirectories(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  const allSettings = await storage.getAllSettings();

  const booksPathSetting = allSettings.find((s) => s.key === "booksDirectoryPath");
  const audiobooksPathSetting = allSettings.find((s) => s.key === "audiobooksDirectoryPath");
  const watchDirsSetting = allSettings.find((s) => s.key === "watchDirectories");

  const booksPath = booksPathSetting?.value;
  const audiobooksPath = audiobooksPathSetting?.value;
  const additionalDirs: string[] = watchDirsSetting?.value ? JSON.parse(watchDirsSetting.value) : [];

  const allDirs: string[] = [];

  if (booksPath) allDirs.push(booksPath);
  if (audiobooksPath && audiobooksPath !== booksPath) allDirs.push(audiobooksPath);
  additionalDirs.forEach((dir) => {
    if (!allDirs.includes(dir)) allDirs.push(dir);
  });

  for (const dir of allDirs) {
    try {
      const result = await scanDirectory(dir);
      results.push(result);
    } catch (error: any) {
      console.error(`[Scanner] Error scanning ${dir}:`, error.message);
      results.push({
        scannedFiles: 0,
        importedBooks: 0,
        importedAudiobooks: 0,
        duplicatesSkipped: 0,
        errors: [`Failed to scan ${dir}: ${error.message}`],
      });
    }
  }

  return results;
}
