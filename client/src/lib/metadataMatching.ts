/**
 * Metadata Matching Utilities
 * 
 * Provides robust matching algorithms for comparing book metadata
 * from recommendations against search results from Anna's Archive.
 */

export interface MatchCandidate {
  title: string;
  author?: string;
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  [key: string]: any;
}

export interface MatchTarget {
  title: string;
  authors: string[];
  isbn10?: string;
  isbn13?: string;
}

export interface MatchResult {
  isMatch: boolean;
  confidence: number;
  matchType: 'isbn' | 'title-author' | 'title-only' | 'none';
  details: {
    titleScore?: number;
    authorScore?: number;
    isbnMatch?: boolean;
  };
}

// Common stopwords to remove from titles
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
  'then', 'once', 'novel', 'book', 'edition', 'volume', 'vol'
]);

// Tokens that indicate a derivative work (not the original book)
const DERIVATIVE_TOKENS = new Set([
  'companion', 'summary', 'workbook', 'guide', 'analysis', 'digest', 
  'notes', 'review', 'study', 'overview', 'introduction', 'commentary',
  'illustrated', 'abridged', 'annotated', 'cliffs', 'sparknotes', 'quicklet'
]);

/**
 * Normalize text: lowercase, remove accents, remove punctuation, collapse whitespace
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize ISBN: remove hyphens and spaces
 */
export function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, '');
}

/**
 * Normalize author name: handle "Lastname, Firstname" format
 */
export function normalizeAuthor(author: string): string {
  const cleaned = normalizeText(author);
  
  // Handle "Lastname, Firstname" format by checking original for comma
  if (author.includes(',')) {
    // Split on comma and reverse
    const parts = cleaned.split(/\s+/);
    // Find where the comma was and reverse those parts
    const commaIdx = author.indexOf(',');
    const beforeComma = normalizeText(author.substring(0, commaIdx));
    const afterComma = normalizeText(author.substring(commaIdx + 1));
    return `${afterComma} ${beforeComma}`.trim();
  }
  
  return cleaned;
}

/**
 * Extract author tokens, handling abbreviations
 */
export function getAuthorTokens(author: string): string[] {
  const normalized = normalizeAuthor(author);
  return normalized
    .split(/\s+/)
    .filter(token => token.length > 0)
    .map(token => {
      // Expand common abbreviations
      if (token.length === 1) return token; // Keep single letters
      if (token.endsWith('.')) return token.replace('.', ''); // Remove trailing period
      return token;
    });
}

/**
 * Get title tokens with stopword removal
 */
export function getTitleTokens(title: string): string[] {
  return normalizeText(title)
    .split(/\s+/)
    .filter(token => token && !STOPWORDS.has(token));
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  
  // Create distance matrix
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate normalized Levenshtein similarity (0-1, 1 = identical)
 */
export function levenshteinSimilarity(s1: string, s2: string): number {
  const n1 = normalizeText(s1);
  const n2 = normalizeText(s2);
  
  if (n1 === n2) return 1;
  if (n1.length === 0 || n2.length === 0) return 0;
  
  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  
  return 1 - (distance / maxLen);
}

/**
 * Calculate Jaccard similarity between two token sets
 */
export function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersectionCount = tokens1.filter(t => set2.has(t)).length;
  const unionSize = new Set([...tokens1, ...tokens2]).size;
  
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

/**
 * Calculate containment ratio (what fraction of tokens1 appear in tokens2)
 */
export function containmentRatio(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0) return 0;
  
  const set2 = new Set(tokens2);
  const matchCount = tokens1.filter(t => set2.has(t)).length;
  
  return matchCount / tokens1.length;
}

/**
 * Calculate bidirectional containment (minimum of both directions)
 */
export function bidirectionalContainment(tokens1: string[], tokens2: string[]): number {
  return Math.min(
    containmentRatio(tokens1, tokens2),
    containmentRatio(tokens2, tokens1)
  );
}

/**
 * Check if two titles match (handles subtitles, reordering)
 */
export function matchTitles(title1: string, title2: string): { match: boolean; score: number } {
  const tokens1 = getTitleTokens(title1);
  const tokens2 = getTitleTokens(title2);
  
  // Check exact normalized match first
  if (normalizeText(title1) === normalizeText(title2)) {
    return { match: true, score: 1.0 };
  }
  
  // Calculate various similarity metrics
  const jaccard = jaccardSimilarity(tokens1, tokens2);
  const biContainment = bidirectionalContainment(tokens1, tokens2);
  const levenshtein = levenshteinSimilarity(title1, title2);
  
  // For subtitle handling: check if shorter title tokens are contained in longer
  const shorter = tokens1.length <= tokens2.length ? tokens1 : tokens2;
  const longer = tokens1.length > tokens2.length ? tokens1 : tokens2;
  const shorterSet = new Set(shorter);
  const longerSet = new Set(longer);
  
  // Check if all shorter tokens appear in longer
  const containedCount = shorter.filter(t => longerSet.has(t)).length;
  const containment = shorter.length > 0 ? containedCount / shorter.length : 0;
  
  // Find extra tokens (in longer but not in shorter)
  const extraTokens = longer.filter(t => !shorterSet.has(t));
  
  // Check for derivative work tokens in extras
  const hasDerivativeToken = extraTokens.some(t => DERIVATIVE_TOKENS.has(t));
  
  // Calculate subtitle score: starts at 0.95 for perfect containment, 
  // penalized by extra tokens (0.03 per extra token, max 0.20 penalty)
  const extraPenalty = Math.min(0.20, extraTokens.length * 0.03);
  // For single token titles, require perfect containment but apply slightly higher penalty
  const minTokens = shorter.length >= 1;
  const singleTokenPenalty = shorter.length === 1 ? 0.05 : 0;
  const subtitleScore = containment >= 0.95 && minTokens
    ? 0.95 - extraPenalty - singleTokenPenalty
    : 0;
  
  // If derivative tokens are found, cap the subtitle score low
  const cappedSubtitleScore = hasDerivativeToken ? Math.min(subtitleScore, 0.4) : subtitleScore;
  
  // Take the best score from all metrics
  let score = Math.max(jaccard, biContainment, levenshtein, cappedSubtitleScore);
  
  // Match if score is high enough
  const match = score >= 0.75;
  
  return { match, score };
}

