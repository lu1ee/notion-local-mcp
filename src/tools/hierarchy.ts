import { queryBlock, queryBlocks } from '../database.js';
import { extractTitle, createNotionUrl } from '../parser.js';

export interface HierarchyNode {
  id: string;
  title: string;
  type: string;
  url: string;
  children?: HierarchyNode[];
}

export interface ParentParams {
  pageId: string;
}

export interface ChildrenParams {
  pageId: string;
  depth?: number;
}

/**
 * Get all ancestors of a page up to the root
 */
export function getParents(params: ParentParams): HierarchyNode[] {
  const { pageId } = params;

  if (!pageId || pageId.trim().length === 0) {
    throw new Error('pageId is required');
  }

  const normalizedId = pageId.replace(/-/g, '');
  const ancestors: HierarchyNode[] = [];

  let currentId: string | null = pageId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      break; // Prevent infinite loops
    }
    visited.add(currentId);

    const sql = `
      SELECT id, type, properties, parent_id
      FROM block
      WHERE (id = ? OR REPLACE(id, '-', '') = ?)
        AND alive = 1
      LIMIT 1
    `;

    const block = queryBlock(sql, [currentId, currentId.replace(/-/g, '')]);

    if (!block) {
      break;
    }

    // Skip the first one (it's the page itself, not an ancestor)
    if (ancestors.length > 0 || currentId !== pageId) {
      ancestors.push({
        id: block.id,
        title: extractTitle(block.properties),
        type: block.type,
        url: block.type === 'page' ? createNotionUrl(block.id) : '',
      });
    }

    currentId = block.parent_id;
  }

  return ancestors;
}

/**
 * Get children pages recursively
 */
function getChildrenRecursive(parentId: string, currentDepth: number, maxDepth: number): HierarchyNode[] {
  if (currentDepth >= maxDepth) {
    return [];
  }

  const sql = `
    SELECT id, type, properties
    FROM block
    WHERE parent_id = ?
      AND type = 'page'
      AND alive = 1
    ORDER BY created_time ASC
  `;

  const rows = queryBlocks(sql, [parentId]);

  return rows.map((row) => {
    const node: HierarchyNode = {
      id: row.id,
      title: extractTitle(row.properties),
      type: row.type,
      url: createNotionUrl(row.id),
    };

    const children = getChildrenRecursive(row.id, currentDepth + 1, maxDepth);
    if (children.length > 0) {
      node.children = children;
    }

    return node;
  });
}

/**
 * Get all child pages under a page
 */
export function getChildren(params: ChildrenParams): HierarchyNode[] {
  const { pageId, depth = 2 } = params;

  if (!pageId || pageId.trim().length === 0) {
    throw new Error('pageId is required');
  }

  return getChildrenRecursive(pageId, 0, depth);
}

export const parentToolDefinition = {
  name: 'notion_local_parent',
  description: 'Get all ancestor pages of a Notion page up to the root',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pageId: {
        type: 'string',
        description: 'The UUID of the page',
      },
    },
    required: ['pageId'],
  },
};

export const childrenToolDefinition = {
  name: 'notion_local_children',
  description: 'Get all child pages under a Notion page',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pageId: {
        type: 'string',
        description: 'The UUID of the parent page',
      },
      depth: {
        type: 'number',
        description: 'How many levels deep to traverse (default: 2)',
      },
    },
    required: ['pageId'],
  },
};
