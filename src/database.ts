import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

const DEFAULT_DB_PATH = join(
  homedir(),
  'Library/Application Support/Notion/notion.db'
);

const DB_PATH = process.env.NOTION_DB_PATH || DEFAULT_DB_PATH;

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function bindParams(sql: string, params: unknown[]): string {
  let idx = 0;
  return sql.replace(/\?/g, () => escapeValue(params[idx++]));
}

function runQuery(sql: string, params: unknown[] = []): unknown[] {
  const boundSql = bindParams(sql, params);
  try {
    const output = execSync('sqlite3 -json -readonly "${DB_PATH}"', {
      input: boundSql,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, DB_PATH },
      shell: '/bin/bash',
    });
    const trimmed = output.trim();
    if (!trimmed) return [];
    return JSON.parse(trimmed);
  } catch (err: unknown) {
    const error = err as { stderr?: string; status?: number };
    if (error.stderr?.includes('no such table')) {
      throw new Error(`Database table not found: ${error.stderr.trim()}`);
    }
    if (error.status === 1 && !error.stderr?.trim()) {
      // Empty result set
      return [];
    }
    throw new Error(`sqlite3 query failed: ${error.stderr?.trim() || 'unknown error'}`);
  }
}

export function getDatabase(): { readonly: true } {
  // Verify database is accessible
  runQuery('SELECT 1');
  return { readonly: true };
}

export function closeDatabase(): void {
  // No-op: sqlite3 CLI doesn't maintain a persistent connection
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
  return runQuery(sql, params) as BlockRow[];
}

export function queryBlock(sql: string, params: unknown[] = []): BlockRow | undefined {
  const rows = runQuery(sql, params);
  return (rows[0] as BlockRow) ?? undefined;
}

export interface CollectionRow {
  id: string;
  name: string | null;
  schema: string | null;
  description: string | null;
  parent_id: string | null;
  alive: number;
}

export function queryCollection(collectionId: string): CollectionRow | undefined {
  const normalizedId = collectionId.replace(/-/g, '');

  const sql = `
    SELECT id, name, schema, description, parent_id, alive
    FROM collection
    WHERE (id = ? OR REPLACE(id, '-', '') = ?)
      AND alive = 1
    LIMIT 1
  `;

  const rows = runQuery(sql, [collectionId, normalizedId]);
  return (rows[0] as CollectionRow) ?? undefined;
}
