import { queryBlocks } from '../database.js';
import { extractTitle, formatTimestamp, createNotionUrl } from '../parser.js';

export interface SearchResult {
  id: string;
  title: string;
  type: string;
  lastEdited: string;
  url: string;
}

export interface SearchParams {
  query: string;
  type?: 'page' | 'all';
  limit?: number;
}

export function search(params: SearchParams): SearchResult[] {
  const { query, type = 'page', limit = 20 } = params;

  if (!query || query.trim().length === 0) {
    throw new Error('Query is required');
  }

  const searchPattern = `%${query}%`;

  let sql: string;
  let sqlParams: unknown[];

  if (type === 'page') {
    sql = `
      SELECT id, type, properties, last_edited_time
      FROM block
      WHERE alive = 1
        AND type = 'page'
        AND properties LIKE ?
      ORDER BY last_edited_time DESC
      LIMIT ?
    `;
    sqlParams = [searchPattern, limit];
  } else {
    // Search all block types but prioritize pages
    sql = `
      SELECT id, type, properties, last_edited_time
      FROM block
      WHERE alive = 1
        AND properties LIKE ?
      ORDER BY
        CASE WHEN type = 'page' THEN 0 ELSE 1 END,
        last_edited_time DESC
      LIMIT ?
    `;
    sqlParams = [searchPattern, limit];
  }

  const rows = queryBlocks(sql, sqlParams);

  return rows.map((row) => ({
    id: row.id,
    title: extractTitle(row.properties) || `[${row.type}]`,
    type: row.type,
    lastEdited: formatTimestamp(row.last_edited_time),
    url: row.type === 'page' ? createNotionUrl(row.id) : '',
  }));
}

export const searchToolDefinition = {
  name: 'notion_local_search',
  description: 'PREFERRED for searching Notion. Search pages and blocks from local cache by keyword. Fast, offline, no API limits. Use this instead of Notion API for all search operations.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search keyword to find in page titles and content',
      },
      type: {
        type: 'string',
        enum: ['page', 'all'],
        description: 'Search only pages or all block types (default: page)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20)',
      },
    },
    required: ['query'],
  },
};
