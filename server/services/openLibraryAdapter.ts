/**
 * Open Library API Adapter
 * Fetches book metadata and search results using the free Open Library API
 * No API key required
 */

export interface OpenLibraryWork {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  subject?: string[];
  language?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
  ratings_average?: number;
  edition_count?: number;
}

export interface OpenLibrarySearchResponse {
  numFound: number;
  start: number;
  docs: OpenLibraryWork[];
}

export interface SimilarBookResult {
  source: 'openlibrary' | 'googlebooks' | 'annas-archive';
  id: string;
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  isbn?: string;
  publishedYear?: number;
  publisher?: string;
  subjects?: string[];
  rating?: number;
  pageCount?: number;
  format?: string;
  downloadable?: boolean;
  md5?: string;
}

/**
 * Search Open Library by query
 */
export async function searchOpenLibrary(
  query: string,
  limit: number = 10
): Promise<OpenLibraryWork[]> {
  try {
    const url = new URL('https://openlibrary.org/search.json');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,isbn,subject,language,publisher,number_of_pages_median,ratings_average,edition_count');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Luma-Reader/1.0 (https://github.com/luma-reader)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Open Library API error: ${response.statusText}`);
    }

    const data: OpenLibrarySearchResponse = await response.json();
    return data.docs || [];
  } catch (error: any) {
    console.error('[OpenLibraryAdapter] Search error:', error.message);
    throw error;
  }
}

/**
 * Search Open Library by author name
 */
export async function searchByAuthor(
  author: string,
  limit: number = 10
): Promise<OpenLibraryWork[]> {
  return searchOpenLibrary(`author:"${author}"`, limit);
}

/**
 * Search Open Library by subject/category
 */
export async function searchBySubject(
  subject: string,
  limit: number = 10
): Promise<OpenLibraryWork[]> {
  return searchOpenLibrary(`subject:"${subject}"`, limit);
}

/**
 * Search for similar books by title, author, and subjects (tags)
 * Prioritizes books with matching subjects and by the same author
 */
