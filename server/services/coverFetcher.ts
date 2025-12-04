/**
 * Cover Image Fetcher Service
 * Fetches book cover images from external APIs when not available in the file
 * 
 * Primary: Open Library Covers API (free, no API key required)
 * Fallback: Google Books API (requires user's API key)
 */

import { optimizeCover } from '../image-optimizer';
import { saveLocalFile } from '../localFileStorage';

export interface CoverFetchResult {
  success: boolean;
  coverUrl?: string;
  source?: 'openlibrary' | 'googlebooks';
  error?: string;
}

export interface CoverOption {
  url: string;
  source: 'openlibrary' | 'googlebooks';
  previewUrl: string; // Direct URL for preview in modal
  workTitle?: string; // Title from the search result
  workId?: string; // ID for deduplication
}

export interface CoverSearchResult {
  success: boolean;
  covers: CoverOption[];
  error?: string;
}

/**
 * Fetch cover image from Open Library by ISBN
 */
async function fetchFromOpenLibraryByISBN(isbn: string): Promise<Buffer | null> {
  try {
    // Clean ISBN (remove dashes)
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    
    // Try different sizes: L (large), M (medium)
    for (const size of ['L', 'M']) {
      const url = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-${size}.jpg`;
      console.log(`[CoverFetcher] Trying Open Library ISBN: ${url}`);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // Open Library returns a 1x1 pixel image when cover not found
        // Check if the image is larger than 1KB to be valid
        if (buffer.length > 1000) {
          console.log(`[CoverFetcher] Found cover via Open Library ISBN (${buffer.length} bytes)`);
          return buffer;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[CoverFetcher] Open Library ISBN error:', error);
    return null;
  }
}

/**
 * Fetch cover image from Open Library by title and author
 */
async function fetchFromOpenLibraryByTitle(title: string, author?: string): Promise<Buffer | null> {
  try {
    // Search for the book first to get OLID
    const searchQuery = author 
      ? `title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
      : `title=${encodeURIComponent(title)}`;
    
    const searchUrl = `https://openlibrary.org/search.json?${searchQuery}&limit=5`;
    console.log(`[CoverFetcher] Searching Open Library: ${title} by ${author || 'unknown'}`);
    
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.docs || searchData.docs.length === 0) {
      console.log('[CoverFetcher] No results found on Open Library');
      return null;
    }
    
    // Try to find a result with a cover
    for (const doc of searchData.docs) {
      // Try cover_i (cover ID) first
      if (doc.cover_i) {
        const coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        console.log(`[CoverFetcher] Trying Open Library cover ID: ${doc.cover_i}`);
        
        const coverResponse = await fetch(coverUrl);
        
        if (coverResponse.ok) {
          const buffer = Buffer.from(await coverResponse.arrayBuffer());
          
          if (buffer.length > 1000) {
            console.log(`[CoverFetcher] Found cover via Open Library cover ID (${buffer.length} bytes)`);
            return buffer;
          }
        }
      }
      
      // Try ISBN from search result
      if (doc.isbn && doc.isbn.length > 0) {
        const buffer = await fetchFromOpenLibraryByISBN(doc.isbn[0]);
        if (buffer) {
          return buffer;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[CoverFetcher] Open Library title search error:', error);
    return null;
  }
}

/**
 * Fetch cover image from Google Books API
 */
async function fetchFromGoogleBooks(
  title: string,
  author?: string,
  isbn?: string,
  apiKey?: string
): Promise<Buffer | null> {
  // Google Books can work without API key for basic requests, but rate limited
  try {
    let query: string;
    
    if (isbn) {
      query = `isbn:${isbn.replace(/[-\s]/g, '')}`;
    } else if (author) {
      query = `intitle:${title}+inauthor:${author}`;
    } else {
      query = `intitle:${title}`;
    }
    
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '5');
    if (apiKey) {
      url.searchParams.set('key', apiKey);
    }
    
    console.log(`[CoverFetcher] Searching Google Books: ${query}`);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error(`[CoverFetcher] Google Books API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log('[CoverFetcher] No results found on Google Books');
      return null;
    }
    
    // Find first result with an image
    for (const item of data.items) {
      const imageLinks = item.volumeInfo?.imageLinks;
      
      if (imageLinks) {
        // Try to get the largest available image
        // Remove zoom and edge parameters to get larger image
        let imageUrl = imageLinks.thumbnail || imageLinks.smallThumbnail;
        
        if (imageUrl) {
          // Upgrade to higher quality image
          imageUrl = imageUrl
            .replace('zoom=1', 'zoom=3')
            .replace('&edge=curl', '')
            .replace('http://', 'https://');
          
          console.log(`[CoverFetcher] Fetching Google Books cover: ${imageUrl}`);
          
          const imageResponse = await fetch(imageUrl);
          
          if (imageResponse.ok) {
            const buffer = Buffer.from(await imageResponse.arrayBuffer());
            
            if (buffer.length > 1000) {
              console.log(`[CoverFetcher] Found cover via Google Books (${buffer.length} bytes)`);
              return buffer;
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[CoverFetcher] Google Books error:', error);
    return null;
  }
}

/**
 * Main function to fetch cover image from available sources
 */
export async function fetchCoverImage(
  title: string,
  author?: string,
  isbn?: string,
  googleBooksApiKey?: string
): Promise<CoverFetchResult> {
  console.log(`[CoverFetcher] Attempting to fetch cover for: "${title}" by ${author || 'unknown'}, ISBN: ${isbn || 'none'}`);
  
  let coverBuffer: Buffer | null = null;
  let source: 'openlibrary' | 'googlebooks' | undefined;
  
  // Try Open Library first (free, no rate limits)
  
  // 1. Try ISBN lookup if available
  if (isbn) {
    coverBuffer = await fetchFromOpenLibraryByISBN(isbn);
    if (coverBuffer) {
      source = 'openlibrary';
    }
  }
  
  // 2. Try title/author search on Open Library
  if (!coverBuffer && title) {
    coverBuffer = await fetchFromOpenLibraryByTitle(title, author);
    if (coverBuffer) {
      source = 'openlibrary';
    }
  }
  
  // 3. Try Google Books as fallback
  if (!coverBuffer) {
    coverBuffer = await fetchFromGoogleBooks(title, author, isbn, googleBooksApiKey);
    if (coverBuffer) {
      source = 'googlebooks';
    }
  }
  
  if (!coverBuffer) {
    console.log(`[CoverFetcher] Could not find cover for: "${title}"`);
    return {
      success: false,
      error: 'No cover image found from any source',
    };
  }
  
  // Optimize and save the cover image
  try {
    const optimizedCover = await optimizeCover(coverBuffer, {
      maxWidth: 600,
      maxHeight: 900,
      quality: 85,
      format: 'webp',
    });
    
    console.log(`[CoverFetcher] Optimized cover: ${coverBuffer.length} -> ${optimizedCover.length} bytes`);
    
    // Save to local storage
    const coverUrl = await saveLocalFile(optimizedCover, 'covers', '.webp');
    
    console.log(`[CoverFetcher] Saved cover to: ${coverUrl}`);
    
    return {
      success: true,
      coverUrl,
      source,
    };
  } catch (error: any) {
    console.error('[CoverFetcher] Error saving cover:', error);
    return {
      success: false,
      error: `Failed to save cover: ${error.message}`,
    };
  }
}

/**
 * Fetch cover for a book by its ID (for manual refresh)
 */
export async function fetchCoverForBook(
  bookId: string,
  storage: any,
  googleBooksApiKey?: string
): Promise<CoverFetchResult> {
  const book = await storage.getBookById(bookId);
  
  if (!book) {
    return {
      success: false,
      error: 'Book not found',
    };
  }
  
  const result = await fetchCoverImage(
    book.title,
    book.author || undefined,
    book.isbn || undefined,
    googleBooksApiKey
  );
  
  if (result.success && result.coverUrl) {
    // Update book record with new cover
    await storage.updateBook(bookId, { coverUrl: result.coverUrl });
    console.log(`[CoverFetcher] Updated book ${bookId} with new cover: ${result.coverUrl}`);
  }
  
  return result;
}

/**
 * Fetch cover for an audiobook by its ID (for manual refresh)
 */
export async function fetchCoverForAudiobook(
  audiobookId: string,
  storage: any,
  googleBooksApiKey?: string
): Promise<CoverFetchResult> {
  const audiobook = await storage.getAudiobookById(audiobookId);
  
  if (!audiobook) {
    return {
      success: false,
      error: 'Audiobook not found',
    };
  }
  
  const result = await fetchCoverImage(
    audiobook.title,
    audiobook.author || undefined,
    audiobook.isbn || undefined,
    googleBooksApiKey
  );
  
  if (result.success && result.coverUrl) {
    // Update audiobook record with new cover
    await storage.updateAudiobook(audiobookId, { coverUrl: result.coverUrl });
    console.log(`[CoverFetcher] Updated audiobook ${audiobookId} with new cover: ${result.coverUrl}`);
  }
  
  return result;
}

/**
 * Search for available cover options from Open Library
 */
async function searchOpenLibraryCovers(
  title: string,
  author?: string,
  isbn?: string
): Promise<CoverOption[]> {
  const covers: CoverOption[] = [];
  const seenIds = new Set<string>();
  
  try {
    // Try ISBN-based covers first
    if (isbn) {
      const cleanIsbn = isbn.replace(/[-\s]/g, '');
      const previewUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
      
      // Check if the cover exists and is valid
      try {
        const response = await fetch(previewUrl, { method: 'HEAD' });
        if (response.ok) {
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength) > 1000) {
            covers.push({
              url: previewUrl,
              source: 'openlibrary',
              previewUrl,
              workTitle: title,
              workId: `ol-isbn-${cleanIsbn}`,
            });
            seenIds.add(`ol-isbn-${cleanIsbn}`);
          }
        }
      } catch (e) {
        // Ignore fetch errors
      }
    }
    
    // Search by title and author
    const searchQuery = author 
      ? `title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
      : `title=${encodeURIComponent(title)}`;
    
    const searchUrl = `https://openlibrary.org/search.json?${searchQuery}&limit=10`;
    const searchResponse = await fetch(searchUrl);
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      
      if (searchData.docs) {
        for (const doc of searchData.docs) {
          // Use cover_i (cover ID)
          if (doc.cover_i) {
            const workId = `ol-cover-${doc.cover_i}`;
            if (!seenIds.has(workId)) {
              seenIds.add(workId);
              covers.push({
                url: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
                source: 'openlibrary',
                previewUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
                workTitle: doc.title,
                workId,
              });
            }
          }
          
          // Also try ISBN from search results
          if (doc.isbn && doc.isbn.length > 0) {
            const docIsbn = doc.isbn[0];
            const workId = `ol-isbn-${docIsbn}`;
            if (!seenIds.has(workId)) {
              seenIds.add(workId);
              covers.push({
                url: `https://covers.openlibrary.org/b/isbn/${docIsbn}-L.jpg`,
                source: 'openlibrary',
                previewUrl: `https://covers.openlibrary.org/b/isbn/${docIsbn}-M.jpg`,
                workTitle: doc.title,
                workId,
              });
            }
          }
          
          // Limit to 6 covers from Open Library
          if (covers.length >= 6) break;
        }
      }
    }
  } catch (error) {
    console.error('[CoverFetcher] Error searching Open Library:', error);
  }
  
  return covers;
}

/**
 * Search for available cover options from Google Books
 */
async function searchGoogleBooksCovers(
  title: string,
  author?: string,
  isbn?: string,
  apiKey?: string
): Promise<CoverOption[]> {
  const covers: CoverOption[] = [];
  const seenIds = new Set<string>();
  
  try {
    let query: string;
    
    if (isbn) {
      query = `isbn:${isbn.replace(/[-\s]/g, '')}`;
    } else if (author) {
      query = `intitle:${title}+inauthor:${author}`;
    } else {
      query = `intitle:${title}`;
    }
    
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '10');
    if (apiKey) {
      url.searchParams.set('key', apiKey);
    }
    
    const response = await fetch(url.toString());
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.items) {
        for (const item of data.items) {
          const imageLinks = item.volumeInfo?.imageLinks;
          
          if (imageLinks) {
            let imageUrl = imageLinks.thumbnail || imageLinks.smallThumbnail;
            
            if (imageUrl) {
              // Get high quality version for saving
              const highQualityUrl = imageUrl
                .replace('zoom=1', 'zoom=3')
                .replace('&edge=curl', '')
                .replace('http://', 'https://');
              
              // Preview URL (medium quality)
              const previewUrl = imageUrl
                .replace('zoom=1', 'zoom=2')
                .replace('&edge=curl', '')
                .replace('http://', 'https://');
              
              const workId = `gb-${item.id}`;
              if (!seenIds.has(workId)) {
                seenIds.add(workId);
                covers.push({
                  url: highQualityUrl,
                  source: 'googlebooks',
                  previewUrl,
                  workTitle: item.volumeInfo?.title,
                  workId,
                });
              }
            }
          }
          
          // Limit to 6 covers from Google Books
          if (covers.length >= 6) break;
        }
      }
    }
  } catch (error) {
    console.error('[CoverFetcher] Error searching Google Books:', error);
  }
  
  return covers;
}