/**
 * Check if authors match (handles multiple authors, abbreviations, name order)
 */
export function matchAuthors(resultAuthor: string, targetAuthors: string[]): { match: boolean; score: number } {
  if (!resultAuthor || targetAuthors.length === 0) {
    // If either is missing, don't penalize but don't confirm match either
    return { match: true, score: 0.5 };
  }
  
  const normalizedResult = normalizeAuthor(resultAuthor);
  const resultTokens = getAuthorTokens(resultAuthor);
  
  // For each target author, check if they appear in the result
  let bestScore = 0;
  
  for (const targetAuthor of targetAuthors) {
    const normalizedTarget = normalizeAuthor(targetAuthor);
    const targetTokens = getAuthorTokens(targetAuthor);
    
    // Check substring containment (handles "Neil Gaiman" in "Neil Gaiman; Terry Pratchett")
    if (normalizedResult.includes(normalizedTarget) || normalizedTarget.includes(normalizedResult)) {
      bestScore = Math.max(bestScore, 0.95);
      continue;
    }
    
    // Check if all significant target tokens appear in result
    // Filter out single-letter tokens (initials) for this check
    const significantTokens = targetTokens.filter(t => t.length > 1);
    const matchingTokens = significantTokens.filter(token => 
      resultTokens.some(rt => rt.includes(token) || token.includes(rt))
    );
    
    if (significantTokens.length > 0 && matchingTokens.length === significantTokens.length) {
      bestScore = Math.max(bestScore, 0.9);
      continue;
    }
    
    // Partial token match
    if (significantTokens.length > 0) {
      const partialScore = matchingTokens.length / significantTokens.length;
      bestScore = Math.max(bestScore, partialScore * 0.8);
    }
    
    // Levenshtein similarity as fallback
    const levenshtein = levenshteinSimilarity(normalizedResult, normalizedTarget);
    bestScore = Math.max(bestScore, levenshtein * 0.9);
  }
  
  return { match: bestScore >= 0.6, score: bestScore };
}

/**
 * Check if ISBNs match
 */
export function matchIsbn(candidate: MatchCandidate, target: MatchTarget): boolean {
  // Collect all ISBNs from candidate
  const candidateIsbns: string[] = [];
  
  if (candidate.isbn) {
    candidateIsbns.push(normalizeIsbn(candidate.isbn));
  }
  if (candidate.isbn10) {
    candidateIsbns.push(normalizeIsbn(candidate.isbn10));
  }
  if (candidate.isbn13) {
    candidateIsbns.push(normalizeIsbn(candidate.isbn13));
  }
  
  // Collect all ISBNs from target
  const targetIsbns: string[] = [];
  if (target.isbn10) {
    targetIsbns.push(normalizeIsbn(target.isbn10));
  }
  if (target.isbn13) {
    targetIsbns.push(normalizeIsbn(target.isbn13));
  }
  
  // Check for any match
  for (const cIsbn of candidateIsbns) {
    for (const tIsbn of targetIsbns) {
      if (cIsbn === tIsbn || cIsbn.includes(tIsbn) || tIsbn.includes(cIsbn)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Main matching function: determines if a candidate matches a target
 */
export function matchMetadata(candidate: MatchCandidate, target: MatchTarget): MatchResult {
  // Stage 1: ISBN matching (most reliable)
  if (matchIsbn(candidate, target)) {
    return {
      isMatch: true,
      confidence: 1.0,
      matchType: 'isbn',
      details: { isbnMatch: true }
    };
  }
  
  // Stage 2: Title matching
  const titleResult = matchTitles(candidate.title, target.title);
  
  if (!titleResult.match) {
    return {
      isMatch: false,
      confidence: titleResult.score,
      matchType: 'none',
      details: { titleScore: titleResult.score }
    };
  }
  
  // Stage 3: Author matching (when available)
  const authorResult = matchAuthors(candidate.author || '', target.authors);
  
  // Combined confidence
  const confidence = (titleResult.score * 0.6) + (authorResult.score * 0.4);
  
  // Require author match if authors are specified
  if (target.authors.length > 0 && !authorResult.match) {
    return {
      isMatch: false,
      confidence,
      matchType: 'none',
      details: { titleScore: titleResult.score, authorScore: authorResult.score }
    };
  }
  
  return {
    isMatch: true,
    confidence,
    matchType: target.authors.length > 0 ? 'title-author' : 'title-only',
    details: { titleScore: titleResult.score, authorScore: authorResult.score }
  };
}

/**
 * Find the best matching candidate from a list
 */
export function findBestMatch(
  candidates: MatchCandidate[], 
  target: MatchTarget
): { candidate: MatchCandidate | null; result: MatchResult | null } {
  let bestCandidate: MatchCandidate | null = null;
  let bestResult: MatchResult | null = null;
  
  for (const candidate of candidates) {
    const result = matchMetadata(candidate, target);
    
    if (result.isMatch) {
      if (!bestResult || result.confidence > bestResult.confidence) {
        bestCandidate = candidate;
        bestResult = result;
      }
    }
  }
  
  return { candidate: bestCandidate, result: bestResult };
}
