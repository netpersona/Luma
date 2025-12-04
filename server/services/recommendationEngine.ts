/**
 * Recommendation Engine
 * Analyzes user's library to generate personalized book recommendations
 */

import type { Book, Audiobook } from '@shared/schema';
import * as crypto from 'crypto';
import {
  searchBooksByAuthor,
  searchBooksBySubject,
  volumeToRecommendation,
  type RecommendationItem,
} from './googleBooksAdapter';

export interface UserLibraryProfile {
  favoriteAuthors: string[];
  topGenres: string[];
  topTags: string[];
  preferredSeries: string[];
}

/**
 * Analyze user's library to create a preference profile
 */
export function analyzeLibrary(books: Book[], audiobooks: Audiobook[]): UserLibraryProfile {
  const authorCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const seriesCounts = new Map<string, number>();

  const allItems = [...books, ...audiobooks];

  for (const item of allItems) {
    // Count authors
    if (item.author) {
      const authors = item.author.split(/[,;&]/).map(a => a.trim());
      for (const author of authors) {
        if (author) {
          authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
        }
      }
    }

    // Count tags as genres
    if (item.tags && item.tags.length > 0) {
      for (const tag of item.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Count series
    if (item.series) {
      seriesCounts.set(item.series, (seriesCounts.get(item.series) || 0) + 1);
    }
  }

  // Get top authors (at least 2 books)
  const favoriteAuthors = Array.from(authorCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([author]) => author);

  // Get top tags/genres
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // Get series user is reading
  const preferredSeries = Array.from(seriesCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([series]) => series);

  return {
    favoriteAuthors,
    topGenres: topTags, // Using tags as genres
    topTags,
    preferredSeries,
  };
}

/**
 * Generate a cache key based on library state
 */
export function generateCacheKey(
  books: Book[],
  audiobooks: Audiobook[],
  userId: string = 'default'
): string {
  const profile = analyzeLibrary(books, audiobooks);
  const keyData = JSON.stringify({
    userId,
    favoriteAuthors: profile.favoriteAuthors.sort(),
    topTags: profile.topTags.sort(),
    bookCount: books.length,
    audiobookCount: audiobooks.length,
  });
  
  return crypto.createHash('sha256').update(keyData).digest('hex');
}

/**
 * Fetch recommendations from Google Books based on user profile
 */
export async function fetchRecommendations(
  profile: UserLibraryProfile,
  apiKey: string,
  maxResults: number = 20
): Promise<RecommendationItem[]> {
  const recommendations = new Map<string, RecommendationItem>();

  try {
    // Fetch books by favorite authors
    for (const author of profile.favoriteAuthors.slice(0, 3)) {
      try {
        const volumes = await searchBooksByAuthor(author, apiKey, 10);
        for (const volume of volumes) {
          const rec = volumeToRecommendation(volume);
          if (!recommendations.has(rec.googleBooksId)) {
            recommendations.set(rec.googleBooksId, rec);
          }
        }
      } catch (error) {
        console.error(`[RecommendationEngine] Error fetching books by ${author}:`, error);
      }
    }

    // Fetch books by top genres/tags
    for (const genre of profile.topGenres.slice(0, 3)) {
      try {
        const volumes = await searchBooksBySubject(genre, apiKey, 10);
        for (const volume of volumes) {
          const rec = volumeToRecommendation(volume);
          if (!recommendations.has(rec.googleBooksId)) {
            recommendations.set(rec.googleBooksId, rec);
          }
        }
      } catch (error) {
        console.error(`[RecommendationEngine] Error fetching books for ${genre}:`, error);
      }
    }

    // Convert to array and limit results
    return Array.from(recommendations.values()).slice(0, maxResults);
  } catch (error) {
    console.error('[RecommendationEngine] Error generating recommendations:', error);
    return [];
  }
}

/**
 * Score and rank recommendations based on relevance to user profile
 */
export function scoreRecommendations(
  recommendations: RecommendationItem[],
  profile: UserLibraryProfile,
  existingItems: Set<string> // ISBNs or titles of books already in library
): RecommendationItem[] {
  const scored = recommendations.map(rec => {
    let score = 0;

    // Skip if already in library
    if (rec.isbn && existingItems.has(rec.isbn)) {
      return { rec, score: -1 };
    }
    if (existingItems.has(rec.title.toLowerCase())) {
      return { rec, score: -1 };
    }

    // Bonus for favorite authors
    if (profile.favoriteAuthors.some(author => 
      rec.author.toLowerCase().includes(author.toLowerCase())
    )) {
      score += 10;
    }

    // Bonus for matching genres/tags
    if (rec.categories) {
      for (const category of rec.categories) {
        if (profile.topGenres.some(genre => 
          category.toLowerCase().includes(genre.toLowerCase())
        )) {
          score += 5;
        }
      }
    }

    // Bonus for high ratings
    if (rec.averageRating) {
      score += rec.averageRating;
    }

    return { rec, score };
  });

  // Filter out items already in library and sort by score
  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ rec }) => rec);
}

