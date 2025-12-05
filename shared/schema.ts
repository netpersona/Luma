import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Helper to generate UUIDs (used in storage layer)
export function generateId(): string {
  return crypto.randomUUID();
}

// ==================== AUTHENTICATION TABLES ====================

// Users table - for multi-user authentication
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"), // null if using OAuth only
  googleId: text("google_id").unique(), // Google OAuth subject ID
  role: text("role").notNull().default('user'), // 'admin', 'user'
  status: text("status").notNull().default('active'), // 'active', 'pending', 'disabled'
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  invitedBy: text("invited_by"), // user id of who invited them
  inviteCodeUsed: text("invite_code_used"), // the invite code they used
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Sessions table - for session management
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Invite tokens - for restricted registration
export const inviteTokens = sqliteTable("invite_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  maxUses: integer("max_uses").default(1), // null = unlimited
  usageCount: integer("usage_count").default(0),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  note: text("note"), // admin note about this invite
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ==================== LIBRARY TABLES ====================

// Books table - for eBooks (EPUB, PDF, MOBI, CBZ, CBR)
export const books = sqliteTable("books", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  author: text("author"),
  narrator: text("narrator"),
  coverUrl: text("cover_url"),
  filePath: text("file_path").notNull(),
  format: text("format").notNull(), // epub, pdf, mobi, cbz, cbr
  fileSize: integer("file_size"),
  pageCount: integer("page_count"),
  description: text("description"),
  series: text("series"),
  seriesIndex: real("series_index"),
  publisher: text("publisher"),
  publishedDate: text("published_date"),
  isbn: text("isbn"),
  language: text("language"),
  tags: text("tags"), // JSON array stored as text
  dominantColors: text("dominant_colors"), // JSON array stored as text
  addedAt: integer("added_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  calibreId: integer("calibre_id"),
  source: text("source"), // 'upload', 'annas-archive', 'calibre'
  sourceId: text("source_id"),
  sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp" }),
  originPath: text("origin_path"),
});

// Audiobooks table - for audiobooks (M4B, MP3, M4A)
export const audiobooks = sqliteTable("audiobooks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  author: text("author"),
  narrator: text("narrator"),
  coverUrl: text("cover_url"),
  filePath: text("file_path").notNull(), // For single-file audiobooks; empty for multi-track
  format: text("format").notNull(), // m4b, mp3, m4a, multi (for multi-track)
  fileSize: integer("file_size"),
  duration: integer("duration"), // in seconds (total duration for multi-track)
  bitrate: integer("bitrate"),
  trackCount: integer("track_count").default(1), // Number of tracks (1 for single-file)
  description: text("description"),
  series: text("series"),
  seriesIndex: real("series_index"),
  publisher: text("publisher"),
  publishedDate: text("published_date"),
  isbn: text("isbn"),
  language: text("language"),
  tags: text("tags"), // JSON array stored as text
  dominantColors: text("dominant_colors"), // JSON array stored as text
  chapters: text("chapters"), // JSON string with chapter data
  addedAt: integer("added_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  calibreId: integer("calibre_id"),
  source: text("source"),
  sourceId: text("source_id"),
  sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp" }),
  originPath: text("origin_path"),
});

// Audiobook tracks - for multi-file audiobooks (one row per audio file)
export const audiobookTracks = sqliteTable("audiobook_tracks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  audiobookId: text("audiobook_id").notNull().references(() => audiobooks.id, { onDelete: "cascade" }),
  trackIndex: integer("track_index").notNull(), // 0-based index for ordering
  title: text("title"), // Chapter/track title (from metadata or filename)
  filePath: text("file_path").notNull(), // Path to the audio file
  duration: integer("duration"), // Duration in seconds
  fileSize: integer("file_size"),
  bitrate: integer("bitrate"),
});

// Reading progress for books
export const readingProgress = sqliteTable("reading_progress", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  lastPosition: text("last_position").notNull(), // JSON string with location data
  progress: real("progress").notNull().default(0), // 0-100 percentage
  lastReadAt: integer("last_read_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  completed: integer("completed", { mode: "boolean" }).default(false),
});

