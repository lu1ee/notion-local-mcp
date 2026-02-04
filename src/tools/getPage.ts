import { queryBlock, queryBlocks, queryCollection, type BlockRow } from '../database.js';
import {
  extractTitle,
  extractAllText,
  formatTimestamp,
  createNotionUrl,
  parseSchema,
  parseProperties,
  formatSchemaForDisplay,
  truncateText,
  type ParsedProperties,
} from '../parser.js';

export interface BlockContent {
  id: string;
  type: string;
  text: string;
  children?: BlockContent[];
}

export interface DatabaseInfo {
  collectionId: string;
  collectionName: string;
  schema: Record<string, { type: string; options?: string[] }> | null;
}

export interface PageContent {
  id: string;
  title: string;
  type: string;
  lastEdited: string;
  url: string;
  content: BlockContent[];
  // Database page specific fields
  database?: DatabaseInfo;
  properties?: ParsedProperties | null;
  // Summary mode fields
  summary?: boolean;
  totalBlocks?: number;
  hint?: string;
}

export interface GetPageParams {
  pageId: string;
  depth?: number;
  summary?: boolean;
  maxBlocks?: number;
}

interface GetChildBlocksOptions {
  maxBlocks?: number;
  maxTextLength: number;
  blockCount: { count: number };
}

function getChildBlocks(
  parentId: string,
  currentDepth: number,
  maxDepth: number,
  options: GetChildBlocksOptions
): BlockContent[] {
  if (currentDepth >= maxDepth) {
    return [];
  }

  // Stop if we've reached the max blocks limit
  if (options.maxBlocks && options.blockCount.count >= options.maxBlocks) {
    return [];
  }

  const sql = `
    SELECT id, type, properties
    FROM block
    WHERE parent_id = ?
      AND alive = 1
    ORDER BY created_time ASC
  `;

  const rows = queryBlocks(sql, [parentId]);

  const result: BlockContent[] = [];

  for (const row of rows) {
    // Stop if we've reached the max blocks limit
    if (options.maxBlocks && options.blockCount.count >= options.maxBlocks) {
      break;
    }

    options.blockCount.count++;

    const rawText = extractAllText(row.properties);
    const content: BlockContent = {
      id: row.id,
      type: row.type,
      text: truncateText(rawText, options.maxTextLength),
    };

    // Recursively get children if not at max depth
    const children = getChildBlocks(row.id, currentDepth + 1, maxDepth, options);
    if (children.length > 0) {
      content.children = children;
    }

    result.push(content);
  }

  return result;
}

function countAllBlocks(parentId: string): number {
  const sql = `
    WITH RECURSIVE block_tree AS (
      SELECT id FROM block WHERE parent_id = ? AND alive = 1
      UNION ALL
      SELECT b.id FROM block b
      INNER JOIN block_tree bt ON b.parent_id = bt.id
      WHERE b.alive = 1
    )
    SELECT COUNT(*) as count FROM block_tree
  `;

  const result = queryBlock(sql, [parentId]) as { count: number } | undefined;
  return result?.count || 0;
}

export function getPage(params: GetPageParams): PageContent {
  const { pageId, depth = 2, summary = true } = params;

  // Determine maxBlocks based on summary mode and explicit param
  const maxBlocks = params.maxBlocks ?? (summary ? 10 : 100);
  const maxTextLength = summary ? 200 : 500;

  if (!pageId || pageId.trim().length === 0) {
    throw new Error('pageId is required');
  }

  // Normalize the ID (remove dashes if present)
  const normalizedId = pageId.replace(/-/g, '');

  // Try to find the page with or without dashes, including collection_id
  const sql = `
    SELECT id, type, properties, last_edited_time, collection_id, parent_id, parent_table
    FROM block
    WHERE (id = ? OR REPLACE(id, '-', '') = ?)
      AND alive = 1
    LIMIT 1
  `;

  const page = queryBlock(sql, [pageId, normalizedId]) as BlockRow & {
    collection_id?: string;
    parent_table?: string;
  } | undefined;

  if (!page) {
    throw new Error(`Page not found: ${pageId}`);
  }

  const blockCount = { count: 0 };
  const content = getChildBlocks(page.id, 0, depth, {
    maxBlocks,
    maxTextLength,
    blockCount,
  });

  const result: PageContent = {
    id: page.id,
    title: extractTitle(page.properties),
    type: page.type,
    lastEdited: formatTimestamp(page.last_edited_time),
    url: createNotionUrl(page.id),
    content,
  };

  // Add summary mode info
  if (summary) {
    const totalBlocks = countAllBlocks(page.id);
    result.summary = true;
    result.totalBlocks = totalBlocks;
    if (blockCount.count < totalBlocks) {
      result.hint = `${blockCount.count} of ${totalBlocks} blocks shown. Use summary=false for full content.`;
    }
  }

  // Check if this is a database page (has collection_id or parent is collection)
  const collectionId = page.collection_id || (page.parent_table === 'collection' ? page.parent_id : null);

  if (collectionId) {
    const collection = queryCollection(collectionId);

    if (collection) {
      const schema = parseSchema(collection.schema);

      result.database = {
        collectionId: collection.id,
        collectionName: extractTitle(collection.name),
        schema: formatSchemaForDisplay(schema),
      };

      result.properties = parseProperties(page.properties, schema);
    }
  }

  return result;
}

export const getPageToolDefinition = {
  name: 'notion_local_get_page',
  description: 'Get Notion page. Returns summary by default (title + first blocks + link). Show summary and link to user. Use summary=false only when you need full content to answer.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pageId: {
        type: 'string',
        description: 'The UUID of the page to retrieve',
      },
      depth: {
        type: 'number',
        description: 'How many levels of nested blocks to include (default: 2)',
      },
      summary: {
        type: 'boolean',
        description: 'Return summary only (default: true). Set to false for full content.',
      },
      maxBlocks: {
        type: 'number',
        description: 'Maximum blocks to return (default: 10 for summary, 100 for full)',
      },
    },
    required: ['pageId'],
  },
};