/**
 * Search for all available cover options from multiple sources
 */
export async function searchCoverOptions(
  title: string,
  author?: string,
  isbn?: string,
  googleBooksApiKey?: string
): Promise<CoverSearchResult> {
  console.log(`[CoverFetcher] Searching for cover options: "${title}" by ${author || 'unknown'}, ISBN: ${isbn || 'none'}`);
  
  try {
    // Search both sources in parallel
    const [openLibraryCovers, googleBooksCovers] = await Promise.all([
      searchOpenLibraryCovers(title, author, isbn),
      searchGoogleBooksCovers(title, author, isbn, googleBooksApiKey),
    ]);
    
    // Combine results, preferring Open Library first
    const allCovers = [...openLibraryCovers, ...googleBooksCovers];
    
    console.log(`[CoverFetcher] Found ${allCovers.length} cover options (${openLibraryCovers.length} from Open Library, ${googleBooksCovers.length} from Google Books)`);
    
    return {
      success: true,
      covers: allCovers,
    };
  } catch (error: any) {
    console.error('[CoverFetcher] Error searching for covers:', error);
    return {
      success: false,
      covers: [],
      error: error.message,
    };
  }
}

/**
 * Download and save a cover from a URL
 */
export async function saveCoverFromUrl(coverUrl: string): Promise<CoverFetchResult> {
  try {
    console.log(`[CoverFetcher] Downloading cover from: ${coverUrl}`);
    
    const response = await fetch(coverUrl);
    
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to download cover: ${response.status}`,
      };
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    if (buffer.length < 1000) {
      return {
        success: false,
        error: 'Cover image too small or invalid',
      };
    }
    
    // Optimize and save the cover image
    const optimizedCover = await optimizeCover(buffer, {
      maxWidth: 600,
      maxHeight: 900,
      quality: 85,
      format: 'webp',
    });
    
    console.log(`[CoverFetcher] Optimized cover: ${buffer.length} -> ${optimizedCover.length} bytes`);
    
    // Save to local storage
    const savedUrl = await saveLocalFile(optimizedCover, 'covers', '.webp');
    
    // Determine source from URL
    const source = coverUrl.includes('openlibrary') ? 'openlibrary' : 'googlebooks';
    
    return {
      success: true,
      coverUrl: savedUrl,
      source,
    };
  } catch (error: any) {
    console.error('[CoverFetcher] Error saving cover from URL:', error);
    return {
      success: false,
      error: `Failed to save cover: ${error.message}`,
    };
  }
}
