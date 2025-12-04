import Database from "better-sqlite3";
import path from "path";
import fs from "fs/promises";
import { storage } from "../storage";
import type { InsertBook, CalibreLibrary } from "@shared/schema";

interface CalibreBook {
  id: number;
  title: string;
  author: string | null;
  authorSort: string | null;
  publisher: string | null;
  pubdate: string | null;
  isbn: string | null;
  series: string | null;
  seriesIndex: number | null;
  language: string | null;
  description: string | null;
  tags: string[];
  formats: CalibreFormat[];
  coverPath: string | null;
  path: string; // Relative path in Calibre library
}

interface CalibreFormat {
  format: string;
  filename: string;
  size: number;
}

interface CalibreScanResult {
  success: boolean;
  libraryName?: string;
  books?: CalibreBook[];
  totalBooks?: number;
  error?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export class CalibreService {
  private getMetadataDbPath(libraryPath: string): string {
    return path.join(libraryPath, "metadata.db");
  }

  async validateLibraryPath(libraryPath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const metadataPath = this.getMetadataDbPath(libraryPath);
      
      try {
        await fs.access(metadataPath);
      } catch {
        return { valid: false, error: "metadata.db not found. Please provide the path to a valid Calibre library." };
      }

      const db = new Database(metadataPath, { readonly: true });
      
      try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
        const requiredTables = ['books', 'authors', 'data'];
        const tableNames = tables.map(t => t.name);
        
        for (const required of requiredTables) {
          if (!tableNames.includes(required)) {
            return { valid: false, error: `Invalid Calibre database: missing ${required} table.` };
          }
        }
        
        return { valid: true };
      } finally {
        db.close();
      }
    } catch (error: any) {
      console.error("[CalibreService] Validation error:", error);
      return { valid: false, error: error.message || "Failed to validate library path" };
    }
  }

  async scanLibrary(libraryPath: string): Promise<CalibreScanResult> {
    try {
      const validation = await this.validateLibraryPath(libraryPath);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const metadataPath = this.getMetadataDbPath(libraryPath);
      const db = new Database(metadataPath, { readonly: true });

      try {
        const libraryName = path.basename(libraryPath);
        
        const booksQuery = db.prepare(`
          SELECT 
            b.id,
            b.title,
            b.path,
            b.pubdate,
            b.series_index,
            GROUP_CONCAT(DISTINCT a.name) as authors,
            GROUP_CONCAT(DISTINCT a.sort) as author_sorts,
            p.name as publisher,
            s.name as series,
            l.lang_code as language,
            c.text as description
          FROM books b
          LEFT JOIN books_authors_link bal ON b.id = bal.book
          LEFT JOIN authors a ON bal.author = a.id
          LEFT JOIN books_publishers_link bpl ON b.id = bpl.book
          LEFT JOIN publishers p ON bpl.publisher = p.id
          LEFT JOIN books_series_link bsl ON b.id = bsl.book
          LEFT JOIN series s ON bsl.series = s.id
          LEFT JOIN books_languages_link bll ON b.id = bll.book
          LEFT JOIN languages l ON bll.lang_code = l.id
          LEFT JOIN comments c ON b.id = c.book
          GROUP BY b.id
          ORDER BY b.id
        `);

        const rawBooks = booksQuery.all() as any[];

        const tagsQuery = db.prepare(`
          SELECT bt.book, t.name
          FROM books_tags_link bt
          JOIN tags t ON bt.tag = t.id
        `);
        const allTags = tagsQuery.all() as { book: number; name: string }[];
        const tagsByBook = new Map<number, string[]>();
        for (const tag of allTags) {
          if (!tagsByBook.has(tag.book)) {
            tagsByBook.set(tag.book, []);
          }
          tagsByBook.get(tag.book)!.push(tag.name);
        }

        const formatsQuery = db.prepare(`
          SELECT book, format, name, uncompressed_size
          FROM data
        `);
        const allFormats = formatsQuery.all() as { book: number; format: string; name: string; uncompressed_size: number }[];
        const formatsByBook = new Map<number, CalibreFormat[]>();
        for (const fmt of allFormats) {
          if (!formatsByBook.has(fmt.book)) {
            formatsByBook.set(fmt.book, []);
          }
          formatsByBook.get(fmt.book)!.push({
            format: fmt.format,
            filename: fmt.name,
            size: fmt.uncompressed_size,
          });
        }

        const identifiersQuery = db.prepare(`
          SELECT book, type, val
          FROM identifiers
          WHERE type IN ('isbn', 'isbn13')
        `);
        const allIdentifiers = identifiersQuery.all() as { book: number; type: string; val: string }[];
        const isbnByBook = new Map<number, string>();
        for (const id of allIdentifiers) {
          if (!isbnByBook.has(id.book)) {
            isbnByBook.set(id.book, id.val);
          }
        }

        const books: CalibreBook[] = rawBooks.map(book => {
          const bookPath = book.path;
          const formats = formatsByBook.get(book.id) || [];
          
          let coverPath: string | null = null;
          const possibleCoverPath = path.join(libraryPath, bookPath, "cover.jpg");
          coverPath = possibleCoverPath;

          return {
            id: book.id,
            title: book.title,
            author: book.authors?.split(',')[0]?.trim() || null,
            authorSort: book.author_sorts?.split(',')[0]?.trim() || null,
            publisher: book.publisher || null,
            pubdate: book.pubdate || null,
            isbn: isbnByBook.get(book.id) || null,
            series: book.series || null,
            seriesIndex: book.series_index || null,
            language: book.language || null,
            description: book.description || null,
            tags: tagsByBook.get(book.id) || [],
            formats,
            coverPath,
            path: bookPath,
          };
        });

        return {
          success: true,
          libraryName,
          books,
          totalBooks: books.length,
        };
      } finally {
        db.close();
      }
    } catch (error: any) {
      console.error("[CalibreService] Scan error:", error);
      return { success: false, error: error.message || "Failed to scan library" };
    }
  }

  async registerLibrary(libraryPath: string, name?: string): Promise<CalibreLibrary | null> {
    try {
      const validation = await this.validateLibraryPath(libraryPath);
      if (!validation.valid) {
        console.error("[CalibreService] Invalid library path:", validation.error);
        return null;
      }

      const scanResult = await this.scanLibrary(libraryPath);
      if (!scanResult.success) {
        console.error("[CalibreService] Scan failed:", scanResult.error);
        return null;
      }

      const library = await storage.createCalibreLibrary({
        name: name || scanResult.libraryName || path.basename(libraryPath),
        path: libraryPath,
        bookCount: scanResult.totalBooks || 0,
        isActive: true,
      });

      return library;
    } catch (error: any) {
      console.error("[CalibreService] Register library error:", error);
      return null;
    }
  }

  getPreferredFormat(formats: CalibreFormat[]): CalibreFormat | null {
    const formatPriority = ['EPUB', 'PDF', 'MOBI', 'AZW3', 'CBZ', 'CBR'];
    
    for (const preferred of formatPriority) {
      const found = formats.find(f => f.format.toUpperCase() === preferred);
      if (found) return found;
    }
    
    return formats.length > 0 ? formats[0] : null;
  }

  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async findCoverPath(bookPath: string): Promise<string | null> {
    const coverExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    for (const ext of coverExtensions) {
      const coverPath = path.join(bookPath, `cover.${ext}`);
      if (await this.checkFileExists(coverPath)) {
        return coverPath;
      }
    }
    return null;
  }

  private toLocalFileUrl(absolutePath: string): string {
    return `/api/local-file?path=${encodeURIComponent(absolutePath)}`;
  }

  async mapCalibreBookToInsertBook(
    calibreBook: CalibreBook, 
    libraryPath: string,
    format: CalibreFormat
  ): Promise<InsertBook> {
    const absoluteFilePath = path.join(
      libraryPath, 
      calibreBook.path, 
      `${format.filename}.${format.format.toLowerCase()}`
    );

    const bookDir = path.join(libraryPath, calibreBook.path);
    const coverAbsPath = await this.findCoverPath(bookDir);

    let publishedDate: string | undefined;
    if (calibreBook.pubdate) {
      try {
        const date = new Date(calibreBook.pubdate);
        if (!isNaN(date.getTime())) {
          publishedDate = date.getFullYear().toString();
        }
      } catch {}
    }

    return {
      title: calibreBook.title,
      author: calibreBook.author || undefined,
      description: calibreBook.description || undefined,
      coverUrl: coverAbsPath ? this.toLocalFileUrl(coverAbsPath) : undefined,
      filePath: this.toLocalFileUrl(absoluteFilePath),
      format: format.format.toUpperCase(),
      publisher: calibreBook.publisher || undefined,
      publishedDate,
      isbn: calibreBook.isbn || undefined,
      language: calibreBook.language || undefined,
      series: calibreBook.series || undefined,
      tags: calibreBook.tags.length > 0 ? calibreBook.tags : undefined,
      calibreId: calibreBook.id,
      source: 'calibre',
      originPath: bookDir,
    };
  }

  async importBooks(
    libraryPath: string, 
    calibreBookIds?: number[],
    onProgress?: (current: number, total: number) => void
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    try {
      const scanResult = await this.scanLibrary(libraryPath);
      if (!scanResult.success || !scanResult.books) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          failed: 0,
          errors: [scanResult.error || "Failed to scan library"],
        };
      }

      let booksToImport = scanResult.books;
      if (calibreBookIds && calibreBookIds.length > 0) {
        const idSet = new Set(calibreBookIds);
        booksToImport = booksToImport.filter(b => idSet.has(b.id));
      }

      const existingBooks = await storage.getAllBooks();
      const existingCalibreIds = new Set(
        existingBooks
          .filter(b => b.calibreId !== null)
          .map(b => b.calibreId)
      );

      const total = booksToImport.length;
      let current = 0;

      for (const calibreBook of booksToImport) {
        current++;
        onProgress?.(current, total);

        if (existingCalibreIds.has(calibreBook.id)) {
          result.skipped++;
          continue;
        }

        const preferredFormat = this.getPreferredFormat(calibreBook.formats);
        if (!preferredFormat) {
          result.skipped++;
          result.errors.push(`No supported format found for: ${calibreBook.title}`);
          continue;
        }

        try {
          const insertBook = await this.mapCalibreBookToInsertBook(
            calibreBook,
            libraryPath,
            preferredFormat
          );

          await storage.createBook(insertBook);
          result.imported++;
        } catch (error: any) {
          result.failed++;
          result.errors.push(`Failed to import "${calibreBook.title}": ${error.message}`);
        }
      }

      return result;
    } catch (error: any) {
      console.error("[CalibreService] Import error:", error);
      return {
        success: false,
        imported: result.imported,
        skipped: result.skipped,
        failed: result.failed,
        errors: [...result.errors, error.message || "Import failed"],
      };
    }
  }

  async getLibraries(): Promise<CalibreLibrary[]> {
    return await storage.getCalibreLibraries();
  }

  async syncLibrary(libraryId: string): Promise<ImportResult> {
    try {
      const library = await storage.getCalibreLibrary(libraryId);
      if (!library) {
        return {
          success: false,
          imported: 0,
          skipped: 0,
          failed: 0,
          errors: ["Library not found"],
        };
      }

      const result = await this.importBooks(library.path);
      
      if (result.success) {
        await storage.updateCalibreLibrary(libraryId, {
          lastSyncedAt: new Date(),
          bookCount: (library.bookCount || 0) + result.imported,
        });
      }

      return result;
    } catch (error: any) {
      console.error("[CalibreService] Sync error:", error);
      return {
        success: false,
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [error.message || "Sync failed"],
      };
    }
  }
}

export const calibreService = new CalibreService();
