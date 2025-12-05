import {
  books,
  audiobooks,
  audiobookTracks,
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
  recommendationCache,
  deliveryJobs,
  calibreLibraries,
  opdsSources,
  readingGoals,
  bookClubs,
  bookClubMembers,
  bookClubDiscussions,
  bookClubMeetings,
  meetingRsvps,
  type Book,
  type Audiobook,
  type AudiobookTrack,
  type ReadingProgress,
  type ListeningProgress,
  type Collection,
  type CollectionItem,
  type Bookmark,
  type Highlight,
  type Annotation,
  type ReaderPreferences,
  type IntegrationSetting,
  type UserRating,
  type RecommendationCache,
  type DeliveryJob,
  type CalibreLibrary,
  type OpdsSource,
  type ReadingGoal,
  type BookClub,
  type BookClubMember,
  type BookClubDiscussion,
  type BookClubMeeting,
  type MeetingRsvp,
  type InsertBook,
  type InsertAudiobook,
  type InsertAudiobookTrack,
  type InsertReadingProgress,
  type InsertListeningProgress,
  type InsertCollection,
  type InsertCollectionItem,
  type InsertBookmark,
  type InsertHighlight,
  type InsertAnnotation,
  type InsertReaderPreferences,
  type InsertIntegrationSetting,
  type InsertUserRating,
  type InsertRecommendationCache,
  type InsertDeliveryJob,
  type InsertCalibreLibrary,
  type InsertOpdsSource,
  type InsertReadingGoal,
  type InsertBookClub,
  type InsertBookClubMember,
  type InsertBookClubDiscussion,
  type InsertBookClubMeeting,
  type InsertMeetingRsvp,
  type BookWithProgress,
  type AudiobookWithProgress,
  type CollectionWithItems,
  type HighlightWithAnnotations,
  type BookClubWithDetails,
  type BookClubMeetingWithRsvps,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, isNull } from "drizzle-orm";

// Helper function to safely parse JSON fields from database
function safeParseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Helper to normalize book JSON fields
function normalizeBookFields<T extends { tags?: string | null; dominantColors?: string | null }>(
  book: T
): T & { tags: string[]; dominantColors: string[] } {
  return {
    ...book,
    tags: safeParseJsonArray(book.tags as string | null),
    dominantColors: safeParseJsonArray(book.dominantColors as string | null),
  };
}

// Helper to normalize audiobook JSON fields
function normalizeAudiobookFields<T extends { tags?: string | null; dominantColors?: string | null }>(
  audiobook: T
): T & { tags: string[]; dominantColors: string[] } {
  return {
    ...audiobook,
    tags: safeParseJsonArray(audiobook.tags as string | null),
    dominantColors: safeParseJsonArray(audiobook.dominantColors as string | null),
  };
}