// Listening progress for audiobooks
export const listeningProgress = sqliteTable("listening_progress", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  audiobookId: text("audiobook_id").notNull().references(() => audiobooks.id, { onDelete: "cascade" }),
  lastPosition: integer("last_position").notNull().default(0), // in seconds
  progress: real("progress").notNull().default(0), // 0-100 percentage
  playbackRate: real("playback_rate").notNull().default(1.0),
  lastListenedAt: integer("last_listened_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  completed: integer("completed", { mode: "boolean" }).default(false),
});

// Collections/Shelves for organizing books and audiobooks
export const collections = sqliteTable("collections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Collection items - many-to-many relationship
export const collectionItems = sqliteTable("collection_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  collectionId: text("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(), // book or audiobook id
  itemType: text("item_type").notNull(), // 'book' or 'audiobook'
  addedAt: integer("added_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  order: integer("order").default(0),
});

// Bookmarks for both books and audiobooks
export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id").notNull(), // book or audiobook id
  itemType: text("item_type").notNull(), // 'book' or 'audiobook'
  position: text("position").notNull(), // JSON string with location data
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Highlights for text selection in books
export const highlights = sqliteTable("highlights", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  cfiRange: text("cfi_range").notNull(), // EPUB CFI range for highlight position
  selectedText: text("selected_text").notNull(), // The highlighted text content
  color: text("color").notNull().default('yellow'), // yellow, green, blue, pink, orange
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Annotations/notes on highlights
export const annotations = sqliteTable("annotations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  highlightId: text("highlight_id").notNull().references(() => highlights.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Reader preferences for customizing reading experience
export const readerPreferences = sqliteTable("reader_preferences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").default('default'),
  fontSize: integer("font_size").notNull().default(16),
  fontFamily: text("font_family").notNull().default('serif'),
  lineHeight: real("line_height").notNull().default(1.6),
  theme: text("theme").notNull().default('light'),
  backgroundColor: text("background_color").default('#ffffff'),
  textColor: text("text_color").default('#000000'),
  linkColor: text("link_color").default('#0066cc'),
  brightness: integer("brightness").default(100),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Integration settings - for storing API keys and configuration
export const integrationSettings = sqliteTable("integration_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  value: text("value"),
  scope: text("scope").notNull().default('global'),
  isSecret: integer("is_secret", { mode: "boolean" }).default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Import jobs - for tracking downloads from Anna's Archive and Calibre syncs
export const importJobs = sqliteTable("import_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  source: text("source").notNull(), // 'annas-archive', 'calibre'
  sourceId: text("source_id"),
  title: text("title"),
  author: text("author"),
  status: text("status").notNull().default('pending'),
  progress: integer("progress").default(0),
  errorMessage: text("error_message"),
  resultItemId: text("result_item_id"),
  resultItemType: text("result_item_type"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// User ratings and reviews
export const userRatings = sqliteTable("user_ratings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").default('default'),
  itemId: text("item_id").notNull(),
  itemType: text("item_type").notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  source: text("source").notNull().default('local'),
  goodreadsId: text("goodreads_id"),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
  syncStatus: text("sync_status").default('pending'),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Recommendation cache
export const recommendationCache = sqliteTable("recommendation_cache", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").default('default'),
  cacheKey: text("cache_key").notNull(),
  recommendations: text("recommendations").notNull(), // JSON array
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Delivery jobs - for tracking book deliveries to Kindle/email
export const deliveryJobs = sqliteTable("delivery_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id").notNull(),
  itemType: text("item_type").notNull().default('book'),
  targetEmail: text("target_email").notNull(),
  deliveryType: text("delivery_type").notNull().default('kindle'),
  status: text("status").notNull().default('pending'),
  attempts: integer("attempts").default(0),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  sentAt: integer("sent_at", { mode: "timestamp" }),
});

// OPDS sources - for OPDS catalog feeds
export const opdsSources = sqliteTable("opds_sources", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  url: text("url").notNull(),
  username: text("username"),
  password: text("password"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Calibre libraries - for tracking imported Calibre libraries
export const calibreLibraries = sqliteTable("calibre_libraries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  path: text("path").notNull(),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  bookCount: integer("book_count").default(0),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Reading goals - for tracking reading targets
export const readingGoals = sqliteTable("reading_goals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").default('default'),
  goalType: text("goal_type").notNull(), // 'books', 'pages', 'minutes', 'audiobooks'
  period: text("period").notNull(), // 'daily', 'weekly', 'monthly', 'yearly'
  targetValue: integer("target_value").notNull(),
  currentValue: integer("current_value").default(0),
  startDate: integer("start_date", { mode: "timestamp" }).$defaultFn(() => new Date()),
  endDate: integer("end_date", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Reading sessions - for tracking individual reading/listening sessions
export const readingSessions = sqliteTable("reading_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").default('default'),
  itemId: text("item_id").notNull(),
  itemType: text("item_type").notNull(),
  startTime: integer("start_time", { mode: "timestamp" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp" }),
  durationMinutes: integer("duration_minutes").default(0),
  pagesRead: integer("pages_read").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Book Clubs - for group reading
export const bookClubs = sqliteTable("book_clubs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  currentBookId: text("current_book_id"),
  currentBookType: text("current_book_type"),
  readingDeadline: integer("reading_deadline", { mode: "timestamp" }),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false),
  createdBy: text("created_by").default('default'),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Book Club Members
export const bookClubMembers = sqliteTable("book_club_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clubId: text("club_id").notNull().references(() => bookClubs.id, { onDelete: "cascade" }),
  userId: text("user_id").default('default'),
  role: text("role").default('member'), // 'admin', 'moderator', 'member'
  joinedAt: integer("joined_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Book Club Discussions
export const bookClubDiscussions = sqliteTable("book_club_discussions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clubId: text("club_id").notNull().references(() => bookClubs.id, { onDelete: "cascade" }),
  userId: text("user_id").default('default'),
  userName: text("user_name").default('Anonymous'),
  title: text("title"), // Topic title (null for replies)
  content: text("content").notNull(),
  parentId: text("parent_id"), // null = top-level topic, otherwise = reply to topic
  bookId: text("book_id"), // Link to specific book
  bookType: text("book_type"), // 'book' or 'audiobook'
  chapterInfo: text("chapter_info"), // Chapter reference (e.g., "Chapter 5" or "Part 2, Chapter 3")
  replyCount: integer("reply_count").default(0), // Cached count of replies
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Book Club Meetings - for scheduling in-person or virtual gatherings
export const bookClubMeetings = sqliteTable("book_club_meetings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clubId: text("club_id").notNull().references(() => bookClubs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  meetingDate: integer("meeting_date", { mode: "timestamp" }).notNull(),
  locationName: text("location_name"), // e.g., "Central Library", "Zoom", "Joe's Coffee"
  address: text("address"), // Physical address for copy-to-maps feature
  isVirtual: integer("is_virtual", { mode: "boolean" }).default(false),
  virtualLink: text("virtual_link"), // Zoom/Meet link for virtual meetings
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Meeting RSVPs - track who's attending
export const meetingRsvps = sqliteTable("meeting_rsvps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  meetingId: text("meeting_id").notNull().references(() => bookClubMeetings.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default('pending'), // 'going', 'maybe', 'not_going', 'pending'
  respondedAt: integer("responded_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  inviteTokensCreated: many(inviteTokens),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const inviteTokensRelations = relations(inviteTokens, ({ one }) => ({
  createdByUser: one(users, {
    fields: [inviteTokens.createdBy],
    references: [users.id],
  }),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
  progress: one(readingProgress, {
    fields: [books.id],
    references: [readingProgress.bookId],
  }),
  bookmarks: many(bookmarks),
  highlights: many(highlights),
}));

export const highlightsRelations = relations(highlights, ({ one, many }) => ({
  book: one(books, {
    fields: [highlights.bookId],
    references: [books.id],
  }),
  annotations: many(annotations),
}));

export const annotationsRelations = relations(annotations, ({ one }) => ({
  highlight: one(highlights, {
    fields: [annotations.highlightId],
    references: [highlights.id],
  }),
}));

export const audiobooksRelations = relations(audiobooks, ({ one, many }) => ({
  progress: one(listeningProgress, {
    fields: [audiobooks.id],
    references: [listeningProgress.audiobookId],
  }),
  bookmarks: many(bookmarks),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
}));

export const bookClubsRelations = relations(bookClubs, ({ many }) => ({
  members: many(bookClubMembers),
  discussions: many(bookClubDiscussions),
}));

export const bookClubMembersRelations = relations(bookClubMembers, ({ one }) => ({
  club: one(bookClubs, {
    fields: [bookClubMembers.clubId],
    references: [bookClubs.id],
  }),
}));

export const bookClubDiscussionsRelations = relations(bookClubDiscussions, ({ one }) => ({
  club: one(bookClubs, {
    fields: [bookClubDiscussions.clubId],
    references: [bookClubs.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertInviteTokenSchema = createInsertSchema(inviteTokens).omit({
  id: true,
  createdAt: true,
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  addedAt: true,
});

export const insertAudiobookSchema = createInsertSchema(audiobooks).omit({
  id: true,
  addedAt: true,
});

export const insertAudiobookTrackSchema = createInsertSchema(audiobookTracks).omit({
  id: true,
});

export const insertReadingProgressSchema = createInsertSchema(readingProgress).omit({
  id: true,
  lastReadAt: true,
});

export const insertListeningProgressSchema = createInsertSchema(listeningProgress).omit({
  id: true,
  lastListenedAt: true,
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
});

export const insertCollectionItemSchema = createInsertSchema(collectionItems).omit({
  id: true,
  addedAt: true,
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).omit({
  id: true,
  createdAt: true,
});

export const insertHighlightSchema = createInsertSchema(highlights).omit({
  id: true,
  createdAt: true,
});

export const insertAnnotationSchema = createInsertSchema(annotations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReaderPreferencesSchema = createInsertSchema(readerPreferences).omit({
  id: true,
  updatedAt: true,
});

export const insertIntegrationSettingSchema = createInsertSchema(integrationSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertImportJobSchema = createInsertSchema(importJobs).omit({
  id: true,
  createdAt: true,
});

export const insertUserRatingSchema = createInsertSchema(userRatings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecommendationCacheSchema = createInsertSchema(recommendationCache).omit({
  id: true,
  createdAt: true,
});

export const insertDeliveryJobSchema = createInsertSchema(deliveryJobs).omit({
  id: true,
  createdAt: true,
});

export const insertOpdsSourceSchema = createInsertSchema(opdsSources).omit({
  id: true,
  createdAt: true,
});

export const insertCalibreLibrarySchema = createInsertSchema(calibreLibraries).omit({
  id: true,
  createdAt: true,
});

export const insertReadingGoalSchema = createInsertSchema(readingGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReadingSessionSchema = createInsertSchema(readingSessions).omit({
  id: true,
  createdAt: true,
});

export const insertBookClubSchema = createInsertSchema(bookClubs).omit({
  id: true,
  createdAt: true,
});

export const insertBookClubMemberSchema = createInsertSchema(bookClubMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertBookClubDiscussionSchema = createInsertSchema(bookClubDiscussions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookClubMeetingSchema = createInsertSchema(bookClubMeetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMeetingRsvpSchema = createInsertSchema(meetingRsvps).omit({
  id: true,
  respondedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type InviteToken = typeof inviteTokens.$inferSelect;
export type InsertInviteToken = z.infer<typeof insertInviteTokenSchema>;

export type Book = typeof books.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;

export type Audiobook = typeof audiobooks.$inferSelect;
export type InsertAudiobook = z.infer<typeof insertAudiobookSchema>;

export type AudiobookTrack = typeof audiobookTracks.$inferSelect;
export type InsertAudiobookTrack = z.infer<typeof insertAudiobookTrackSchema>;

export type ReadingProgress = typeof readingProgress.$inferSelect;
export type InsertReadingProgress = z.infer<typeof insertReadingProgressSchema>;

export type ListeningProgress = typeof listeningProgress.$inferSelect;
export type InsertListeningProgress = z.infer<typeof insertListeningProgressSchema>;

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;

export type CollectionItem = typeof collectionItems.$inferSelect;
export type InsertCollectionItem = z.infer<typeof insertCollectionItemSchema>;

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;

export type Highlight = typeof highlights.$inferSelect;
export type InsertHighlight = z.infer<typeof insertHighlightSchema>;

export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;

export type ReaderPreferences = typeof readerPreferences.$inferSelect;
export type InsertReaderPreferences = z.infer<typeof insertReaderPreferencesSchema>;

export type IntegrationSetting = typeof integrationSettings.$inferSelect;
export type InsertIntegrationSetting = z.infer<typeof insertIntegrationSettingSchema>;

export type ImportJob = typeof importJobs.$inferSelect;
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;

export type UserRating = typeof userRatings.$inferSelect;
export type InsertUserRating = z.infer<typeof insertUserRatingSchema>;

export type RecommendationCache = typeof recommendationCache.$inferSelect;
export type InsertRecommendationCache = z.infer<typeof insertRecommendationCacheSchema>;

export type DeliveryJob = typeof deliveryJobs.$inferSelect;
export type InsertDeliveryJob = z.infer<typeof insertDeliveryJobSchema>;

export type OpdsSource = typeof opdsSources.$inferSelect;
export type InsertOpdsSource = z.infer<typeof insertOpdsSourceSchema>;

export type CalibreLibrary = typeof calibreLibraries.$inferSelect;
export type InsertCalibreLibrary = z.infer<typeof insertCalibreLibrarySchema>;

export type ReadingGoal = typeof readingGoals.$inferSelect;
export type InsertReadingGoal = z.infer<typeof insertReadingGoalSchema>;

export type ReadingSession = typeof readingSessions.$inferSelect;
export type InsertReadingSession = z.infer<typeof insertReadingSessionSchema>;

export type BookClub = typeof bookClubs.$inferSelect;
export type InsertBookClub = z.infer<typeof insertBookClubSchema>;

export type BookClubMember = typeof bookClubMembers.$inferSelect;
export type InsertBookClubMember = z.infer<typeof insertBookClubMemberSchema>;

export type BookClubDiscussion = typeof bookClubDiscussions.$inferSelect;
export type InsertBookClubDiscussion = z.infer<typeof insertBookClubDiscussionSchema>;

export type BookClubMeeting = typeof bookClubMeetings.$inferSelect;
export type InsertBookClubMeeting = z.infer<typeof insertBookClubMeetingSchema>;

export type MeetingRsvp = typeof meetingRsvps.$inferSelect;
export type InsertMeetingRsvp = z.infer<typeof insertMeetingRsvpSchema>;

// Extended types with relations
export type BookWithProgress = Book & {
  progress?: ReadingProgress | null;
};

export type AudiobookWithProgress = Audiobook & {
  progress?: ListeningProgress | null;
};

export type HighlightWithAnnotations = Highlight & {
  annotations?: Annotation[];
};

export type CollectionWithItems = Collection & {
  items?: CollectionItem[];
  itemCount?: number;
};

export type BookClubWithMembers = BookClub & {
  members?: BookClubMember[];
  discussions?: BookClubDiscussion[];
};

export type BookClubWithDetails = BookClub & {
  members?: BookClubMember[];
  discussions?: BookClubDiscussion[];
  meetings?: BookClubMeetingWithRsvps[];
  memberCount?: number;
  discussionCount?: number;
  currentBook?: Book | Audiobook | null;
};

export type BookClubMeetingWithRsvps = BookClubMeeting & {
  rsvps?: MeetingRsvp[];
  rsvpCounts?: {
    going: number;
    maybe: number;
    notGoing: number;
  };
  userRsvp?: MeetingRsvp | null;
};
