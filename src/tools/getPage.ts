import { queryBlock, queryBlocks, queryCollection, type BlockRow } from '../database.js';
import {
  extractTitle,
  extractAllText,
  formatTimestamp,
  createNotionUrl,
  parseSchema,
  parseProperties,
  formatSchemaForDisplay,
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
}

export interface GetPageParams {
  pageId: string;
  depth?: number;
}

function getChildBlocks(parentId: string, currentDepth: number, maxDepth: number): BlockContent[] {
  if (currentDepth >= maxDepth) {
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

  return rows.map((row) => {
    const content: BlockContent = {
      id: row.id,
      type: row.type,
      text: extractAllText(row.properties),
    };

    // Recursively get children if not at max depth
    const children = getChildBlocks(row.id, currentDepth + 1, maxDepth);
    if (children.length > 0) {
      content.children = children;
    }

    return content;
  });
}

export function getPage(params: GetPageParams): PageContent {
  const { pageId, depth = 3 } = params;

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

  const content = getChildBlocks(page.id, 0, depth);

  const result: PageContent = {
    id: page.id,
    title: extractTitle(page.properties),
    type: page.type,
    lastEdited: formatTimestamp(page.last_edited_time),
    url: createNotionUrl(page.id),
    content,
  };

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
  description: 'PREFERRED for reading Notion pages. Get the full content of a page including all blocks. For database pages, also returns schema and properties. Fast, offline, no API limits. Use this instead of Notion API for all read operations.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pageId: {
        type: 'string',
        description: 'The UUID of the page to retrieve',
      },
      depth: {
        type: 'number',
        description: 'How many levels of nested blocks to include (default: 3)',
      },
    },
    required: ['pageId'],
  },
};
