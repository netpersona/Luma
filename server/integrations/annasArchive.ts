/**
 * Anna's Archive Integration Service
 * Uses RapidAPI wrapper for searching and downloading books
 */

interface AnnasArchiveBook {
  md5: string;
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
}

interface SearchParams {
  query: string;
  language?: string;
  format?: string; // epub, pdf, mobi, etc.
  limit?: number;
}

export class AnnasArchiveService {
  private apiKey: string;
  private baseUrl = "https://annas-archive-api.p.rapidapi.com";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search for books on Anna's Archive
   */
  async search(params: SearchParams): Promise<AnnasArchiveBook[]> {
    const { query, language = "en", format = "epub", limit = 25 } = params;

    try {
      const url = new URL(`${this.baseUrl}/search`);
      url.searchParams.append("q", query);
      if (language) url.searchParams.append("language", language);
      if (format) url.searchParams.append("type", format);
      if (limit) url.searchParams.append("limit", String(limit));

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": this.apiKey,
          "X-RapidAPI-Host": "annas-archive-api.p.rapidapi.com",
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Anna's Archive API error: ${response.status} - ${error}`);
        throw new Error(`Anna's Archive API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log("Anna's Archive API response:", JSON.stringify(data, null, 2));
      console.log("Search params:", { query, language, format, limit });
      console.log("Full URL:", url.toString());
      
      // Handle the actual API response structure which has a 'books' property
      let books: any[] = [];
      if (data.books && Array.isArray(data.books)) {
        books = data.books;
      } else if (Array.isArray(data)) {
        books = data;
      }
      
      // Map API field names to our interface (imgUrl -> cover_url)
      return books.map(book => ({
        ...book,
        cover_url: book.imgUrl || book.cover_url,
      }));
    } catch (error) {
      console.error("Error searching Anna's Archive:", error);
      throw error;
    }
  }

  /**
   * Get download links by scraping the Anna's Archive download page
   */
  async getDownloadLinks(md5: string): Promise<string[]> {
    try {
      // Import cheerio dynamically
      const cheerio = await import('cheerio');
      
      // Fetch the download page directly from Anna's Archive
      const url = `https://annas-archive.org/md5/${md5}`;
      console.log(`Fetching download page: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch download page: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Find all download links (Anna's Archive uses class 'js-download-link')
      const downloadLinks: string[] = [];
      $('a.js-download-link').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          downloadLinks.push(href);
        }
      });
      
      console.log(`Found ${downloadLinks.length} download links for ${md5}`);
      
      if (downloadLinks.length === 0) {
        // Try alternative selector - sometimes links are in different formats
        $('a[href*="download"]').each((_, element) => {
          const href = $(element).attr('href');
          if (href && !downloadLinks.includes(href)) {
            downloadLinks.push(href);
          }
        });
      }

      return downloadLinks;
    } catch (error) {
      console.error("Error getting download links:", error);
      throw error;
    }
  }

  /**
   * Download a book file from a given URL
   */
  async downloadBook(downloadUrl: string): Promise<Buffer> {
    try {
      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error("Error downloading book:", error);
      throw error;
    }
  }

  /**
   * Complete workflow: Search, get links, and download a book
   */
  async searchAndDownload(
    query: string,
    options: { language?: string; format?: string } = {}
  ): Promise<{ book: AnnasArchiveBook; file: Buffer } | null> {
    try {
      // Search for books
      const results = await this.search({
        query,
        ...options,
        limit: 1,
      });

      if (results.length === 0) {
        return null;
      }

      const book = results[0];

      // Get download links
      const links = await this.getDownloadLinks(book.md5);

      if (links.length === 0) {
        throw new Error("No download links available");
      }

      // Try first available mirror
      const file = await this.downloadBook(links[0]);

      return { book, file };
    } catch (error) {
      console.error("Error in searchAndDownload:", error);
      throw error;
    }
  }
}

/**
 * Helper to get Anna's Archive service instance with API key from settings
 */
export async function getAnnasArchiveService(
  getApiKey: () => Promise<string | null>
): Promise<AnnasArchiveService | null> {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    return null;
  }

  return new AnnasArchiveService(apiKey);
}
