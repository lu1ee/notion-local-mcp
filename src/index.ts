#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { closeDatabase } from './database.js';
import { search, searchToolDefinition } from './tools/search.js';
import { getRecentPages, recentToolDefinition } from './tools/recent.js';
import { getPage, getPageToolDefinition } from './tools/getPage.js';
import {
  getParents,
  getChildren,
  parentToolDefinition,
  childrenToolDefinition,
} from './tools/hierarchy.js';

const server = new Server(
  {
    name: 'notion-local',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      searchToolDefinition,
      recentToolDefinition,
      getPageToolDefinition,
      parentToolDefinition,
      childrenToolDefinition,
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'notion_local_search':
        result = search(args as unknown as Parameters<typeof search>[0]);
        break;

      case 'notion_local_recent':
        result = getRecentPages(args as unknown as Parameters<typeof getRecentPages>[0]);
        break;

      case 'notion_local_get_page':
        result = getPage(args as unknown as Parameters<typeof getPage>[0]);
        break;

      case 'notion_local_parent':
        result = getParents(args as unknown as Parameters<typeof getParents>[0]);
        break;

      case 'notion_local_children':
        result = getChildren(args as unknown as Parameters<typeof getChildren>[0]);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: message }),
        },
      ],
      isError: true,
    };
  }
});

// Cleanup on exit
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Notion Local MCP server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
