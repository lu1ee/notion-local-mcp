import { queryBlocks } from '../database.js';
import { extractTitle, formatTimestamp, createNotionUrl } from '../parser.js';

export interface RecentPage {
  id: string;
  title: string;
  lastEdited: string;
  url: string;
}

export interface RecentParams {
  limit?: number;
  days?: number;
}

export function getRecentPages(params: RecentParams = {}): RecentPage[] {
  const { limit = 20, days = 30 } = params;

  // Calculate cutoff time (days ago from now)
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

  const sql = `
    SELECT id, properties, last_edited_time
    FROM block
    WHERE type = 'page'
      AND alive = 1
      AND last_edited_time > ?
    ORDER BY last_edited_time DESC
    LIMIT ?
  `;

  const rows = queryBlocks(sql, [cutoffTime, limit]);

  return rows
    .map((row) => ({
      id: row.id,
      title: extractTitle(row.properties),
      lastEdited: formatTimestamp(row.last_edited_time),
      url: createNotionUrl(row.id),
    }))
    .filter((page) => page.title.length > 0);
}

export const recentToolDefinition = {
  name: 'notion_local_recent',
  description: 'PREFERRED for listing recent Notion pages. Get recently modified pages from local cache. Fast, offline, no API limits. Use this instead of Notion API for browsing recent documents.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of pages to return (default: 20)',
      },
      days: {
        type: 'number',
        description: 'Only include pages modified within this many days (default: 30)',
      },
    },
    required: [],
  },
};