export async function findSimilarBooks(
  title: string,
  author?: string,
  subjects?: string[],
  limit: number = 10
): Promise<SimilarBookResult[]> {
  const results: Map<string, SimilarBookResult & { relevanceScore: number }> = new Map();
  
  // Normalize title for comparison
  const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const originalTitleNormalized = normalizeTitle(title);
  
  // Clean up subjects for searching
  const cleanSubjects = (subjects || [])
    .map(s => s.trim())
    .filter(s => s.length > 2 && s.length < 40)
    .slice(0, 5); // Use up to 5 subjects for searching

  try {
    const searchPromises: Promise<{ works: OpenLibraryWork[]; type: string; subject?: string }>[] = [];

    // Search by author (high relevance)
    if (author) {
      searchPromises.push(
        searchByAuthor(author, 15).then(works => ({ works, type: 'author' }))
      );
    }

    // Search by each subject individually (medium-high relevance)
    for (const subject of cleanSubjects.slice(0, 3)) {
      searchPromises.push(
        searchBySubject(subject, 8).then(works => ({ works, type: 'subject', subject }))
      );
    }

    // Search by combined subjects for popular books with these tags
    if (cleanSubjects.length >= 2) {
      const combinedQuery = cleanSubjects.slice(0, 2).map(s => `subject:"${s}"`).join(' ');
      searchPromises.push(
        searchOpenLibrary(combinedQuery + ' sort:rating', 10)
          .then(works => ({ works, type: 'combined_subjects' }))
      );
    }

    // Execute all searches in parallel
    const searchResults = await Promise.allSettled(searchPromises);

    for (const result of searchResults) {
      if (result.status !== 'fulfilled') continue;
      
      const { works, type, subject } = result.value;
      
      for (const work of works) {
        const normalized = normalizeTitle(work.title);
        
        // Skip the original book
        if (normalized === originalTitleNormalized) continue;
        
        const existing = results.get(normalized);
        const bookResult = workToSimilarBook(work);
        
        // Calculate relevance score
        let relevanceScore = 0;
        
        // Higher score for books by the same author
        if (type === 'author') {
          relevanceScore += 30;
        }
        
        // Score for matching subjects
        if (type === 'subject' && subject) {
          relevanceScore += 20;
        }
        
        // Bonus for combined subject matches
        if (type === 'combined_subjects') {
          relevanceScore += 25;
        }
        
        // Bonus for having a good rating
        if (work.ratings_average && work.ratings_average > 3.5) {
          relevanceScore += Math.floor((work.ratings_average - 3) * 10);
        }
        
        // Bonus for popular books (more editions)
        if (work.edition_count && work.edition_count > 10) {
          relevanceScore += Math.min(work.edition_count / 5, 10);
        }
        
        // Count how many of the original subjects this book shares
        if (work.subject && cleanSubjects.length > 0) {
          const workSubjectsLower = work.subject.map(s => s.toLowerCase());
          const matchingSubjects = cleanSubjects.filter(s => 
            workSubjectsLower.some(ws => ws.includes(s.toLowerCase()) || s.toLowerCase().includes(ws))
          );
          relevanceScore += matchingSubjects.length * 5;
        }
        
        if (existing) {
          // Accumulate relevance scores for books found in multiple searches
          existing.relevanceScore += relevanceScore;
        } else {
          results.set(normalized, { ...bookResult, relevanceScore });
        }
      }
    }

    // If still need more results, search by title keywords as fallback
    if (results.size < limit) {
      const titleWords = title.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
      if (titleWords.length > 0) {
        const titleResults = await searchOpenLibrary(titleWords.join(' '), limit);
        for (const work of titleResults) {
          const normalized = normalizeTitle(work.title);
          if (normalized !== originalTitleNormalized && !results.has(normalized)) {
            results.set(normalized, { ...workToSimilarBook(work), relevanceScore: 5 });
          }
        }
      }
    }

    // Sort by relevance score and return
    const sortedResults = Array.from(results.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
      .map(({ relevanceScore, ...rest }) => rest); // Remove the score from output

    console.log(`[OpenLibraryAdapter] Found ${sortedResults.length} similar books, top scores: ${
      Array.from(results.values()).slice(0, 3).map(r => r.relevanceScore).join(', ')
    }`);

    return sortedResults;
  } catch (error: any) {
    console.error('[OpenLibraryAdapter] Find similar error:', error.message);
    return [];
  }
}

/**
 * Convert Open Library work to SimilarBookResult
 */
function workToSimilarBook(work: OpenLibraryWork): SimilarBookResult {
  return {
    source: 'openlibrary',
    id: work.key,
    title: work.title,
    author: work.author_name?.join(', ') || 'Unknown Author',
    coverUrl: work.cover_i 
      ? `https://covers.openlibrary.org/b/id/${work.cover_i}-M.jpg`
      : undefined,
    isbn: work.isbn?.[0],
    publishedYear: work.first_publish_year,
    publisher: work.publisher?.[0],
    subjects: work.subject?.slice(0, 5),
    rating: work.ratings_average,
    pageCount: work.number_of_pages_median,
    downloadable: false,
  };
}

/**
 * Get cover URL for an Open Library book
 */
export function getOpenLibraryCover(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/**
 * Get cover URL by ISBN
 */
export function getCoverByIsbn(isbn: string, size: 'S' | 'M' | 'L' = 'M'): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
}

/**
 * Series metadata extracted from Open Library
 */
export interface SeriesMetadata {
  seriesName: string | null;
  seriesIndex: number | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'openlibrary' | 'title_pattern';
}

/**
 * Work details response from Open Library
 */
interface OpenLibraryWorkDetails {
  key: string;
  title: string;
  subjects?: string[];
  description?: string | { value: string };
  authors?: { author: { key: string } }[];
  first_publish_date?: string;
}

/**
 * Fetch detailed work information from Open Library
 * This includes subjects with series tags
 */
export async function getWorkDetails(workKey: string): Promise<OpenLibraryWorkDetails | null> {
  try {
    // Ensure workKey starts with /works/
    const key = workKey.startsWith('/works/') ? workKey : `/works/${workKey}`;
    const url = `https://openlibrary.org${key}.json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Luma-Reader/1.0 (https://github.com/luma-reader)'
      }
    });

    if (!response.ok) {
      console.error(`[OpenLibraryAdapter] Failed to fetch work details: ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error: any) {
    console.error('[OpenLibraryAdapter] Get work details error:', error.message);
    return null;
  }
}

/**
 * Extract series name from Open Library subjects
 * Open Library stores series as "series:series_name_here" in subjects
 */
function extractSeriesFromSubjects(subjects: string[]): string | null {
  for (const subject of subjects) {
    if (subject.toLowerCase().startsWith('series:')) {
      // Extract series name and format it properly
      const rawSeriesName = subject.substring(7); // Remove "series:" prefix
      // Convert underscores to spaces and title case
      return rawSeriesName
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
    }
  }
  return null;
}

/**
 * Extract book number from title using common patterns
 */
function extractBookNumberFromTitle(title: string): number | null {
  const lowerTitle = title.toLowerCase();
  
  // Common patterns for book numbers
  const patterns = [
    // "Book 1", "Book One", "Book #1"
    /book\s*#?\s*(\d+)/i,
    /book\s+(one|two|three|four|five|six|seven|eight|nine|ten)/i,
    
    // "Vol. 1", "Volume 1", "Vol 1"
    /vol(?:ume)?\.?\s*(\d+)/i,
    
    // "Part 1", "Part One"
    /part\s*(\d+)/i,
    /part\s+(one|two|three|four|five|six|seven|eight|nine|ten)/i,
    
    // "#1", "No. 1", "Number 1"
    /#(\d+)/,
    /no\.?\s*(\d+)/i,
    /number\s*(\d+)/i,
    
    // Roman numerals at end: "Title II", "Title III"
    /\s(i{1,3}|iv|vi{0,3}|ix|x)$/i,
    
    // "1st", "2nd", "3rd" book/novel/etc
    /(\d+)(?:st|nd|rd|th)\s*(?:book|novel|volume|installment)/i,
    
    // Trailing number: "Title 2", "Series Name 3"
    /\s(\d+)$/,
  ];
  
  const wordToNumber: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
    'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
  };
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const value = match[1];
      // Check if it's a number or word
      if (/^\d+$/.test(value)) {
        return parseInt(value, 10);
      }
      const lowerValue = value.toLowerCase();
      if (wordToNumber[lowerValue]) {
        return wordToNumber[lowerValue];
      }
    }
  }
  
  return null;
}

