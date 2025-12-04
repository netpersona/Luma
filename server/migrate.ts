import { db, sqlite } from './db';
import * as schema from '@shared/schema';

// Create all tables for SQLite
export function createTables() {
  console.log('Creating SQLite tables...');

  // ==================== AUTHENTICATION TABLES ====================
  
  // Users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      display_name TEXT,
      avatar_url TEXT,
      invited_by TEXT,
      invite_code_used TEXT,
      last_login_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Sessions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Invite tokens table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      max_uses INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      expires_at INTEGER,
      is_active INTEGER DEFAULT 1,
      note TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create index on sessions for faster lookups
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);

  // ==================== LIBRARY TABLES ====================
  
  // Books table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      narrator TEXT,
      cover_url TEXT,
      file_path TEXT NOT NULL,
      format TEXT NOT NULL,
      file_size INTEGER,
      page_count INTEGER,
      description TEXT,
      series TEXT,
      series_index REAL,
      publisher TEXT,
      published_date TEXT,
      isbn TEXT,
      language TEXT,
      tags TEXT,
      dominant_colors TEXT,
      added_at INTEGER NOT NULL DEFAULT (unixepoch()),
      calibre_id INTEGER,
      source TEXT,
      source_id TEXT,
      source_updated_at INTEGER,
      origin_path TEXT
    )
  `);

  // Audiobooks table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audiobooks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      narrator TEXT,
      cover_url TEXT,
      file_path TEXT NOT NULL,
      format TEXT NOT NULL,
      file_size INTEGER,
      duration INTEGER,
      bitrate INTEGER,
      description TEXT,
      series TEXT,
      series_index REAL,
      publisher TEXT,
      published_date TEXT,
      isbn TEXT,
      language TEXT,
      tags TEXT,
      dominant_colors TEXT,
      chapters TEXT,
      added_at INTEGER NOT NULL DEFAULT (unixepoch()),
      calibre_id INTEGER,
      source TEXT,
      source_id TEXT,
      source_updated_at INTEGER,
      origin_path TEXT
    )
  `);

  // Reading progress table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      last_position TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      last_read_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed INTEGER DEFAULT 0
    )
  `);

  // Listening progress table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS listening_progress (
      id TEXT PRIMARY KEY,
      audiobook_id TEXT NOT NULL REFERENCES audiobooks(id) ON DELETE CASCADE,
      last_position INTEGER NOT NULL DEFAULT 0,
      progress REAL NOT NULL DEFAULT 0,
      playback_rate REAL NOT NULL DEFAULT 1.0,
      last_listened_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed INTEGER DEFAULT 0
    )
  `);

  // Collections table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Collection items table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS collection_items (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      added_at INTEGER NOT NULL DEFAULT (unixepoch()),
      "order" INTEGER DEFAULT 0
    )
  `);

  // Bookmarks table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      position TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Highlights table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      cfi_range TEXT NOT NULL,
      selected_text TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'yellow',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Annotations table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      highlight_id TEXT NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Reader preferences table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reader_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default',
      font_size INTEGER NOT NULL DEFAULT 16,
      font_family TEXT NOT NULL DEFAULT 'serif',
      line_height REAL NOT NULL DEFAULT 1.6,
      theme TEXT NOT NULL DEFAULT 'light',
      background_color TEXT DEFAULT '#ffffff',
      text_color TEXT DEFAULT '#000000',
      link_color TEXT DEFAULT '#0066cc',
      brightness INTEGER DEFAULT 100,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Integration settings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS integration_settings (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      scope TEXT NOT NULL DEFAULT 'global',
      is_secret INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Import jobs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT,
      title TEXT,
      author TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      error_message TEXT,
      result_item_id TEXT,
      result_item_type TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER
    )
  `);

  // User ratings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_ratings (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default',
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      rating INTEGER NOT NULL,
      review TEXT,
      source TEXT NOT NULL DEFAULT 'local',
      goodreads_id TEXT,
      synced_at INTEGER,
      sync_status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Recommendation cache table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS recommendation_cache (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default',
      cache_key TEXT NOT NULL,
      recommendations TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Delivery jobs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS delivery_jobs (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'book',
      target_email TEXT NOT NULL,
      delivery_type TEXT NOT NULL DEFAULT 'kindle',
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      error_message TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      sent_at INTEGER
    )
  `);

  // OPDS sources table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS opds_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      username TEXT,
      password TEXT,
      last_synced_at INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Calibre libraries table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS calibre_libraries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      last_synced_at INTEGER,
      book_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Reading goals table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reading_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default',
      goal_type TEXT NOT NULL,
      period TEXT NOT NULL,
      target_value INTEGER NOT NULL,
      current_value INTEGER DEFAULT 0,
      start_date INTEGER NOT NULL DEFAULT (unixepoch()),
      end_date INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Reading sessions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default',
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_minutes INTEGER DEFAULT 0,
      pages_read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Book clubs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS book_clubs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      cover_url TEXT,
      current_book_id TEXT,
      current_book_type TEXT,
      reading_deadline INTEGER,
      is_private INTEGER DEFAULT 0,
      created_by TEXT DEFAULT 'default',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Book club members table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS book_club_members (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
      user_id TEXT DEFAULT 'default',
      role TEXT DEFAULT 'member',
      joined_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Book club discussions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS book_club_discussions (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
      user_id TEXT DEFAULT 'default',
      user_name TEXT DEFAULT 'Anonymous',
      title TEXT,
      content TEXT NOT NULL,
      parent_id TEXT,
      book_id TEXT,
      book_type TEXT,
      chapter_info TEXT,
      reply_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Add new columns to book_club_discussions if they don't exist
  try {
    sqlite.exec(`ALTER TABLE book_club_discussions ADD COLUMN title TEXT`);
  } catch (e) { /* Column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE book_club_discussions ADD COLUMN chapter_info TEXT`);
  } catch (e) { /* Column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE book_club_discussions ADD COLUMN reply_count INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }

  // Book club meetings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS book_club_meetings (
      id TEXT PRIMARY KEY,
      club_id TEXT NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      meeting_date INTEGER NOT NULL,
      location_name TEXT,
      address TEXT,
      is_virtual INTEGER DEFAULT 0,
      virtual_link TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Meeting RSVPs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS meeting_rsvps (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES book_club_meetings(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      responded_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create indexes for meeting lookups
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_meetings_club_id ON book_club_meetings(club_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_meetings_date ON book_club_meetings(meeting_date)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_rsvps_meeting_id ON meeting_rsvps(meeting_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_rsvps_user_id ON meeting_rsvps(user_id)`);

  console.log('All tables created successfully!');
}

// Run migrations if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTables();
}
