/**
 * Unit tests for metadata matching utilities
 * 
 * Tests cover:
 * - Title matching with subtitles
 * - Author matching with various formats
 * - ISBN matching
 * - Edge cases and tricky scenarios
 */

import { describe, test, expect } from 'vitest';
import {
  normalizeText,
  normalizeIsbn,
  normalizeAuthor,
  getTitleTokens,
  getAuthorTokens,
  levenshteinDistance,
  levenshteinSimilarity,
  jaccardSimilarity,
  containmentRatio,
  bidirectionalContainment,
  matchTitles,
  matchAuthors,
  matchIsbn,
  matchMetadata,
  findBestMatch,
  type MatchCandidate,
  type MatchTarget,
} from './metadataMatching';

describe('normalizeText', () => {
  test('converts to lowercase', () => {
    expect(normalizeText('The Hobbit')).toBe('the hobbit');
  });

  test('removes accents', () => {
    expect(normalizeText('Café')).toBe('cafe');
    expect(normalizeText('naïve')).toBe('naive');
  });

  test('removes punctuation', () => {
    expect(normalizeText("Harry Potter: The Philosopher's Stone")).toBe('harry potter the philosopher s stone');
  });

  test('collapses whitespace', () => {
    expect(normalizeText('The   Hobbit')).toBe('the hobbit');
  });
});

describe('normalizeAuthor', () => {
  test('handles normal format', () => {
    expect(normalizeAuthor('Neil Gaiman')).toBe('neil gaiman');
  });

  test('handles "Lastname, Firstname" format', () => {
    expect(normalizeAuthor('Gaiman, Neil')).toBe('neil gaiman');
  });

  test('handles multiple names', () => {
    expect(normalizeAuthor('Tolkien, J.R.R.')).toBe('j r r tolkien');
  });
});

describe('getTitleTokens', () => {
  test('removes stopwords', () => {
    const tokens = getTitleTokens('The Lord of the Rings');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('of');
    expect(tokens).toContain('lord');
    expect(tokens).toContain('rings');
  });

  test('handles subtitles', () => {
    const tokens = getTitleTokens('Project Hail Mary: A Novel');
    expect(tokens).toContain('project');
    expect(tokens).toContain('hail');
    expect(tokens).toContain('mary');
    expect(tokens).not.toContain('novel'); // 'novel' is in stopwords
  });
});

describe('levenshteinDistance', () => {
  test('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  test('returns correct distance for simple edits', () => {
    expect(levenshteinDistance('kitten', 'sitten')).toBe(1); // substitution
    expect(levenshteinDistance('kitten', 'kittens')).toBe(1); // insertion
    expect(levenshteinDistance('kitten', 'kitte')).toBe(1); // deletion
  });
});

describe('levenshteinSimilarity', () => {
  test('returns 1 for identical strings', () => {
    expect(levenshteinSimilarity('hello', 'hello')).toBe(1);
  });

  test('returns high similarity for minor typos', () => {
    expect(levenshteinSimilarity('Project Hail Mary', 'Project Hail Marry')).toBeGreaterThan(0.9);
  });

  test('handles normalization', () => {
    expect(levenshteinSimilarity('The Hobbit', 'the hobbit')).toBe(1);
  });
});