/**
 * Extract series name from title using common patterns
 * This is a fallback when Open Library doesn't have series info
 */
function extractSeriesFromTitle(title: string): { seriesName: string; bookNumber: number | null } | null {
  // Common patterns that indicate series in title
  const seriesPatterns = [
    // "Series Name Book 1" or "Series Name: Book 1"
    /^(.+?)[\s:]+book\s*#?\s*\d+/i,
    
    // "Series Name Vol. 1" or "Series Name Volume 1"
    /^(.+?)[\s:]+vol(?:ume)?\.?\s*\d+/i,
    
    // "Series Name Part 1"
    /^(.+?)[\s:]+part\s*\d+/i,
    
    // "Series Name #1" or "Series Name, #1"
    /^(.+?)[,\s:]+#\d+/i,
    
    // "Title (Series Name #1)" - parenthetical series
    /^.+?\((.+?)\s*#?\d+\)/i,
    
    // "Series Name 1" - trailing number with known series patterns
    /^(.+?)\s+\d+$/,
  ];
  
  for (const pattern of seriesPatterns) {
    const match = title.match(pattern);
    if (match) {
      const seriesName = match[1].trim();
      // Filter out too short or likely not series names
      if (seriesName.length >= 3) {
        const bookNumber = extractBookNumberFromTitle(title);
        return { seriesName, bookNumber };
      }
    }
  }
  
  return null;
}

/**
 * Search for a book and extract series metadata
 * Returns series name, book index, and confidence level
 */
export async function fetchSeriesMetadata(
  title: string,
  author?: string
): Promise<SeriesMetadata> {
  try {
    // Build search query
    let query = `title:"${title}"`;
    if (author) {
      query += ` author:"${author}"`;
    }
    
    // Search for the book
    const searchUrl = new URL('https://openlibrary.org/search.json');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('limit', '5');
    searchUrl.searchParams.set('fields', 'key,title,author_name,first_publish_year');
    
    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'Luma-Reader/1.0 (https://github.com/luma-reader)'
      }
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.statusText}`);
    }
    
    const searchData: OpenLibrarySearchResponse = await searchResponse.json();
    
    if (searchData.docs.length === 0) {
      console.log(`[OpenLibraryAdapter] No results found for "${title}"`);
      // Try title pattern matching as fallback
      return tryTitlePatternFallback(title);
    }
    
    // Get the best matching result
    const bestMatch = searchData.docs[0];
    console.log(`[OpenLibraryAdapter] Found match: "${bestMatch.title}" (${bestMatch.key})`);
    
    // Fetch detailed work info to get subjects
    const workDetails = await getWorkDetails(bestMatch.key);
    
    if (workDetails && workDetails.subjects && workDetails.subjects.length > 0) {
      const seriesName = extractSeriesFromSubjects(workDetails.subjects);
      
      if (seriesName) {
        const bookNumber = extractBookNumberFromTitle(title);
        console.log(`[OpenLibraryAdapter] Found series: "${seriesName}", book #${bookNumber || 'unknown'}`);
        
        return {
          seriesName,
          seriesIndex: bookNumber,
          confidence: bookNumber ? 'high' : 'medium',
          source: 'openlibrary'
        };
      }
    }
    
    // Fallback to title pattern matching
    return tryTitlePatternFallback(title);
    
  } catch (error: any) {
    console.error('[OpenLibraryAdapter] Fetch series metadata error:', error.message);
    // Try title pattern as last resort
    return tryTitlePatternFallback(title);
  }
}

