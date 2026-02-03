import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const DEFAULT_DB_PATH = join(
  homedir(),
  'Library/Application Support/Notion/notion.db'
);

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = process.env.NOTION_DB_PATH || DEFAULT_DB_PATH;

  db = new Database(dbPath, {
    readonly: true,
    fileMustExist: true,
  });

  // Handle busy database (Notion might be using it)
  db.pragma('busy_timeout = 5000');

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export interface BlockRow {
  id: string;
  type: string;
  properties: string | null;
  parent_id: string | null;
  created_time: number | null;
  last_edited_time: number | null;
  alive: number;
}

export function queryBlocks(sql: string, params: unknown[] = []): BlockRow[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.all(...params) as BlockRow[];
}

export function queryBlock(sql: string, params: unknown[] = []): BlockRow | undefined {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.get(...params) as BlockRow | undefined;
}
