import { db } from "./db";
import { 
  books, 
  audiobooks, 
  readingProgress, 
  listeningProgress, 
  collections, 
  collectionItems, 
  bookmarks, 
  highlights, 
  annotations, 
  readerPreferences, 
  integrationSettings, 
  userRatings, 
  readingGoals, 
  readingSessions, 
  opdsSources, 
  calibreLibraries 
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const backupDataSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  metadata: z.object({
    bookCount: z.number(),
    audiobookCount: z.number(),
    collectionCount: z.number(),
    highlightCount: z.number(),
    bookmarkCount: z.number(),
    ratingCount: z.number(),
    goalCount: z.number().optional(),
  }),
  data: z.object({
    books: z.array(z.any()).optional().default([]),
    audiobooks: z.array(z.any()).optional().default([]),
    readingProgress: z.array(z.any()).optional().default([]),
    listeningProgress: z.array(z.any()).optional().default([]),
    collections: z.array(z.any()).optional().default([]),
    collectionItems: z.array(z.any()).optional().default([]),
    bookmarks: z.array(z.any()).optional().default([]),
    highlights: z.array(z.any()).optional().default([]),
    annotations: z.array(z.any()).optional().default([]),
    readerPreferences: z.array(z.any()).optional().default([]),
    userRatings: z.array(z.any()).optional().default([]),
    readingGoals: z.array(z.any()).optional().default([]),
    readingSessions: z.array(z.any()).optional().default([]),
    opdsSources: z.array(z.any()).optional().default([]),
    calibreLibraries: z.array(z.any()).optional().default([]),
    settings: z.array(z.any()).optional().default([]),
  }),
});

export interface BackupData {
  version: string;
  exportedAt: string;
  metadata: {
    bookCount: number;
    audiobookCount: number;
    collectionCount: number;
    highlightCount: number;
    bookmarkCount: number;
    ratingCount: number;
    goalCount: number;
  };
  data: {
    books: any[];
    audiobooks: any[];
    readingProgress: any[];
    listeningProgress: any[];
    collections: any[];
    collectionItems: any[];
    bookmarks: any[];
    highlights: any[];
    annotations: any[];
    readerPreferences: any[];
    userRatings: any[];
    readingGoals: any[];
    readingSessions: any[];
    opdsSources: any[];
    calibreLibraries: any[];
    settings: any[];
  };
}

export interface ImportResult {
  success: boolean;
  imported: {
    books: number;
    audiobooks: number;
    collections: number;
    collectionItems: number;
    bookmarks: number;
    highlights: number;
    annotations: number;
    readingProgress: number;
    listeningProgress: number;
    readerPreferences: number;
    userRatings: number;
    readingGoals: number;
    readingSessions: number;
    opdsSources: number;
    calibreLibraries: number;
    settings: number;
  };
  skipped: {
    books: number;
    audiobooks: number;
  };
  errors: string[];
}

export async function exportLibraryBackup(): Promise<BackupData> {
  const allBooks = await db.select().from(books);
  const allAudiobooks = await db.select().from(audiobooks);
  const allReadingProgress = await db.select().from(readingProgress);
  const allListeningProgress = await db.select().from(listeningProgress);
  const allCollections = await db.select().from(collections);
  const allCollectionItems = await db.select().from(collectionItems);
  const allBookmarks = await db.select().from(bookmarks);
  const allHighlights = await db.select().from(highlights);
  const allAnnotations = await db.select().from(annotations);
  const allReaderPreferences = await db.select().from(readerPreferences);
  const allUserRatings = await db.select().from(userRatings);
  const allReadingGoals = await db.select().from(readingGoals);
  const allReadingSessions = await db.select().from(readingSessions);
  const allOpdsSources = await db.select().from(opdsSources);
  const allCalibreLibraries = await db.select().from(calibreLibraries);
  
  const allSettings = await db.select().from(integrationSettings);
  const nonSecretSettings = allSettings.filter(s => !s.isSecret);

  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    metadata: {
      bookCount: allBooks.length,
      audiobookCount: allAudiobooks.length,
      collectionCount: allCollections.length,
      highlightCount: allHighlights.length,
      bookmarkCount: allBookmarks.length,
      ratingCount: allUserRatings.length,
      goalCount: allReadingGoals.length,
    },
    data: {
      books: allBooks,
      audiobooks: allAudiobooks,
      readingProgress: allReadingProgress,
      listeningProgress: allListeningProgress,
      collections: allCollections,
      collectionItems: allCollectionItems,
      bookmarks: allBookmarks,
      highlights: allHighlights,
      annotations: allAnnotations,
      readerPreferences: allReaderPreferences,
      userRatings: allUserRatings,
      readingGoals: allReadingGoals,
      readingSessions: allReadingSessions,
      opdsSources: allOpdsSources,
      calibreLibraries: allCalibreLibraries,
      settings: nonSecretSettings,
    },
  };
}

