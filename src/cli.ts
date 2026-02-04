#!/usr/bin/env node

import { runSetup } from './setup.js';

const HELP_TEXT = `
Notion Local MCP - Access your Notion data locally

Usage:
  npx @lu1ee/notion-local-mcp [command]

Commands:
  setup     Configure notion-local for Claude Desktop/Code (interactive)
  help      Show this help message

If no command is provided, the MCP server will start.

Examples:
  npx @lu1ee/notion-local-mcp setup    # Run interactive setup
  npx @lu1ee/notion-local-mcp          # Start MCP server

For more information, visit:
  https://github.com/lu1ee/notion-local-mcp
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'setup':
      await runSetup();
      break;

    case 'help':
    case '--help':
    case '-h':
      console.log(HELP_TEXT);
      break;

    case undefined:
      // No command - start the MCP server
      // Dynamic import to avoid loading server code for CLI commands
      await import('./index.js');
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP_TEXT);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