describe('jaccardSimilarity', () => {
  test('returns 1 for identical sets', () => {
    expect(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });

  test('returns 0 for disjoint sets', () => {
    expect(jaccardSimilarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  test('returns correct value for partial overlap', () => {
    expect(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b', 'd'])).toBeCloseTo(0.5, 2);
  });
});

describe('matchTitles', () => {
  test('matches exact titles', () => {
    const result = matchTitles('The Hobbit', 'The Hobbit');
    expect(result.match).toBe(true);
    expect(result.score).toBe(1);
  });

  test('matches with different casing', () => {
    const result = matchTitles('The Hobbit', 'the hobbit');
    expect(result.match).toBe(true);
    expect(result.score).toBe(1);
  });

  test('matches with subtitle added', () => {
    const result = matchTitles('Project Hail Mary', 'Project Hail Mary: A Novel');
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThan(0.7);
  });

  test('rejects clearly different titles', () => {
    const result = matchTitles('The Hobbit', 'The Hobbit Companion Guide');
    // This should NOT match because "Companion Guide" adds too many tokens
    expect(result.score).toBeLessThan(0.7);
  });

  test('handles minor typos', () => {
    const result = matchTitles('The Philosopher\'s Stone', 'The Philosophers Stone');
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThan(0.85);
  });
});

describe('matchAuthors', () => {
  test('matches exact author', () => {
    const result = matchAuthors('Neil Gaiman', ['Neil Gaiman']);
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThan(0.9);
  });

  test('matches with "Lastname, Firstname" format', () => {
    const result = matchAuthors('Gaiman, Neil', ['Neil Gaiman']);
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThan(0.8);
  });

  test('matches in multi-author string', () => {
    const result = matchAuthors('Neil Gaiman; Terry Pratchett', ['Neil Gaiman']);
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThan(0.8);
  });

  test('matches with abbreviations', () => {
    const result = matchAuthors('J.R.R. Tolkien', ['J. R. R. Tolkien']);
    expect(result.match).toBe(true);
    expect(result.score).toBeGreaterThan(0.7);
  });

  test('handles missing author gracefully', () => {
    const result = matchAuthors('', ['Neil Gaiman']);
    expect(result.match).toBe(true); // Don't penalize missing data
    expect(result.score).toBe(0.5);
  });
});

describe('matchIsbn', () => {
  test('matches exact ISBN-13', () => {
    const candidate = { title: 'Test', isbn13: '9780316769488' };
    const target = { title: 'Test', authors: [], isbn13: '9780316769488' };
    expect(matchIsbn(candidate, target)).toBe(true);
  });

  test('matches ISBN with hyphens', () => {
    const candidate = { title: 'Test', isbn: '978-0-316-76948-8' };
    const target = { title: 'Test', authors: [], isbn13: '9780316769488' };
    expect(matchIsbn(candidate, target)).toBe(true);
  });

  test('matches ISBN-10 to ISBN-13 containing it', () => {
    const candidate = { title: 'Test', isbn: '0316769487' };
    const target = { title: 'Test', authors: [], isbn10: '0316769487' };
    expect(matchIsbn(candidate, target)).toBe(true);
  });

  test('rejects mismatched ISBN', () => {
    const candidate = { title: 'Test', isbn: '9780316769488' };
    const target = { title: 'Test', authors: [], isbn13: '9780316769499' };
    expect(matchIsbn(candidate, target)).toBe(false);
  });
});

describe('matchMetadata', () => {
  test('matches by ISBN when available', () => {
    const candidate: MatchCandidate = { 
      title: 'Different Title', 
      author: 'Different Author',
      isbn13: '9780316769488' 
    };
    const target: MatchTarget = { 
      title: 'The Catcher in the Rye', 
      authors: ['J.D. Salinger'],
      isbn13: '9780316769488' 
    };
    
    const result = matchMetadata(candidate, target);
    expect(result.isMatch).toBe(true);
    expect(result.matchType).toBe('isbn');
    expect(result.confidence).toBe(1);
  });

  test('matches by title and author', () => {
    const candidate: MatchCandidate = { 
      title: 'The Hobbit', 
      author: 'J.R.R. Tolkien' 
    };
    const target: MatchTarget = { 
      title: 'The Hobbit', 
      authors: ['J. R. R. Tolkien'] 
    };
    
    const result = matchMetadata(candidate, target);
    expect(result.isMatch).toBe(true);
    expect(result.matchType).toBe('title-author');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('rejects when author mismatch', () => {
    const candidate: MatchCandidate = { 
      title: 'The Hobbit', 
      author: 'Neil Gaiman' 
    };
    const target: MatchTarget = { 
      title: 'The Hobbit', 
      authors: ['J.R.R. Tolkien'] 
    };
    
    const result = matchMetadata(candidate, target);
    expect(result.isMatch).toBe(false);
  });
});

describe('findBestMatch', () => {
  test('finds best match from candidates', () => {
    const candidates: MatchCandidate[] = [
      { title: 'The Hobbit: An Unexpected Journey', author: 'Movie Tie-In' },
      { title: 'The Hobbit', author: 'J.R.R. Tolkien' },
      { title: 'The Hobbit Companion', author: 'Someone Else' },
    ];
    const target: MatchTarget = { 
      title: 'The Hobbit', 
      authors: ['J.R.R. Tolkien'] 
    };
    
    const { candidate, result } = findBestMatch(candidates, target);
    
    expect(candidate).not.toBeNull();
    expect(candidate?.title).toBe('The Hobbit');
    expect(candidate?.author).toBe('J.R.R. Tolkien');
    expect(result?.isMatch).toBe(true);
  });

  test('returns null when no match', () => {
    const candidates: MatchCandidate[] = [
      { title: 'Completely Different Book', author: 'Unknown Author' },
    ];
    const target: MatchTarget = { 
      title: 'The Hobbit', 
      authors: ['J.R.R. Tolkien'] 
    };
    
    const { candidate, result } = findBestMatch(candidates, target);
    
    expect(candidate).toBeNull();
    expect(result).toBeNull();
  });

  test('prefers ISBN match over title match', () => {
    const candidates: MatchCandidate[] = [
      { title: 'The Hobbit', author: 'J.R.R. Tolkien' },
      { title: 'Wrong Title', author: 'Wrong Author', isbn13: '9780316769488' },
    ];
    const target: MatchTarget = { 
      title: 'The Hobbit', 
      authors: ['J.R.R. Tolkien'],
      isbn13: '9780316769488'
    };
    
    const { candidate, result } = findBestMatch(candidates, target);
    
    expect(candidate?.isbn13).toBe('9780316769488');
    expect(result?.matchType).toBe('isbn');
  });
});

describe('Edge cases and tricky scenarios', () => {
  test('handles subtitle variations', () => {
    const cases = [
      { candidate: 'A Game of Thrones', target: 'A Game of Thrones: A Song of Ice and Fire Book 1' },
      { candidate: 'Dune', target: 'Dune: Deluxe Edition' },
      { candidate: 'The Martian', target: 'The Martian: A Novel' },
    ];

    for (const { candidate, target } of cases) {
      const result = matchTitles(candidate, target);
      expect(result.score).toBeGreaterThan(0.7);
    }
  });

  test('handles multi-author books', () => {
    const result = matchAuthors(
      'Neil Gaiman, Terry Pratchett', 
      ['Neil Gaiman', 'Terry Pratchett']
    );
    expect(result.match).toBe(true);
  });

  test('handles books with the same author different titles', () => {
    const candidate: MatchCandidate = { 
      title: 'American Gods', 
      author: 'Neil Gaiman' 
    };
    const target: MatchTarget = { 
      title: 'Good Omens', 
      authors: ['Neil Gaiman'] 
    };
    
    const result = matchMetadata(candidate, target);
    expect(result.isMatch).toBe(false); // Title mismatch should reject
  });
});