export interface IStorage {
  // Books
  getAllBooks(): Promise<BookWithProgress[]>;
  getBookById(id: string): Promise<BookWithProgress | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: string, book: Partial<InsertBook>): Promise<Book | undefined>;
  deleteBook(id: string): Promise<void>;

  // Audiobooks
  getAllAudiobooks(): Promise<AudiobookWithProgress[]>;
  getAudiobookById(id: string): Promise<AudiobookWithProgress | undefined>;
  createAudiobook(audiobook: InsertAudiobook): Promise<Audiobook>;
  updateAudiobook(id: string, audiobook: Partial<InsertAudiobook>): Promise<Audiobook | undefined>;
  deleteAudiobook(id: string): Promise<void>;

  // Audiobook Tracks (for multi-file audiobooks)
  getAudiobookTracks(audiobookId: string): Promise<AudiobookTrack[]>;
  createAudiobookTrack(track: InsertAudiobookTrack): Promise<AudiobookTrack>;
  createAudiobookTracks(tracks: InsertAudiobookTrack[]): Promise<AudiobookTrack[]>;
  deleteAudiobookTracks(audiobookId: string): Promise<void>;
  getAudiobookTrackByIndex(audiobookId: string, trackIndex: number): Promise<AudiobookTrack | undefined>;

  // Reading Progress
  getReadingProgress(bookId: string): Promise<ReadingProgress | undefined>;
  updateReadingProgress(progress: InsertReadingProgress): Promise<ReadingProgress>;

  // Listening Progress
  getListeningProgress(audiobookId: string): Promise<ListeningProgress | undefined>;
  updateListeningProgress(progress: InsertListeningProgress): Promise<ListeningProgress>;

  // Recent Items
  getRecentItems(limit?: number): Promise<{ books: BookWithProgress[]; audiobooks: AudiobookWithProgress[] }>;

  // Reading Goals
  getAllGoals(): Promise<ReadingGoal[]>;
  getGoalById(id: string): Promise<ReadingGoal | undefined>;
  createGoal(goal: InsertReadingGoal): Promise<ReadingGoal>;
  updateGoal(id: string, goal: Partial<InsertReadingGoal>): Promise<ReadingGoal | undefined>;
  deleteGoal(id: string): Promise<void>;

  // Collections
  getAllCollections(): Promise<CollectionWithItems[]>;
  getCollectionById(id: string): Promise<CollectionWithItems | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(id: string, collection: Partial<InsertCollection>): Promise<Collection | undefined>;
  deleteCollection(id: string): Promise<void>;

  // Collection Items
  addItemToCollection(item: InsertCollectionItem): Promise<CollectionItem>;
  removeItemFromCollection(collectionId: string, itemId: string): Promise<void>;

  // Bookmarks
  getBookmarks(itemId: string, itemType: string): Promise<Bookmark[]>;
  createBookmark(bookmark: InsertBookmark): Promise<Bookmark>;
  deleteBookmark(id: string): Promise<void>;

  // Highlights
  getHighlights(bookId: string): Promise<HighlightWithAnnotations[]>;
  createHighlight(highlight: InsertHighlight): Promise<Highlight>;
  updateHighlight(id: string, highlight: Partial<InsertHighlight>): Promise<Highlight | undefined>;
  deleteHighlight(id: string): Promise<void>;

  // Annotations
  getAnnotations(highlightId: string): Promise<Annotation[]>;
  getAnnotationsForBook(bookId: string): Promise<Annotation[]>;
  createAnnotation(annotation: InsertAnnotation): Promise<Annotation>;
  updateAnnotation(id: string, annotation: Partial<InsertAnnotation>): Promise<Annotation | undefined>;
  deleteAnnotation(id: string): Promise<void>;

  // Reader Preferences
  getReaderPreferences(userId?: string): Promise<ReaderPreferences | undefined>;
  upsertReaderPreferences(preferences: InsertReaderPreferences): Promise<ReaderPreferences>;

  // Integration Settings
  getAllSettings(): Promise<IntegrationSetting[]>;
  getSetting(key: string): Promise<IntegrationSetting | undefined>;
  getIntegrationSetting(key: string): Promise<IntegrationSetting | undefined>; // Alias
  upsertSetting(setting: InsertIntegrationSetting): Promise<IntegrationSetting>;
  deleteSetting(key: string): Promise<void>;

  // User Ratings
  getUserRating(userId: string, itemId: string): Promise<UserRating | undefined>;
  getAllUserRatings(userId: string): Promise<UserRating[]>;
  upsertUserRating(rating: InsertUserRating): Promise<UserRating>;
  deleteUserRating(id: string): Promise<void>;

  // Recommendation Cache
  getRecommendationCache(userId: string, cacheKey: string): Promise<RecommendationCache | undefined>;
  saveRecommendationCache(cache: InsertRecommendationCache): Promise<RecommendationCache>;
  clearRecommendationCache(userId: string): Promise<void>;

  // Delivery Jobs
  createDeliveryJob(job: InsertDeliveryJob): Promise<DeliveryJob>;
  getDeliveryJob(id: string): Promise<DeliveryJob | undefined>;
  updateDeliveryJob(id: string, updates: Partial<InsertDeliveryJob>): Promise<DeliveryJob | undefined>;

  // Calibre Libraries
  getCalibreLibraries(): Promise<CalibreLibrary[]>;
  getCalibreLibrary(id: string): Promise<CalibreLibrary | undefined>;
  createCalibreLibrary(library: InsertCalibreLibrary): Promise<CalibreLibrary>;
  updateCalibreLibrary(id: string, updates: Partial<InsertCalibreLibrary>): Promise<CalibreLibrary | undefined>;
  deleteCalibreLibrary(id: string): Promise<void>;

  // OPDS Sources
  getOpdsSources(): Promise<OpdsSource[]>;
  getOpdsSource(id: string): Promise<OpdsSource | undefined>;
  createOpdsSource(source: InsertOpdsSource): Promise<OpdsSource>;
  updateOpdsSource(id: string, updates: Partial<InsertOpdsSource>): Promise<OpdsSource | undefined>;
  deleteOpdsSource(id: string): Promise<void>;

  // Book Clubs
  getAllBookClubs(): Promise<BookClubWithDetails[]>;
  getBookClubById(id: string): Promise<BookClubWithDetails | undefined>;
  createBookClub(club: InsertBookClub): Promise<BookClub>;
  updateBookClub(id: string, updates: Partial<InsertBookClub>): Promise<BookClub | undefined>;
  deleteBookClub(id: string): Promise<void>;

  // Book Club Members
  getBookClubMembers(clubId: string): Promise<BookClubMember[]>;
  addBookClubMember(member: InsertBookClubMember): Promise<BookClubMember>;
  updateBookClubMember(id: string, updates: Partial<InsertBookClubMember>): Promise<BookClubMember | undefined>;
  removeBookClubMember(clubId: string, userId: string): Promise<void>;
  isBookClubMember(clubId: string, userId: string): Promise<boolean>;

  // Book Club Discussions
  getBookClubDiscussions(clubId: string, options?: { topicsOnly?: boolean; bookId?: string }): Promise<BookClubDiscussion[]>;
  getBookClubDiscussionWithReplies(topicId: string): Promise<{ topic: BookClubDiscussion; replies: BookClubDiscussion[] } | null>;
  createBookClubDiscussion(discussion: InsertBookClubDiscussion): Promise<BookClubDiscussion>;
  updateBookClubDiscussion(id: string, updates: Partial<InsertBookClubDiscussion>): Promise<BookClubDiscussion | undefined>;
  deleteBookClubDiscussion(id: string): Promise<void>;
  incrementDiscussionReplyCount(topicId: string): Promise<void>;

  // Book Club Meetings
  getBookClubMeetings(clubId: string, userId: string): Promise<BookClubMeetingWithRsvps[]>;
  getBookClubMeeting(meetingId: string, userId: string): Promise<BookClubMeetingWithRsvps | undefined>;
  createBookClubMeeting(meeting: InsertBookClubMeeting): Promise<BookClubMeeting>;
  updateBookClubMeeting(id: string, updates: Partial<InsertBookClubMeeting>): Promise<BookClubMeeting | undefined>;
  deleteBookClubMeeting(id: string): Promise<void>;
  
  // Meeting RSVPs
  upsertMeetingRsvp(meetingId: string, userId: string, status: string): Promise<MeetingRsvp>;
  getUpcomingMeetingsForUser(userId: string): Promise<(BookClubMeetingWithRsvps & { clubName: string; clubId: string })[]>;
}