export async function importLibraryBackup(backupData: BackupData, options: { 
  skipExisting?: boolean;
} = {}): Promise<ImportResult> {
  const { skipExisting = true } = options;
  
  const result: ImportResult = {
    success: true,
    imported: {
      books: 0,
      audiobooks: 0,
      collections: 0,
      collectionItems: 0,
      bookmarks: 0,
      highlights: 0,
      annotations: 0,
      readingProgress: 0,
      listeningProgress: 0,
      readerPreferences: 0,
      userRatings: 0,
      readingGoals: 0,
      readingSessions: 0,
      opdsSources: 0,
      calibreLibraries: 0,
      settings: 0,
    },
    skipped: {
      books: 0,
      audiobooks: 0,
    },
    errors: [],
  };

  try {
    const existingBooks = await db.select({ id: books.id }).from(books);
    const existingBookIds = new Set(existingBooks.map(b => b.id));
    
    const existingAudiobooks = await db.select({ id: audiobooks.id }).from(audiobooks);
    const existingAudiobookIds = new Set(existingAudiobooks.map(a => a.id));

    const bookIdMap = new Map<string, string>();
    for (const book of backupData.data.books || []) {
      try {
        if (skipExisting && existingBookIds.has(book.id)) {
          result.skipped.books++;
          bookIdMap.set(book.id, book.id);
          continue;
        }
        
        const { id, addedAt, ...bookData } = book;
        
        const [inserted] = await db.insert(books).values({
          ...bookData,
          addedAt: addedAt ? new Date(addedAt) : new Date(),
        }).returning({ id: books.id });
        
        bookIdMap.set(id, inserted.id);
        result.imported.books++;
      } catch (error: any) {
        result.errors.push(`Failed to import book "${book.title}": ${error.message}`);
      }
    }

    const audiobookIdMap = new Map<string, string>();
    for (const audiobook of backupData.data.audiobooks || []) {
      try {
        if (skipExisting && existingAudiobookIds.has(audiobook.id)) {
          result.skipped.audiobooks++;
          audiobookIdMap.set(audiobook.id, audiobook.id);
          continue;
        }
        
        const { id, addedAt, ...audiobookData } = audiobook;
        
        const [inserted] = await db.insert(audiobooks).values({
          ...audiobookData,
          addedAt: addedAt ? new Date(addedAt) : new Date(),
        }).returning({ id: audiobooks.id });
        
        audiobookIdMap.set(id, inserted.id);
        result.imported.audiobooks++;
      } catch (error: any) {
        result.errors.push(`Failed to import audiobook "${audiobook.title}": ${error.message}`);
      }
    }

    const collectionIdMap = new Map<string, string>();
    for (const collection of backupData.data.collections || []) {
      try {
        const { id, createdAt, ...collectionData } = collection;
        
        const [inserted] = await db.insert(collections).values({
          ...collectionData,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        }).returning({ id: collections.id });
        
        collectionIdMap.set(id, inserted.id);
        result.imported.collections++;
      } catch (error: any) {
        result.errors.push(`Failed to import collection "${collection.name}": ${error.message}`);
      }
    }

    for (const item of backupData.data.collectionItems || []) {
      try {
        const collectionId = collectionIdMap.get(item.collectionId);
        const itemId = item.itemType === 'book' 
          ? bookIdMap.get(item.itemId) 
          : audiobookIdMap.get(item.itemId);
        
        if (!collectionId || !itemId) continue;
        
        const { id, addedAt, ...itemData } = item;
        
        await db.insert(collectionItems).values({
          ...itemData,
          collectionId,
          itemId,
          addedAt: addedAt ? new Date(addedAt) : new Date(),
        });
        
        result.imported.collectionItems++;
      } catch (error: any) {
        result.errors.push(`Failed to import collection item: ${error.message}`);
      }
    }

    for (const progress of backupData.data.readingProgress || []) {
      try {
        const bookId = bookIdMap.get(progress.bookId);
        if (!bookId) continue;
        
        const { id, lastReadAt, ...progressData } = progress;
        
        await db.insert(readingProgress).values({
          ...progressData,
          bookId,
          lastReadAt: lastReadAt ? new Date(lastReadAt) : new Date(),
        });
        
        result.imported.readingProgress++;
      } catch (error: any) {
        result.errors.push(`Failed to import reading progress: ${error.message}`);
      }
    }

    for (const progress of backupData.data.listeningProgress || []) {
      try {
        const audiobookId = audiobookIdMap.get(progress.audiobookId);
        if (!audiobookId) continue;
        
        const { id, lastListenedAt, ...progressData } = progress;
        
        await db.insert(listeningProgress).values({
          ...progressData,
          audiobookId,
          lastListenedAt: lastListenedAt ? new Date(lastListenedAt) : new Date(),
        });
        
        result.imported.listeningProgress++;
      } catch (error: any) {
        result.errors.push(`Failed to import listening progress: ${error.message}`);
      }
    }

    for (const bookmark of backupData.data.bookmarks || []) {
      try {
        const itemId = bookmark.itemType === 'book' 
          ? bookIdMap.get(bookmark.itemId) 
          : audiobookIdMap.get(bookmark.itemId);
        
        if (!itemId) continue;
        
        const { id, createdAt, ...bookmarkData } = bookmark;
        
        await db.insert(bookmarks).values({
          ...bookmarkData,
          itemId,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        });
        
        result.imported.bookmarks++;
      } catch (error: any) {
        result.errors.push(`Failed to import bookmark: ${error.message}`);
      }
    }

    const highlightIdMap = new Map<string, string>();
    for (const highlight of backupData.data.highlights || []) {
      try {
        const bookId = bookIdMap.get(highlight.bookId);
        if (!bookId) continue;
        
        const { id, createdAt, ...highlightData } = highlight;
        
        const [inserted] = await db.insert(highlights).values({
          ...highlightData,
          bookId,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        }).returning({ id: highlights.id });
        
        highlightIdMap.set(id, inserted.id);
        result.imported.highlights++;
      } catch (error: any) {
        result.errors.push(`Failed to import highlight: ${error.message}`);
      }
    }

    for (const annotation of backupData.data.annotations || []) {
      try {
        const highlightId = highlightIdMap.get(annotation.highlightId);
        if (!highlightId) continue;
        
        const { id, createdAt, updatedAt, ...annotationData } = annotation;
        
        await db.insert(annotations).values({
          ...annotationData,
          highlightId,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
        });
        
        result.imported.annotations++;
      } catch (error: any) {
        result.errors.push(`Failed to import annotation: ${error.message}`);
      }
    }

    for (const pref of backupData.data.readerPreferences || []) {
      try {
        const { id, updatedAt, ...prefData } = pref;
        
        await db.insert(readerPreferences).values({
          ...prefData,
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
        }).onConflictDoNothing();
        
        result.imported.readerPreferences++;
      } catch (error: any) {
        result.errors.push(`Failed to import reader preferences: ${error.message}`);
      }
    }

    for (const rating of backupData.data.userRatings || []) {
      try {
        const itemId = rating.itemType === 'book' 
          ? bookIdMap.get(rating.itemId) 
          : audiobookIdMap.get(rating.itemId);
        
        if (!itemId) continue;
        
        const { id, createdAt, updatedAt, syncedAt, ...ratingData } = rating;
        
        await db.insert(userRatings).values({
          ...ratingData,
          itemId,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
          syncedAt: syncedAt ? new Date(syncedAt) : null,
        });
        
        result.imported.userRatings++;
      } catch (error: any) {
        result.errors.push(`Failed to import rating: ${error.message}`);
      }
    }

    for (const goal of backupData.data.readingGoals || []) {
      try {
        const { id, startDate, endDate, createdAt, updatedAt, ...goalData } = goal;
        
        await db.insert(readingGoals).values({
          ...goalData,
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : null,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
        });
        
        result.imported.readingGoals++;
      } catch (error: any) {
        result.errors.push(`Failed to import reading goal: ${error.message}`);
      }
    }

    for (const session of backupData.data.readingSessions || []) {
      try {
        const itemId = session.itemType === 'book' 
          ? bookIdMap.get(session.itemId) 
          : audiobookIdMap.get(session.itemId);
        
        if (!itemId) continue;
        
        const { id, startTime, endTime, createdAt, ...sessionData } = session;
        
        await db.insert(readingSessions).values({
          ...sessionData,
          itemId,
          startTime: startTime ? new Date(startTime) : new Date(),
          endTime: endTime ? new Date(endTime) : null,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        });
        
        result.imported.readingSessions++;
      } catch (error: any) {
        result.errors.push(`Failed to import reading session: ${error.message}`);
      }
    }

    for (const source of backupData.data.opdsSources || []) {
      try {
        const { id, lastSyncedAt, createdAt, ...sourceData } = source;
        
        await db.insert(opdsSources).values({
          ...sourceData,
          lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt) : null,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        });
        
        result.imported.opdsSources++;
      } catch (error: any) {
        result.errors.push(`Failed to import OPDS source: ${error.message}`);
      }
    }

    for (const library of backupData.data.calibreLibraries || []) {
      try {
        const { id, lastSyncedAt, createdAt, ...libraryData } = library;
        
        await db.insert(calibreLibraries).values({
          ...libraryData,
          lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt) : null,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        });
        
        result.imported.calibreLibraries++;
      } catch (error: any) {
        result.errors.push(`Failed to import Calibre library: ${error.message}`);
      }
    }

    for (const setting of backupData.data.settings || []) {
      try {
        const { id, updatedAt, ...settingData } = setting;
        
        await db.insert(integrationSettings).values({
          ...settingData,
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
        }).onConflictDoNothing();
        
        result.imported.settings++;
      } catch (error: any) {
        result.errors.push(`Failed to import setting: ${error.message}`);
      }
    }

  } catch (error: any) {
    result.success = false;
    result.errors.push(`Import failed: ${error.message}`);
  }

  return result;
}

export function validateBackupData(data: any): { valid: boolean; errors: string[]; parsedData?: BackupData } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid backup file format');
    return { valid: false, errors };
  }

  const result = backupDataSchema.safeParse(data);
  
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    return { valid: false, errors };
  }

  return { valid: true, errors: [], parsedData: result.data as BackupData };
}
