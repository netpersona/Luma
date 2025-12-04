/**
 * Source Orchestrator
 * Coordinates multiple book sources with retry logic and fallbacks
 */

import { SourceProvider, BookMetadata, SearchOptions, DownloadResult, SourceConfig } from './sourceProvider';
import { AnnasArchiveProvider } from './annasArchiveProvider';

interface OrchestratorConfig {
  annasArchive?: SourceConfig;
  libgen?: SourceConfig;
  zlibrary?: SourceConfig;
}

export class SourceOrchestrator {
  private providers: SourceProvider[] = [];

  constructor(config: OrchestratorConfig = {}) {
    // Initialize providers in priority order
    if (config.annasArchive?.enabled !== false) {
      this.providers.push(new AnnasArchiveProvider(config.annasArchive || { enabled: true }));
    }

    // TODO: Add Libgen and Z-Library providers when implemented
    // if (config.libgen?.enabled !== false) {
    //   this.providers.push(new LibgenProvider(config.libgen || { enabled: true }));
    // }
    // if (config.zlibrary?.enabled !== false) {
    //   this.providers.push(new ZLibraryProvider(config.zlibrary || { enabled: true }));
    // }

    // Sort by priority
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Search across all enabled sources
   * Returns combined results from all sources
   */
  async search(options: SearchOptions): Promise<BookMetadata[]> {
    const allResults: BookMetadata[] = [];
    const errors: Error[] = [];

    // Try each provider in parallel
    const promises = this.providers.map(async (provider) => {
      try {
        console.log(`[Orchestrator] Searching ${provider.name}...`);
        const results = await provider.search(options);
        console.log(`[Orchestrator] ${provider.name} returned ${results.length} results`);
        return results;
      } catch (error) {
        console.error(`[Orchestrator] ${provider.name} search failed:`, error);
        errors.push(error as Error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(providerResults => allResults.push(...providerResults));

    // Deduplicate by ID (MD5 hash) to avoid collapsing books with missing authors
    const unique = new Map<string, BookMetadata>();
    allResults.forEach(book => {
      // Use book ID as primary deduplication key
      const key = book.id;
      if (!unique.has(key) || book.source === 'annas-archive') {
        // Prefer Anna's Archive if duplicate
        unique.set(key, book);
      }
    });

    const uniqueResults = Array.from(unique.values());

    // Apply limit if specified
    const limitedResults = options.limit 
      ? uniqueResults.slice(0, options.limit)
      : uniqueResults;

    console.log(`[Orchestrator] Total unique results: ${limitedResults.length}`);

    if (limitedResults.length === 0 && errors.length > 0) {
      throw new Error(`All sources failed. Errors: ${errors.map(e => e.message).join(', ')}`);
    }

    return limitedResults;
  }

  /**
   * Download a book by ID, trying sources in priority order
   * Pass metadata to help with direct mirror downloads (avoids scraping)
   */
  async downloadById(bookId: string, preferredSource?: string, metadata?: { title?: string; author?: string; format?: string; cover_url?: string }): Promise<DownloadResult> {
    // Try preferred source first if specified
    let orderedProviders = [...this.providers];
    if (preferredSource) {
      orderedProviders = orderedProviders.sort((a, b) => {
        if (a.name.toLowerCase().includes(preferredSource.toLowerCase())) return -1;
        if (b.name.toLowerCase().includes(preferredSource.toLowerCase())) return 1;
        return a.priority - b.priority;
      });
    }

    let lastError: Error | null = null;

    for (const provider of orderedProviders) {
      try {
        console.log(`[Orchestrator] Attempting download from ${provider.name}...`);
        const result = await provider.downloadById(bookId, metadata);
        console.log(`[Orchestrator] Successfully downloaded from ${provider.name}`);
        return result;
      } catch (error) {
        console.error(`[Orchestrator] ${provider.name} download failed:`, error);
        lastError = error as Error;
        continue; // Try next provider
      }
    }

    throw new Error(`All sources failed to download book ${bookId}. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Get download links from a specific source
   */
  async getDownloadLinks(bookId: string, sourceName: string): Promise<string[]> {
    const provider = this.providers.find(p => 
      p.name.toLowerCase().includes(sourceName.toLowerCase())
    );

    if (!provider) {
      throw new Error(`Source not found: ${sourceName}`);
    }

    return await provider.getDownloadLinks(bookId);
  }

  /**
   * Check health of all sources
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      this.providers.map(async (provider) => {
        try {
          results[provider.name] = await provider.healthCheck();
        } catch (error) {
          results[provider.name] = false;
        }
      })
    );

    return results;
  }

  /**
   * Get list of available sources
   */
  getAvailableSources(): string[] {
    return this.providers.map(p => p.name);
  }
}

/**
 * Get source orchestrator instance with fresh configuration
 * Pass getApiKey, getDonatorKey, and getApiType functions to retrieve settings
 * Creates a new instance each time to ensure settings changes apply immediately
 */
export async function getSourceOrchestrator(options?: {
  getApiKey?: () => Promise<string | null>;
  getDonatorKey?: () => Promise<string | null>;
  getApiType?: () => Promise<'rapidapi' | 'direct' | null>;
}): Promise<SourceOrchestrator> {
  // Get API key from settings if function provided
  let apiKey: string | undefined;
  if (options?.getApiKey) {
    const key = await options.getApiKey();
    apiKey = key || undefined;
    console.log('[SourceOrchestrator] API key:', apiKey ? 'configured' : 'none');
  }

  // Get donator key from settings if function provided
  let donatorKey: string | undefined;
  if (options?.getDonatorKey) {
    const key = await options.getDonatorKey();
    donatorKey = key || undefined;
    console.log('[SourceOrchestrator] Donator key:', donatorKey ? 'configured' : 'none');
  }

  // Get API type from settings if function provided
  let apiType: 'rapidapi' | 'direct' = 'rapidapi'; // Default to RapidAPI
  if (options?.getApiType) {
    const type = await options.getApiType();
    if (type) {
      apiType = type;
    }
    console.log('[SourceOrchestrator] API type:', apiType);
  }

  // Create fresh instance to ensure settings changes apply
  return new SourceOrchestrator({
    annasArchive: {
      enabled: true,
      apiType,
      apiKey,
      donatorKey,
    },
    libgen: {
      enabled: false, // Not implemented yet
    },
    zlibrary: {
      enabled: false, // Not implemented yet
    },
  });
}