/**
 * Fallback to extract series from title patterns
 */
function tryTitlePatternFallback(title: string): SeriesMetadata {
  const titleMatch = extractSeriesFromTitle(title);
  
  if (titleMatch) {
    console.log(`[OpenLibraryAdapter] Title pattern match: series="${titleMatch.seriesName}", #${titleMatch.bookNumber || 'unknown'}`);
    return {
      seriesName: titleMatch.seriesName,
      seriesIndex: titleMatch.bookNumber,
      confidence: 'low',
      source: 'title_pattern'
    };
  }
  
  // Check for just a book number in title
  const bookNumber = extractBookNumberFromTitle(title);
  if (bookNumber) {
    return {
      seriesName: null,
      seriesIndex: bookNumber,
      confidence: 'low',
      source: 'title_pattern'
    };
  }
  
  return {
    seriesName: null,
    seriesIndex: null,
    confidence: 'low',
    source: 'title_pattern'
  };
}

/**
 * Batch fetch series metadata for multiple books
 * Uses parallel requests with rate limiting
 */
export async function batchFetchSeriesMetadata(
  books: Array<{ id: string; title: string; author?: string }>
): Promise<Map<string, SeriesMetadata>> {
  const results = new Map<string, SeriesMetadata>();
  
  // Process in batches to avoid rate limiting
  const batchSize = 5;
  const delayBetweenBatches = 1000; // 1 second delay
  
  for (let i = 0; i < books.length; i += batchSize) {
    const batch = books.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (book) => {
      try {
        const metadata = await fetchSeriesMetadata(book.title, book.author);
        return { id: book.id, metadata };
      } catch (error) {
        console.error(`[OpenLibraryAdapter] Error fetching series for "${book.title}":`, error);
        return { id: book.id, metadata: { seriesName: null, seriesIndex: null, confidence: 'low' as const, source: 'title_pattern' as const } };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const result of batchResults) {
      results.set(result.id, result.metadata);
    }
    
    // Add delay between batches (except for the last batch)
    if (i + batchSize < books.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return results;
}
