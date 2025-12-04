import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import path from 'path';
import fs from 'fs';

// Database storage location for Docker/Unraid containers
// Use DATA_DIR environment variable to set persistent storage location
// Docker example: -v /path/on/host:/config -e DATA_DIR=/config
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// SQLite database file path (can also be overridden directly)
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'luma.db');

console.log(`Database location: ${dbPath}`);

// Create SQLite connection
const sqlite = new Database(dbPath);

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });

// Export the raw sqlite instance for migrations
export { sqlite };
