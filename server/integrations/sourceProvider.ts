/**
 * Source Provider Interfaces
 * Defines common interfaces for book sources (Anna's Archive, Libgen, Z-Library)
 */

export interface BookMetadata {
  id: string; // MD5 or unique identifier
  title: string;
  author: string;
  year?: string;
  language?: string;
  format: string; // epub, pdf, mobi, etc.
  filesize?: number;
  extension?: string;
  publisher?: string;
  isbn?: string;
  cover_url?: string;
  source: 'annas-archive' | 'libgen' | 'zlibrary'; // Which source this came from
}

export interface SearchOptions {
  query: string;
  language?: string;
  format?: string;
  limit?: number;
}

export interface DownloadResult {
  buffer: Buffer;
  metadata: BookMetadata;
}

/**
 * Base interface that all book sources must implement
 */
export interface SourceProvider {
  readonly name: string;
  readonly priority: number; // Lower = higher priority

  /**
   * Search for books
   */
  search(options: SearchOptions): Promise<BookMetadata[]>;

  /**
   * Get download links for a specific book
   */
  getDownloadLinks(bookId: string): Promise<string[]>;

  /**
   * Download a book from a given URL
   */
  downloadBook(downloadUrl: string): Promise<Buffer>;

  /**
   * Complete workflow: Get book by ID and download it
   * Optional metadata can be passed to avoid needing to scrape for it
   */
  downloadById(bookId: string, metadata?: { title?: string; author?: string; format?: string; cover_url?: string }): Promise<DownloadResult>;

  /**
   * Check if this source is available/working
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Configuration for a book source
 */
export interface SourceConfig {
  enabled: boolean;
  apiType?: 'rapidapi' | 'direct'; // Which API to use (for Anna's Archive)
  apiKey?: string; // API key for search access
  donatorKey?: string; // For sources that support premium access (faster downloads)
  timeout?: number; // Request timeout in ms
  maxRetries?: number; // Max retry attempts
}
