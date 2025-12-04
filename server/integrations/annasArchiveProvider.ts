/**
 * Anna's Archive Provider
 * Uses API when key is available, falls back to web scraping
 */

import { SourceProvider, BookMetadata, SearchOptions, DownloadResult, SourceConfig } from './sourceProvider';
import { getBypassManager } from './bypassManager';

const ANNAS_ARCHIVE_URL = 'https://annas-archive.org';
// RapidAPI endpoint for Anna's Archive
const RAPIDAPI_HOST = 'annas-archive-api.p.rapidapi.com';
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;

export class AnnasArchiveProvider implements SourceProvider {
  readonly name = 'Anna\'s Archive';
  readonly priority = 1; // Highest priority

  private config: SourceConfig;
  private bypassManager = getBypassManager();

  constructor(config: SourceConfig = { enabled: true }) {
    this.config = config;
  }

  /**
   * Search for books using API (if key available) or scraping
   */
  async search(options: SearchOptions): Promise<BookMetadata[]> {
    const { query, language = 'en', format = 'epub', limit = 25 } = options;

    // Use API if API key is configured
    if (this.config.apiKey) {
      return this.searchWithApi(options);
    }

    // Fall back to scraping (may not work reliably due to Cloudflare)
    return this.searchWithScraping(options);
  }

  /**
   * Search using the API (RapidAPI or Direct)
   */
  private async searchWithApi(options: SearchOptions): Promise<BookMetadata[]> {
    const apiType = this.config.apiType || 'rapidapi';
    
    if (apiType === 'direct') {
      return this.searchWithDirectApi(options);
    }
    return this.searchWithRapidApi(options);
  }