export class DatabaseStorage implements IStorage {
  // Books
  async getAllBooks(): Promise<BookWithProgress[]> {
    const allBooks = await db.select().from(books).orderBy(desc(books.addedAt));
    
    const booksWithProgress = await Promise.all(
      allBooks.map(async (book) => {
        const progress = await this.getReadingProgress(book.id);
        return normalizeBookFields({ ...book, progress });
      })
    );

    return booksWithProgress;
  }

  async getBookById(id: string): Promise<BookWithProgress | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    if (!book) return undefined;

    const progress = await this.getReadingProgress(id);
    return normalizeBookFields({ ...book, progress });
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const [book] = await db.insert(books).values(insertBook).returning();
    return book;
  }

  async updateBook(id: string, updateData: Partial<InsertBook>): Promise<Book | undefined> {
    const [book] = await db
      .update(books)
      .set(updateData)
      .where(eq(books.id, id))
      .returning();
    return book;
  }

  async deleteBook(id: string): Promise<void> {
    await db.delete(books).where(eq(books.id, id));
  }

  // Audiobooks
  async getAllAudiobooks(): Promise<AudiobookWithProgress[]> {
    const allAudiobooks = await db.select().from(audiobooks).orderBy(desc(audiobooks.addedAt));
    
    const audiobooksWithProgress = await Promise.all(
      allAudiobooks.map(async (audiobook) => {
        const progress = await this.getListeningProgress(audiobook.id);
        return normalizeAudiobookFields({ ...audiobook, progress });
      })
    );

    return audiobooksWithProgress;
  }

  async getAudiobookById(id: string): Promise<AudiobookWithProgress | undefined> {
    const [audiobook] = await db.select().from(audiobooks).where(eq(audiobooks.id, id));
    if (!audiobook) return undefined;

    const progress = await this.getListeningProgress(id);
    return normalizeAudiobookFields({ ...audiobook, progress });
  }

  async createAudiobook(insertAudiobook: InsertAudiobook): Promise<Audiobook> {
    const [audiobook] = await db.insert(audiobooks).values(insertAudiobook).returning();
    return audiobook;
  }

  async updateAudiobook(id: string, updateData: Partial<InsertAudiobook>): Promise<Audiobook | undefined> {
    const [audiobook] = await db
      .update(audiobooks)
      .set(updateData)
      .where(eq(audiobooks.id, id))
      .returning();
    return audiobook;
  }

  async deleteAudiobook(id: string): Promise<void> {
    await db.delete(audiobooks).where(eq(audiobooks.id, id));
  }

  // Audiobook Tracks (for multi-file audiobooks)
  async getAudiobookTracks(audiobookId: string): Promise<AudiobookTrack[]> {
    return db
      .select()
      .from(audiobookTracks)
      .where(eq(audiobookTracks.audiobookId, audiobookId))
      .orderBy(audiobookTracks.trackIndex);
  }

  async createAudiobookTrack(track: InsertAudiobookTrack): Promise<AudiobookTrack> {
    const [created] = await db.insert(audiobookTracks).values(track).returning();
    return created;
  }

  async createAudiobookTracks(tracks: InsertAudiobookTrack[]): Promise<AudiobookTrack[]> {
    if (tracks.length === 0) return [];
    return db.insert(audiobookTracks).values(tracks).returning();
  }

  async deleteAudiobookTracks(audiobookId: string): Promise<void> {
    await db.delete(audiobookTracks).where(eq(audiobookTracks.audiobookId, audiobookId));
  }

  async getAudiobookTrackByIndex(audiobookId: string, trackIndex: number): Promise<AudiobookTrack | undefined> {
    const [track] = await db
      .select()
      .from(audiobookTracks)
      .where(
        and(
          eq(audiobookTracks.audiobookId, audiobookId),
          eq(audiobookTracks.trackIndex, trackIndex)
        )
      );
    return track;
  }

  // Reading Progress
  async getReadingProgress(bookId: string): Promise<ReadingProgress | undefined> {
    const [progress] = await db
      .select()
      .from(readingProgress)
      .where(eq(readingProgress.bookId, bookId));
    return progress;
  }

  async updateReadingProgress(progressData: InsertReadingProgress): Promise<ReadingProgress> {
    const existing = await this.getReadingProgress(progressData.bookId);

    if (existing) {
      const [updated] = await db
        .update(readingProgress)
        .set({ ...progressData, lastReadAt: new Date() })
        .where(eq(readingProgress.bookId, progressData.bookId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(readingProgress)
        .values(progressData)
        .returning();
      return created;
    }
  }

  // Listening Progress
  async getListeningProgress(audiobookId: string): Promise<ListeningProgress | undefined> {
    const [progress] = await db
      .select()
      .from(listeningProgress)
      .where(eq(listeningProgress.audiobookId, audiobookId));
    return progress;
  }

  async updateListeningProgress(progressData: InsertListeningProgress): Promise<ListeningProgress> {
    const existing = await this.getListeningProgress(progressData.audiobookId);

    if (existing) {
      const [updated] = await db
        .update(listeningProgress)
        .set({ ...progressData, lastListenedAt: new Date() })
        .where(eq(listeningProgress.audiobookId, progressData.audiobookId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(listeningProgress)
        .values(progressData)
        .returning();
      return created;
    }
  }

  // Recent Items
  async getRecentItems(limit: number = 5): Promise<{ books: BookWithProgress[]; audiobooks: AudiobookWithProgress[] }> {
    // Get recent books with progress, sorted by lastReadAt
    // Include all books that have been opened (have a progress record), not just those with progress > 0
    const recentBooksProgress = await db
      .select()
      .from(readingProgress)
      .orderBy(desc(readingProgress.lastReadAt))
      .limit(limit);
    
    const recentBooks: BookWithProgress[] = [];
    for (const progress of recentBooksProgress) {
      const [book] = await db.select().from(books).where(eq(books.id, progress.bookId));
      if (book) {
        recentBooks.push(normalizeBookFields({ ...book, progress }));
      }
    }
    
    // Get recent audiobooks with progress, sorted by lastListenedAt
    // Include all audiobooks that have been started (have a progress record)
    const recentAudiobooksProgress = await db
      .select()
      .from(listeningProgress)
      .orderBy(desc(listeningProgress.lastListenedAt))
      .limit(limit);
    
    const recentAudiobooks: AudiobookWithProgress[] = [];
    for (const progress of recentAudiobooksProgress) {
      const [audiobook] = await db.select().from(audiobooks).where(eq(audiobooks.id, progress.audiobookId));
      if (audiobook) {
        recentAudiobooks.push(normalizeAudiobookFields({ ...audiobook, progress }));
      }
    }
    
    return { books: recentBooks, audiobooks: recentAudiobooks };
  }

  // Reading Goals
  async getAllGoals(): Promise<ReadingGoal[]> {
    return db.select().from(readingGoals).orderBy(desc(readingGoals.createdAt));
  }

  async getGoalById(id: string): Promise<ReadingGoal | undefined> {
    const [goal] = await db.select().from(readingGoals).where(eq(readingGoals.id, id));
    return goal;
  }

  async createGoal(goal: InsertReadingGoal): Promise<ReadingGoal> {
    const [newGoal] = await db.insert(readingGoals).values(goal).returning();
    return newGoal;
  }

  async updateGoal(id: string, goal: Partial<InsertReadingGoal>): Promise<ReadingGoal | undefined> {
    const [updatedGoal] = await db
      .update(readingGoals)
      .set(goal)
      .where(eq(readingGoals.id, id))
      .returning();
    return updatedGoal;
  }

  async deleteGoal(id: string): Promise<void> {
    await db.delete(readingGoals).where(eq(readingGoals.id, id));
  }

  // Collections
  async getAllCollections(): Promise<CollectionWithItems[]> {
    const allCollections = await db.select().from(collections).orderBy(desc(collections.createdAt));
    
    const collectionsWithItems = await Promise.all(
      allCollections.map(async (collection) => {
        const items = await db
          .select()
          .from(collectionItems)
          .where(eq(collectionItems.collectionId, collection.id));
        return { ...collection, items, itemCount: items.length };
      })
    );

    return collectionsWithItems;
  }

  async getCollectionById(id: string): Promise<CollectionWithItems | undefined> {
    const [collection] = await db.select().from(collections).where(eq(collections.id, id));
    if (!collection) return undefined;

    const items = await db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, id));

    return { ...collection, items, itemCount: items.length };
  }

  async createCollection(insertCollection: InsertCollection): Promise<Collection> {
    const [collection] = await db.insert(collections).values(insertCollection).returning();
    return collection;
  }

  async updateCollection(id: string, updateData: Partial<InsertCollection>): Promise<Collection | undefined> {
    const [collection] = await db
      .update(collections)
      .set(updateData)
      .where(eq(collections.id, id))
      .returning();
    return collection;
  }

  async deleteCollection(id: string): Promise<void> {
    await db.delete(collections).where(eq(collections.id, id));
  }

  // Collection Items
  async addItemToCollection(item: InsertCollectionItem): Promise<CollectionItem> {
    const [collectionItem] = await db.insert(collectionItems).values(item).returning();
    return collectionItem;
  }

  async removeItemFromCollection(collectionId: string, itemId: string): Promise<void> {
    await db
      .delete(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.itemId, itemId)
        )
      );
  }

  // Bookmarks
  async getBookmarks(itemId: string, itemType: string): Promise<Bookmark[]> {
    return await db
      .select()
      .from(bookmarks)
      .where(
        and(eq(bookmarks.itemId, itemId), eq(bookmarks.itemType, itemType))
      )
      .orderBy(desc(bookmarks.createdAt));
  }

  async createBookmark(insertBookmark: InsertBookmark): Promise<Bookmark> {
    const [bookmark] = await db.insert(bookmarks).values(insertBookmark).returning();
    return bookmark;
  }

  async deleteBookmark(id: string): Promise<void> {
    await db.delete(bookmarks).where(eq(bookmarks.id, id));
  }

  // Highlights
  async getHighlights(bookId: string): Promise<HighlightWithAnnotations[]> {
    const allHighlights = await db
      .select()
      .from(highlights)
      .where(eq(highlights.bookId, bookId))
      .orderBy(desc(highlights.createdAt));
    
    const highlightsWithAnnotations = await Promise.all(
      allHighlights.map(async (highlight) => {
        const highlightAnnotations = await this.getAnnotations(highlight.id);
        return { ...highlight, annotations: highlightAnnotations };
      })
    );

    return highlightsWithAnnotations;
  }

  async createHighlight(insertHighlight: InsertHighlight): Promise<Highlight> {
    const [highlight] = await db.insert(highlights).values(insertHighlight).returning();
    return highlight;
  }

  async updateHighlight(id: string, updateData: Partial<InsertHighlight>): Promise<Highlight | undefined> {
    const [highlight] = await db
      .update(highlights)
      .set(updateData)
      .where(eq(highlights.id, id))
      .returning();
    return highlight;
  }

  async deleteHighlight(id: string): Promise<void> {
    await db.delete(highlights).where(eq(highlights.id, id));
  }

  // Annotations
  async getAnnotations(highlightId: string): Promise<Annotation[]> {
    return await db
      .select()
      .from(annotations)
      .where(eq(annotations.highlightId, highlightId))
      .orderBy(desc(annotations.createdAt));
  }

  async getAnnotationsForBook(bookId: string): Promise<Annotation[]> {
    // Get all highlights for this book first
    const bookHighlights = await db
      .select()
      .from(highlights)
      .where(eq(highlights.bookId, bookId));
    
    if (bookHighlights.length === 0) {
      return [];
    }

    // Get all annotations for these highlights
    const highlightIds = bookHighlights.map(h => h.id);
    return await db
      .select()
      .from(annotations)
      .where(
        sql`${annotations.highlightId} IN (${sql.join(highlightIds.map(id => sql`${id}`), sql`, `)})`
      )
      .orderBy(desc(annotations.createdAt));
  }

  async createAnnotation(insertAnnotation: InsertAnnotation): Promise<Annotation> {
    const [annotation] = await db.insert(annotations).values(insertAnnotation).returning();
    return annotation;
  }

  async updateAnnotation(id: string, updateData: Partial<InsertAnnotation>): Promise<Annotation | undefined> {
    const [annotation] = await db
      .update(annotations)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(annotations.id, id))
      .returning();
    return annotation;
  }

  async deleteAnnotation(id: string): Promise<void> {
    await db.delete(annotations).where(eq(annotations.id, id));
  }

  // Reader Preferences
  async getReaderPreferences(userId: string = 'default'): Promise<ReaderPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(readerPreferences)
      .where(eq(readerPreferences.userId, userId));
    return preferences;
  }

  async upsertReaderPreferences(insertPreferences: InsertReaderPreferences): Promise<ReaderPreferences> {
    const userId = insertPreferences.userId || 'default';
    const existing = await this.getReaderPreferences(userId);
    
    if (existing) {
      const [updated] = await db
        .update(readerPreferences)
        .set({ ...insertPreferences, updatedAt: new Date() })
        .where(eq(readerPreferences.userId, userId))
        .returning();
      return updated;
    }
    
    const [preferences] = await db.insert(readerPreferences).values(insertPreferences).returning();
    return preferences;
  }

  // Integration Settings
  async getAllSettings(): Promise<IntegrationSetting[]> {
    return await db.select().from(integrationSettings).orderBy(desc(integrationSettings.updatedAt));
  }

  async getSetting(key: string): Promise<IntegrationSetting | undefined> {
    const [setting] = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.key, key));
    return setting;
  }

  async upsertSetting(insertSetting: InsertIntegrationSetting): Promise<IntegrationSetting> {
    // Try to update first
    const existing = await this.getSetting(insertSetting.key);
    
    if (existing) {
      const [updated] = await db
        .update(integrationSettings)
        .set({ ...insertSetting, updatedAt: new Date() })
        .where(eq(integrationSettings.key, insertSetting.key))
        .returning();
      return updated;
    }
    
    // Insert if doesn't exist
    const [setting] = await db.insert(integrationSettings).values(insertSetting).returning();
    return setting;
  }

  async deleteSetting(key: string): Promise<void> {
    await db.delete(integrationSettings).where(eq(integrationSettings.key, key));
  }

  async getIntegrationSetting(key: string): Promise<IntegrationSetting | undefined> {
    return this.getSetting(key);
  }

  // User Ratings
  async getUserRating(userId: string, itemId: string): Promise<UserRating | undefined> {
    const [rating] = await db
      .select()
      .from(userRatings)
      .where(and(eq(userRatings.userId, userId), eq(userRatings.itemId, itemId)));
    return rating;
  }

  async getAllUserRatings(userId: string): Promise<UserRating[]> {
    return await db
      .select()
      .from(userRatings)
      .where(eq(userRatings.userId, userId))
      .orderBy(desc(userRatings.updatedAt));
  }

  async upsertUserRating(insertRating: InsertUserRating): Promise<UserRating> {
    const userId = insertRating.userId || 'default';
    const existing = await this.getUserRating(userId, insertRating.itemId);
    
    if (existing) {
      const [updated] = await db
        .update(userRatings)
        .set({ ...insertRating, updatedAt: new Date() })
        .where(eq(userRatings.id, existing.id))
        .returning();
      return updated;
    }
    
    const [rating] = await db.insert(userRatings).values(insertRating).returning();
    return rating;
  }

  async deleteUserRating(id: string): Promise<void> {
    await db.delete(userRatings).where(eq(userRatings.id, id));
  }

  // Recommendation Cache
  async getRecommendationCache(userId: string, cacheKey: string): Promise<RecommendationCache | undefined> {
    const [cache] = await db
      .select()
      .from(recommendationCache)
      .where(and(eq(recommendationCache.userId, userId), eq(recommendationCache.cacheKey, cacheKey)))
      .orderBy(desc(recommendationCache.createdAt));
    return cache;
  }

  async saveRecommendationCache(insertCache: InsertRecommendationCache): Promise<RecommendationCache> {
    const [cache] = await db.insert(recommendationCache).values(insertCache).returning();
    return cache;
  }

  async clearRecommendationCache(userId: string): Promise<void> {
    await db.delete(recommendationCache).where(eq(recommendationCache.userId, userId));
  }

  // Delivery Jobs
  async createDeliveryJob(insertJob: InsertDeliveryJob): Promise<DeliveryJob> {
    const [job] = await db.insert(deliveryJobs).values(insertJob).returning();
    return job;
  }

  async getDeliveryJob(id: string): Promise<DeliveryJob | undefined> {
    const [job] = await db.select().from(deliveryJobs).where(eq(deliveryJobs.id, id));
    return job;
  }

  async updateDeliveryJob(id: string, updates: Partial<InsertDeliveryJob>): Promise<DeliveryJob | undefined> {
    const [job] = await db
      .update(deliveryJobs)
      .set(updates)
      .where(eq(deliveryJobs.id, id))
      .returning();
    return job;
  }

  // Calibre Libraries
  async getCalibreLibraries(): Promise<CalibreLibrary[]> {
    return await db
      .select()
      .from(calibreLibraries)
      .where(eq(calibreLibraries.isActive, true))
      .orderBy(desc(calibreLibraries.createdAt));
  }

  async getCalibreLibrary(id: string): Promise<CalibreLibrary | undefined> {
    const [library] = await db
      .select()
      .from(calibreLibraries)
      .where(eq(calibreLibraries.id, id));
    return library;
  }

  async createCalibreLibrary(insertLibrary: InsertCalibreLibrary): Promise<CalibreLibrary> {
    const [library] = await db
      .insert(calibreLibraries)
      .values(insertLibrary)
      .returning();
    return library;
  }

  async updateCalibreLibrary(id: string, updates: Partial<InsertCalibreLibrary>): Promise<CalibreLibrary | undefined> {
    const [library] = await db
      .update(calibreLibraries)
      .set(updates)
      .where(eq(calibreLibraries.id, id))
      .returning();
    return library;
  }

  async deleteCalibreLibrary(id: string): Promise<void> {
    await db
      .update(calibreLibraries)
      .set({ isActive: false })
      .where(eq(calibreLibraries.id, id));
  }

  // OPDS Sources
  async getOpdsSources(): Promise<OpdsSource[]> {
    return await db
      .select()
      .from(opdsSources)
      .where(eq(opdsSources.isActive, true))
      .orderBy(desc(opdsSources.createdAt));
  }

  async getOpdsSource(id: string): Promise<OpdsSource | undefined> {
    const [source] = await db
      .select()
      .from(opdsSources)
      .where(eq(opdsSources.id, id));
    return source;
  }

  async createOpdsSource(insertSource: InsertOpdsSource): Promise<OpdsSource> {
    const [source] = await db
      .insert(opdsSources)
      .values(insertSource)
      .returning();
    return source;
  }

  async updateOpdsSource(id: string, updates: Partial<InsertOpdsSource>): Promise<OpdsSource | undefined> {
    const [source] = await db
      .update(opdsSources)
      .set(updates)
      .where(eq(opdsSources.id, id))
      .returning();
    return source;
  }

  async deleteOpdsSource(id: string): Promise<void> {
    await db
      .update(opdsSources)
      .set({ isActive: false })
      .where(eq(opdsSources.id, id));
  }

  // Book Clubs
  async getAllBookClubs(): Promise<BookClubWithDetails[]> {
    const clubs = await db
      .select()
      .from(bookClubs)
      .orderBy(desc(bookClubs.createdAt));

    const clubsWithDetails = await Promise.all(
      clubs.map(async (club) => {
        const members = await this.getBookClubMembers(club.id);
        const discussions = await this.getBookClubDiscussions(club.id);
        let currentBook = null;
        
        if (club.currentBookId) {
          if (club.currentBookType === 'audiobook') {
            currentBook = await this.getAudiobookById(club.currentBookId);
          } else {
            currentBook = await this.getBookById(club.currentBookId);
          }
        }

        return {
          ...club,
          members,
          discussions,
          memberCount: members.length,
          currentBook,
        };
      })
    );

    return clubsWithDetails;
  }

  async getBookClubById(id: string): Promise<BookClubWithDetails | undefined> {
    const [club] = await db
      .select()
      .from(bookClubs)
      .where(eq(bookClubs.id, id));

    if (!club) return undefined;

    const members = await this.getBookClubMembers(id);
    const discussions = await this.getBookClubDiscussions(id);
    let currentBook = null;

    if (club.currentBookId) {
      if (club.currentBookType === 'audiobook') {
        currentBook = await this.getAudiobookById(club.currentBookId);
      } else {
        currentBook = await this.getBookById(club.currentBookId);
      }
    }

    return {
      ...club,
      members,
      discussions,
      memberCount: members.length,
      currentBook,
    };
  }

  async createBookClub(insertClub: InsertBookClub): Promise<BookClub> {
    const [club] = await db
      .insert(bookClubs)
      .values(insertClub)
      .returning();
    return club;
  }

  async updateBookClub(id: string, updates: Partial<InsertBookClub>): Promise<BookClub | undefined> {
    const [club] = await db
      .update(bookClubs)
      .set(updates)
      .where(eq(bookClubs.id, id))
      .returning();
    return club;
  }

  async deleteBookClub(id: string): Promise<void> {
    await db.delete(bookClubs).where(eq(bookClubs.id, id));
  }

  // Book Club Members
  async getBookClubMembers(clubId: string): Promise<BookClubMember[]> {
    return await db
      .select()
      .from(bookClubMembers)
      .where(eq(bookClubMembers.clubId, clubId))
      .orderBy(desc(bookClubMembers.joinedAt));
  }

  async addBookClubMember(insertMember: InsertBookClubMember): Promise<BookClubMember> {
    const [member] = await db
      .insert(bookClubMembers)
      .values(insertMember)
      .returning();
    return member;
  }

  async updateBookClubMember(id: string, updates: Partial<InsertBookClubMember>): Promise<BookClubMember | undefined> {
    const [member] = await db
      .update(bookClubMembers)
      .set(updates)
      .where(eq(bookClubMembers.id, id))
      .returning();
    return member;
  }

  async removeBookClubMember(clubId: string, userId: string): Promise<void> {
    await db
      .delete(bookClubMembers)
      .where(and(
        eq(bookClubMembers.clubId, clubId),
        eq(bookClubMembers.userId, userId)
      ));
  }

  async isBookClubMember(clubId: string, userId: string): Promise<boolean> {
    const [member] = await db
      .select()
      .from(bookClubMembers)
      .where(and(
        eq(bookClubMembers.clubId, clubId),
        eq(bookClubMembers.userId, userId)
      ));
    return !!member;
  }

  // Book Club Discussions
  async getBookClubDiscussions(clubId: string, options?: { topicsOnly?: boolean; bookId?: string }): Promise<BookClubDiscussion[]> {
    let query = db.select().from(bookClubDiscussions).where(eq(bookClubDiscussions.clubId, clubId));
    
    if (options?.topicsOnly) {
      // Only get top-level topics (where parentId is null)
      query = db.select().from(bookClubDiscussions).where(
        and(
          eq(bookClubDiscussions.clubId, clubId),
          isNull(bookClubDiscussions.parentId)
        )
      );
    }
    
    if (options?.bookId) {
      query = db.select().from(bookClubDiscussions).where(
        and(
          eq(bookClubDiscussions.clubId, clubId),
          eq(bookClubDiscussions.bookId, options.bookId),
          options.topicsOnly ? isNull(bookClubDiscussions.parentId) : undefined
        )
      );
    }
    
    return await query.orderBy(desc(bookClubDiscussions.createdAt));
  }

  async getBookClubDiscussionWithReplies(topicId: string): Promise<{ topic: BookClubDiscussion; replies: BookClubDiscussion[] } | null> {
    // Get the topic
    const [topic] = await db
      .select()
      .from(bookClubDiscussions)
      .where(eq(bookClubDiscussions.id, topicId));
    
    if (!topic) return null;
    
    // Get all replies to this topic
    const replies = await db
      .select()
      .from(bookClubDiscussions)
      .where(eq(bookClubDiscussions.parentId, topicId))
      .orderBy(bookClubDiscussions.createdAt);
    
    return { topic, replies };
  }

  async createBookClubDiscussion(insertDiscussion: InsertBookClubDiscussion): Promise<BookClubDiscussion> {
    const [discussion] = await db
      .insert(bookClubDiscussions)
      .values(insertDiscussion)
      .returning();
    return discussion;
  }

  async updateBookClubDiscussion(id: string, updates: Partial<InsertBookClubDiscussion>): Promise<BookClubDiscussion | undefined> {
    const [discussion] = await db
      .update(bookClubDiscussions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bookClubDiscussions.id, id))
      .returning();
    return discussion;
  }

  async deleteBookClubDiscussion(id: string): Promise<void> {
    // Also delete all replies to this discussion
    await db.delete(bookClubDiscussions).where(eq(bookClubDiscussions.parentId, id));
    await db.delete(bookClubDiscussions).where(eq(bookClubDiscussions.id, id));
  }

  async incrementDiscussionReplyCount(topicId: string): Promise<void> {
    await db
      .update(bookClubDiscussions)
      .set({ 
        replyCount: sql`COALESCE(${bookClubDiscussions.replyCount}, 0) + 1`,
        updatedAt: new Date()
      })
      .where(eq(bookClubDiscussions.id, topicId));
  }

  // Book Club Meetings
  async getBookClubMeetings(clubId: string, userId: string): Promise<BookClubMeetingWithRsvps[]> {
    const meetings = await db
      .select()
      .from(bookClubMeetings)
      .where(eq(bookClubMeetings.clubId, clubId))
      .orderBy(desc(bookClubMeetings.meetingDate));

    return await Promise.all(
      meetings.map(async (meeting) => {
        const rsvps = await db
          .select()
          .from(meetingRsvps)
          .where(eq(meetingRsvps.meetingId, meeting.id));

        const userRsvp = rsvps.find(r => r.userId === userId) || null;
        const rsvpCounts = {
          going: rsvps.filter(r => r.status === 'going').length,
          maybe: rsvps.filter(r => r.status === 'maybe').length,
          notGoing: rsvps.filter(r => r.status === 'not_going').length,
        };

        return { ...meeting, rsvps, userRsvp, rsvpCounts };
      })
    );
  }

  async getBookClubMeeting(meetingId: string, userId: string): Promise<BookClubMeetingWithRsvps | undefined> {
    const [meeting] = await db
      .select()
      .from(bookClubMeetings)
      .where(eq(bookClubMeetings.id, meetingId));

    if (!meeting) return undefined;

    const rsvps = await db
      .select()
      .from(meetingRsvps)
      .where(eq(meetingRsvps.meetingId, meetingId));

    const userRsvp = rsvps.find(r => r.userId === userId) || null;
    const rsvpCounts = {
      going: rsvps.filter(r => r.status === 'going').length,
      maybe: rsvps.filter(r => r.status === 'maybe').length,
      notGoing: rsvps.filter(r => r.status === 'not_going').length,
    };

    return { ...meeting, rsvps, userRsvp, rsvpCounts };
  }

  async createBookClubMeeting(meeting: InsertBookClubMeeting): Promise<BookClubMeeting> {
    const [newMeeting] = await db
      .insert(bookClubMeetings)
      .values(meeting)
      .returning();
    return newMeeting;
  }

  async updateBookClubMeeting(id: string, updates: Partial<InsertBookClubMeeting>): Promise<BookClubMeeting | undefined> {
    const [meeting] = await db
      .update(bookClubMeetings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bookClubMeetings.id, id))
      .returning();
    return meeting;
  }

  async deleteBookClubMeeting(id: string): Promise<void> {
    await db.delete(bookClubMeetings).where(eq(bookClubMeetings.id, id));
  }

  // Meeting RSVPs
  async upsertMeetingRsvp(meetingId: string, userId: string, status: string): Promise<MeetingRsvp> {
    // Check if RSVP exists
    const [existingRsvp] = await db
      .select()
      .from(meetingRsvps)
      .where(and(
        eq(meetingRsvps.meetingId, meetingId),
        eq(meetingRsvps.userId, userId)
      ));

    if (existingRsvp) {
      const [updated] = await db
        .update(meetingRsvps)
        .set({ status, respondedAt: new Date() })
        .where(eq(meetingRsvps.id, existingRsvp.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(meetingRsvps)
        .values({ meetingId, userId, status })
        .returning();
      return created;
    }
  }

  async getUpcomingMeetingsForUser(userId: string): Promise<(BookClubMeetingWithRsvps & { clubName: string; clubId: string })[]> {
    const now = new Date();
    
    // Get all clubs the user is a member of
    const userClubs = await db
      .select()
      .from(bookClubMembers)
      .where(eq(bookClubMembers.userId, userId));

    if (userClubs.length === 0) return [];

    const clubIds = userClubs.map(c => c.clubId);

    // Get all meetings from those clubs that are in the future
    const allMeetings: (BookClubMeetingWithRsvps & { clubName: string; clubId: string })[] = [];

    for (const clubId of clubIds) {
      const [club] = await db.select().from(bookClubs).where(eq(bookClubs.id, clubId));
      if (!club) continue;

      const meetings = await db
        .select()
        .from(bookClubMeetings)
        .where(eq(bookClubMeetings.clubId, clubId))
        .orderBy(bookClubMeetings.meetingDate);

      for (const meeting of meetings) {
        // Only include future meetings
        if (meeting.meetingDate && meeting.meetingDate >= now) {
          const rsvps = await db
            .select()
            .from(meetingRsvps)
            .where(eq(meetingRsvps.meetingId, meeting.id));

          const userRsvp = rsvps.find(r => r.userId === userId) || null;
          const rsvpCounts = {
            going: rsvps.filter(r => r.status === 'going').length,
            maybe: rsvps.filter(r => r.status === 'maybe').length,
            notGoing: rsvps.filter(r => r.status === 'not_going').length,
          };

          allMeetings.push({
            ...meeting,
            rsvps,
            userRsvp,
            rsvpCounts,
            clubName: club.name,
            clubId: club.id,
          });
        }
      }
    }

    // Sort by meeting date
    allMeetings.sort((a, b) => {
      const dateA = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
      const dateB = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
      return dateA - dateB;
    });

    return allMeetings;
  }
}

export const storage = new DatabaseStorage();
