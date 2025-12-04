/**
 * Google Books API Adapter
 * Fetches book metadata and recommendations using user's API key
 */

export interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    pageCount?: number;
    categories?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    language?: string;
    averageRating?: number;
  };
}

export interface RecommendationItem {
  googleBooksId: string;
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  isbn?: string;
  publishedDate?: string;
  publisher?: string;
  categories?: string[];
  averageRating?: number;
  pageCount?: number;
}

/**
 * Search Google Books by query
 */
export async function searchGoogleBooks(
  query: string,
  apiKey: string,
  maxResults: number = 10
): Promise<GoogleBooksVolume[]> {
  try {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Invalid or unauthorized Google Books API key');
      }
      throw new Error(`Google Books API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error: any) {
    console.error('[GoogleBooksAdapter] Search error:', error.message);
    throw error;
  }
}

/**
 * Get a specific book by Google Books ID
 */
export async function getGoogleBook(
  bookId: string,
  apiKey: string
): Promise<GoogleBooksVolume | null> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes/${bookId}?key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Google Books API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[GoogleBooksAdapter] Get book error:', error.message);
    throw error;
  }
}

/**
 * Search for books by author
 */
export async function searchBooksByAuthor(
  author: string,
  apiKey: string,
  maxResults: number = 20
): Promise<GoogleBooksVolume[]> {
  return searchGoogleBooks(`inauthor:"${author}"`, apiKey, maxResults);
}

/**
 * Search for books by subject/category
 */
export async function searchBooksBySubject(
  subject: string,
  apiKey: string,
  maxResults: number = 20
): Promise<GoogleBooksVolume[]> {
  return searchGoogleBooks(`subject:"${subject}"`, apiKey, maxResults);
}

/**
 * Convert Google Books volume to RecommendationItem
 */
export function volumeToRecommendation(volume: GoogleBooksVolume): RecommendationItem {
  const isbn = volume.volumeInfo.industryIdentifiers?.find(
    id => id.type === 'ISBN_13' || id.type === 'ISBN_10'
  )?.identifier;

  return {
    googleBooksId: volume.id,
    title: volume.volumeInfo.title,
    author: volume.volumeInfo.authors?.join(', ') || 'Unknown Author',
    description: volume.volumeInfo.description,
    coverUrl: volume.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
    isbn,
    publishedDate: volume.volumeInfo.publishedDate,
    publisher: volume.volumeInfo.publisher,
    categories: volume.volumeInfo.categories,
    averageRating: volume.volumeInfo.averageRating,
    pageCount: volume.volumeInfo.pageCount,
  };
}

/**
 * Validate API key by making a test request
 * Returns detailed error message if validation fails
 */
export async function validateGoogleBooksApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', 'test');
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[GoogleBooksAdapter] Validation failed:', response.status, errorData);
      
      if (response.status === 400) {
        return { 
          valid: false, 
          error: 'Invalid API key format. Please check your key and try again.' 
        };
      }
      
      if (response.status === 403) {
        const errorMessage = errorData.error?.message || '';
        if (errorMessage.includes('Books API has not been used')) {
          return { 
            valid: false, 
            error: 'Books API not enabled. Enable "Books API" in your Google Cloud Console.' 
          };
        }
        if (errorMessage.includes('API key not valid')) {
          return { 
            valid: false, 
            error: 'API key not valid. Check that your key is copied correctly without extra spaces.' 
          };
        }
        if (errorMessage.includes('referer')) {
          return { 
            valid: false, 
            error: 'API key has HTTP referrer restrictions. Remove restrictions or add your domain.' 
          };
        }
        return { 
          valid: false, 
          error: 'API key unauthorized. Check your key restrictions in Google Cloud Console.' 
        };
      }
      
      if (response.status === 429) {
        return { 
          valid: false, 
          error: 'Rate limit exceeded. Wait a moment and try again.' 
        };
      }
      
      return { 
        valid: false, 
        error: `API request failed: ${response.statusText}` 
      };
    }

    const data = await response.json();
    console.log('[GoogleBooksAdapter] Validation successful');
    return { valid: true };
  } catch (error: any) {
    console.error('[GoogleBooksAdapter] Validation error:', error.message);
    return { 
      valid: false, 
      error: `Network error: ${error.message}. Check your internet connection.` 
    };
  }
}