  /**
   * Search using RapidAPI's Anna's Archive API
   */
  private async searchWithRapidApi(options: SearchOptions): Promise<BookMetadata[]> {
    const { query, language = 'en', format = 'epub', limit = 25 } = options;

    try {
      // Build RapidAPI search URL - endpoint is /search with q parameter
      const url = new URL(`${RAPIDAPI_BASE_URL}/search`);
      url.searchParams.append('q', query);
      // RapidAPI parameters per documentation
      if (language) {
        url.searchParams.append('lang', language);
      }
      if (format) {
        url.searchParams.append('ext', format);
      }

      console.log(`[AnnasArchive] RapidAPI Search: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.config.apiKey!,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AnnasArchive] RapidAPI error: ${response.status} - ${errorText}`);
        throw new Error(`Anna's Archive RapidAPI error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const books: BookMetadata[] = [];

      console.log(`[AnnasArchive] RapidAPI response:`, JSON.stringify(data).substring(0, 500));

      // Parse RapidAPI response - handle different response formats
      let results: any[] = [];
      if (Array.isArray(data)) {
        results = data;
      } else if (data.results) {
        results = data.results;
      } else if (data.books) {
        results = data.books;
      } else if (data.data) {
        results = Array.isArray(data.data) ? data.data : [data.data];
      }

      for (const item of results) {
        try {
          const book: BookMetadata = {
            id: item.md5 || item.id || item.MD5,
            title: item.title || item.Title || 'Unknown Title',
            author: item.author || item.authors?.join(', ') || item.Author || 'Unknown',
            year: item.year?.toString() || item.Year?.toString() || item.published_date?.split('-')[0],
            language: item.language || item.Language || language,
            format: item.extension || item.format || item.Extension || format,
            cover_url: item.imgUrl || item.cover_url || item.thumbnail || item.cover || item.Cover,
            source: 'annas-archive',
          };
          
          // Only add if we have at least an ID and title
          if (book.id && book.title !== 'Unknown Title') {
            books.push(book);
          }
        } catch (error) {
          console.error('[AnnasArchive] Error parsing RapidAPI result:', error);
        }
      }

      console.log(`[AnnasArchive] RapidAPI returned ${books.length} results`);
      return books.slice(0, limit);
    } catch (error) {
      console.error('[AnnasArchive] RapidAPI search error:', error);
      throw new Error(`Anna's Archive RapidAPI search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search using Direct Anna's Archive API
   */
  private async searchWithDirectApi(options: SearchOptions): Promise<BookMetadata[]> {
    const { query, language = 'en', format = 'epub', limit = 25 } = options;

    try {
      // Build Direct API search URL
      const url = new URL(`${ANNAS_ARCHIVE_URL}/api/v1/search`);
      url.searchParams.append('q', query);
      if (language) url.searchParams.append('lang', language);
      if (format) url.searchParams.append('ext', format);
      url.searchParams.append('limit', String(limit));

      console.log(`[AnnasArchive] Direct API Search: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'application/json',
          'User-Agent': 'Luma/1.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AnnasArchive] Direct API error: ${response.status} - ${errorText}`);
        throw new Error(`Anna's Archive Direct API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const books: BookMetadata[] = [];

      console.log(`[AnnasArchive] Direct API response:`, JSON.stringify(data).substring(0, 500));

      // Parse Direct API response
      const results = data.results || data.books || data || [];
      for (const item of results) {
        try {
          const book: BookMetadata = {
            id: item.md5 || item.id,
            title: item.title || 'Unknown Title',
            author: item.author || item.authors?.join(', ') || 'Unknown',
            year: item.year?.toString() || item.published_date?.split('-')[0],
            language: item.language || language,
            format: item.extension || item.format || format,
            cover_url: item.cover_url || item.thumbnail,
            source: 'annas-archive',
          };
          
          if (book.id && book.title !== 'Unknown Title') {
            books.push(book);
          }
        } catch (error) {
          console.error('[AnnasArchive] Error parsing Direct API result:', error);
        }
      }

      console.log(`[AnnasArchive] Direct API returned ${books.length} results`);
      return books.slice(0, limit);
    } catch (error) {
      console.error('[AnnasArchive] Direct API search error:', error);
      throw new Error(`Anna's Archive Direct API search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search by scraping the website (fallback method)
   */
  private async searchWithScraping(options: SearchOptions): Promise<BookMetadata[]> {
    const { query, language = 'en', format = 'epub', limit = 25 } = options;

    try {
      // Build search URL
      const url = new URL(`${ANNAS_ARCHIVE_URL}/search`);
      url.searchParams.append('q', query);
      if (language) url.searchParams.append('lang', language);
      if (format) url.searchParams.append('ext', format);
      url.searchParams.append('sort', ''); // Most relevant

      console.log(`[AnnasArchive] Scraping search: ${url.toString()}`);

      // Fetch with bypass manager
      const result = await this.bypassManager.fetch(url.toString());
      const $ = this.bypassManager.loadHtml(result.html);

      // Parse search results
      const books: BookMetadata[] = [];
      const rawResults = $('a.js-vim-focus');

      rawResults.each((_, element) => {
        try {
          const $element = $(element);
          
          // Extract basic info
          const title = $element.find('h3').text().trim();
          if (!title) return; // Skip if no title

          const authors = $element.find('div.truncate.italic').text().trim();
          const path = $element.attr('href');
          
          if (!path) return; // Skip if no path

          // Extract MD5 from path (/md5/...)
          const md5Match = path.match(/\/md5\/([a-f0-9]+)/);
          if (!md5Match) return;
          const md5 = md5Match[1];

          // Extract file info
          const fileInfoText = $element.find('div.truncate.text-xs.text-gray-500').text();
          const formatMatch = fileInfoText.match(/(\w+)\s*,/);
          const sizeMatch = fileInfoText.match(/([\d.]+\s*[KMGT]B)/i);
          
          const bookFormat = formatMatch ? formatMatch[1].toLowerCase() : format;
          
          // Extract publish info
          const publishInfo = $element.find('div.truncate.text-sm').text();
          const yearMatch = publishInfo.match(/(\d{4})/);
          const year = yearMatch ? yearMatch[1] : undefined;

          // Extract cover image
          const coverImg = $element.find('img').attr('src');

          const book: BookMetadata = {
            id: md5,
            title,
            author: authors || 'Unknown',
            year,
            language,
            format: bookFormat,
            cover_url: coverImg || undefined,
            source: 'annas-archive',
          };

          books.push(book);
        } catch (error) {
          console.error('[AnnasArchive] Error parsing result:', error);
        }
      });

      console.log(`[AnnasArchive] Scraping found ${books.length} results`);
      return books.slice(0, limit);
    } catch (error) {
      console.error('[AnnasArchive] Scraping search error:', error);
      throw new Error(`Anna's Archive search failed: ${error instanceof Error ? error.message : 'Unknown error'}. Try adding an API key in Admin Settings.`);
    }
  }

  /**
   * Get download links for a book by scraping its detail page
   */
  async getDownloadLinks(bookId: string): Promise<string[]> {
    try {
      const url = `${ANNAS_ARCHIVE_URL}/md5/${bookId}`;
      console.log(`[AnnasArchive] Fetching download links: ${url}`);

      // Add donator key to headers if available
      const headers: Record<string, string> = {};
      if (this.config.donatorKey) {
        headers['Cookie'] = `aa_account_id=${this.config.donatorKey}`;
      }

      // Fetch with bypass manager
      const result = await this.bypassManager.fetch(url, { headers });
      const $ = this.bypassManager.loadHtml(result.html);

      // Find all download links
      const downloadLinks: string[] = [];
      $('a.js-download-link').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          downloadLinks.push(href);
        }
      });

      console.log(`[AnnasArchive] Found ${downloadLinks.length} download links`);

      if (downloadLinks.length === 0) {
        // Try alternative selectors
        $('a[href*="download"]').each((_, element) => {
          const href = $(element).attr('href');
          if (href && !downloadLinks.includes(href)) {
            downloadLinks.push(href);
          }
        });
      }

      return downloadLinks;
    } catch (error) {
      console.error('[AnnasArchive] Error getting download links:', error);
      throw error;
    }
  }

  /**
   * Download a book file from a URL
   */
  async downloadBook(downloadUrl: string): Promise<Buffer> {
    try {
      console.log(`[AnnasArchive] Downloading from: ${downloadUrl}`);

      // Add donator key if available
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      
      if (this.config.donatorKey) {
        headers['Cookie'] = `aa_account_id=${this.config.donatorKey}`;
      }

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('[AnnasArchive] Download error:', error);
      throw error;
    }
  }

  /**
   * Complete workflow: Get book by ID and download it
   * Uses direct mirror URLs to avoid Cloudflare protection on Anna's Archive
   */
  async downloadById(bookId: string, providedMetadata?: { title?: string; author?: string; format?: string; cover_url?: string }): Promise<DownloadResult> {
    console.log(`[AnnasArchive] Starting download for MD5: ${bookId}`);
    
    // Use provided metadata or defaults
    const title = providedMetadata?.title || 'Unknown';
    const author = providedMetadata?.author || 'Unknown';
    const format = providedMetadata?.format || 'epub';
    const cover_url = providedMetadata?.cover_url;

    // Direct download mirror URLs that don't require Cloudflare bypass
    // These are the common Library Genesis mirrors that Anna's Archive uses
    const directMirrors = [
      `https://libgen.li/get.php?md5=${bookId}`,
      `https://libgen.rs/get.php?md5=${bookId}`,
      `http://library.lol/main/${bookId}`,
      `https://download.library.lol/main/${bookId}/${encodeURIComponent(title)}.${format}`,
    ];

    console.log(`[AnnasArchive] Trying ${directMirrors.length} direct mirror URLs`);

    let lastError: Error | null = null;

    // Try each direct mirror
    for (const mirrorUrl of directMirrors) {
      try {
        console.log(`[AnnasArchive] Trying mirror: ${mirrorUrl}`);
        const buffer = await this.downloadFromMirror(mirrorUrl);
        
        if (buffer && buffer.length > 1000) { // Ensure we got actual content, not an error page
          console.log(`[AnnasArchive] Successfully downloaded ${buffer.length} bytes from mirror`);
          
          const metadata: BookMetadata = {
            id: bookId,
            title,
            author,
            cover_url,
            format,
            source: 'annas-archive',
          };

          return {
            buffer,
            metadata,
          };
        } else {
          console.log(`[AnnasArchive] Mirror returned insufficient data (${buffer?.length || 0} bytes)`);
        }
      } catch (error) {
        console.error(`[AnnasArchive] Mirror ${mirrorUrl} failed:`, error);
        lastError = error as Error;
        continue;
      }
    }

    // If direct mirrors fail, try scraping as fallback (may fail due to Cloudflare)
    console.log('[AnnasArchive] Direct mirrors failed, attempting page scrape fallback...');
    try {
      return await this.downloadByIdWithScraping(bookId, { title, author, format, cover_url });
    } catch (scrapeError) {
      console.error('[AnnasArchive] Scraping fallback also failed:', scrapeError);
      throw new Error(`All download methods failed. Last mirror error: ${lastError?.message}. Consider using a donator account for faster downloads.`);
    }
  }

  /**
   * Download from a mirror URL with proper headers and redirect following
   */
  private async downloadFromMirror(mirrorUrl: string): Promise<Buffer> {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/epub+zip, application/pdf, application/octet-stream, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://annas-archive.org/',
    };

    // First request - may be a redirect page
    let response = await fetch(mirrorUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
    });

    // Check if we got HTML instead of a file (some mirrors return a page with the actual download link)
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('text/html')) {
      // Parse the HTML to find the actual download link
      const html = await response.text();
      
      // Common patterns for download links in mirror pages
      const downloadLinkMatch = html.match(/href=["']([^"']*(?:get\.php|download)[^"']*)["']/i) ||
                                html.match(/window\.location\s*=\s*["']([^"']+)["']/i) ||
                                html.match(/href=["']([^"']+\.(?:epub|pdf|mobi|azw3))["']/i);
      
      if (downloadLinkMatch && downloadLinkMatch[1]) {
        let actualUrl = downloadLinkMatch[1];
        
        // Handle relative URLs
        if (actualUrl.startsWith('/')) {
          const urlObj = new URL(mirrorUrl);
          actualUrl = `${urlObj.protocol}//${urlObj.host}${actualUrl}`;
        } else if (!actualUrl.startsWith('http')) {
          const urlObj = new URL(mirrorUrl);
          actualUrl = `${urlObj.protocol}//${urlObj.host}/${actualUrl}`;
        }
        
        console.log(`[AnnasArchive] Following redirect to: ${actualUrl}`);
        
        response = await fetch(actualUrl, {
          method: 'GET',
          headers,
          redirect: 'follow',
        });
      } else {
        throw new Error('Mirror returned HTML without download link');
      }
    }

    if (!response.ok) {
      throw new Error(`Mirror returned ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Fallback: Try to download by scraping the detail page (may be blocked by Cloudflare)
   */
  private async downloadByIdWithScraping(bookId: string, metadata: { title: string; author: string; format: string; cover_url?: string }): Promise<DownloadResult> {
    const url = `${ANNAS_ARCHIVE_URL}/md5/${bookId}`;
    console.log(`[AnnasArchive] Scraping fallback: ${url}`);

    const headers: Record<string, string> = {};
    if (this.config.donatorKey) {
      headers['Cookie'] = `aa_account_id=${this.config.donatorKey}`;
    }

    const result = await this.bypassManager.fetch(url, { headers });
    const $ = this.bypassManager.loadHtml(result.html);

    // Extract download links
    const downloadLinks: string[] = [];
    $('a.js-download-link').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        downloadLinks.push(href);
      }
    });

    // Also try alternative selectors
    if (downloadLinks.length === 0) {
      $('a[href*="download"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && !downloadLinks.includes(href)) {
          downloadLinks.push(href);
        }
      });
    }

    console.log(`[AnnasArchive] Scraping found ${downloadLinks.length} download links`);

    if (downloadLinks.length === 0) {
      throw new Error('No download links found on page');
    }

    // Try each link
    for (const link of downloadLinks) {
      try {
        const buffer = await this.downloadBook(link);
        
        return {
          buffer,
          metadata: {
            id: bookId,
            title: metadata.title,
            author: metadata.author,
            cover_url: metadata.cover_url,
            format: metadata.format,
            source: 'annas-archive',
          },
        };
      } catch (error) {
        console.error(`[AnnasArchive] Download link ${link} failed:`, error);
        continue;
      }
    }

    throw new Error('All scraped download links failed');
  }

  /**
   * Check if Anna's Archive is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.bypassManager.fetch(ANNAS_ARCHIVE_URL);
      return result.status === 200 && !result.html.includes('Cloudflare');
    } catch (error) {
      console.error('[AnnasArchive] Health check failed:', error);
      return false;
    }
  }
}