/**
 * Apply diversity to recommendations to avoid showing too many books by the same author
 * Uses a "round-robin" approach: picks from each author in turns to ensure variety
 * Preserves all recommendations - once all authors hit their limit, remaining items are appended
 */
export function diversifyRecommendations(
  recommendations: RecommendationItem[],
  maxPerAuthor: number = 3
): RecommendationItem[] {
  if (recommendations.length === 0) return [];
  
  const UNKNOWN_AUTHOR = '__unknown__';
  
  // Group by author (handle missing/blank authors)
  const byAuthor = new Map<string, RecommendationItem[]>();
  
  for (const rec of recommendations) {
    const authorKey = rec.author && rec.author.trim() 
      ? rec.author.toLowerCase() 
      : UNKNOWN_AUTHOR;
    if (!byAuthor.has(authorKey)) {
      byAuthor.set(authorKey, []);
    }
    byAuthor.get(authorKey)!.push(rec);
  }
  
  // Round-robin selection from each author group (up to maxPerAuthor)
  const diversified: RecommendationItem[] = [];
  const overflow: RecommendationItem[] = [];
  const authorQueues = Array.from(byAuthor.values());
  const authorCounts = new Map<string, number>();
  
  // First pass: round-robin until all authors hit maxPerAuthor
  let added = true;
  while (added) {
    added = false;
    for (const queue of authorQueues) {
      if (queue.length > 0) {
        const rec = queue[0];
        const authorKey = rec.author && rec.author.trim() 
          ? rec.author.toLowerCase() 
          : UNKNOWN_AUTHOR;
        const count = authorCounts.get(authorKey) || 0;
        
        if (count < maxPerAuthor) {
          diversified.push(queue.shift()!);
          authorCounts.set(authorKey, count + 1);
          added = true;
        }
      }
    }
  }
  
  // Collect remaining items from all queues
  for (const queue of authorQueues) {
    overflow.push(...queue);
  }
  
  // Return diversified recommendations followed by overflow
  return [...diversified, ...overflow];
}

/**
 * Add "reason" field explaining why a book was recommended
 */
export function addRecommendationReasons(
  recommendations: RecommendationItem[],
  profile: UserLibraryProfile
): RecommendationItem[] {
  return recommendations.map(rec => {
    const reasons: string[] = [];
    
    // Check if by favorite author
    const matchedAuthor = profile.favoriteAuthors.find(author =>
      rec.author.toLowerCase().includes(author.toLowerCase())
    );
    if (matchedAuthor) {
      reasons.push(`By ${matchedAuthor}, one of your favorite authors`);
    }
    
    // Check if matches genre
    if (rec.categories) {
      const matchedGenres = rec.categories.filter(cat =>
        profile.topGenres.some(genre => 
          cat.toLowerCase().includes(genre.toLowerCase())
        )
      );
      if (matchedGenres.length > 0) {
        reasons.push(`Matches your interest in ${matchedGenres[0]}`);
      }
    }
    
    // Default reason
    if (reasons.length === 0) {
      if (rec.averageRating && rec.averageRating >= 4) {
        reasons.push('Highly rated by readers');
      } else {
        reasons.push('Based on your reading preferences');
      }
    }
    
    return {
      ...rec,
      reason: reasons[0],
    };
  });
}
