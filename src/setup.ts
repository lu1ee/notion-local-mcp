import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import * as readline from 'readline';
import {
  getPlatform,
  getNotionDbPath,
  getClaudeDesktopConfigPath,
  getClaudeCodeConfigPath,
  PLATFORM_NAMES,
  isOfficiallySupported,
  type Platform,
} from './paths.js';

interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  type?: string;
}

interface ClaudeConfig {
  mcpServers?: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

/**
 * Check if Notion is installed by looking for the database file
 */
export function checkNotionInstalled(p: Platform = getPlatform()): { installed: boolean; dbPath: string } {
  const dbPath = getNotionDbPath(p);
  return {
    installed: existsSync(dbPath),
    dbPath,
  };
}

/**
 * Generate MCP server configuration
 */
export function generateMcpConfig(notionDbPath: string): McpServerConfig {
  return {
    command: 'npx',
    args: ['-y', '@lulee/notion-local-mcp'],
    env: {
      NOTION_DB_PATH: notionDbPath,
    },
  };
}

/**
 * Read existing config or return empty object
 */
function readConfigFile(path: string): ClaudeConfig {
  if (!existsSync(path)) {
    return {};
  }
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as ClaudeConfig;
  } catch {
    return {};
  }
}

/**
 * Write config file, creating directories if needed
 */
function writeConfigFile(path: string, config: ClaudeConfig): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Setup Claude Desktop Chat configuration
 */
export function setupClaudeDesktop(notionDbPath: string, p: Platform = getPlatform()): { success: boolean; path: string; message: string } {
  const configPath = getClaudeDesktopConfigPath(p);
  const config = readConfigFile(configPath);

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  const existingConfig = config.mcpServers['notion-local'];
  if (existingConfig) {
    return {
      success: true,
      path: configPath,
      message: 'notion-local is already configured in Claude Desktop',
    };
  }

  config.mcpServers['notion-local'] = generateMcpConfig(notionDbPath);
  writeConfigFile(configPath, config);

  return {
    success: true,
    path: configPath,
    message: 'Successfully configured notion-local for Claude Desktop',
  };
}

/**
 * Setup Claude Code configuration
 */
export function setupClaudeCode(notionDbPath: string): { success: boolean; path: string; message: string } {
  const configPath = getClaudeCodeConfigPath();
  const config = readConfigFile(configPath);

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  const existingConfig = config.mcpServers['notion-local'];
  if (existingConfig) {
    return {
      success: true,
      path: configPath,
      message: 'notion-local is already configured in Claude Code',
    };
  }

  config.mcpServers['notion-local'] = {
    ...generateMcpConfig(notionDbPath),
    type: 'stdio',
  };
  writeConfigFile(configPath, config);

  return {
    success: true,
    path: configPath,
    message: 'Successfully configured notion-local for Claude Code',
  };
}

/**
 * Interactive setup prompt
 */
async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Run interactive setup
 */
export async function runSetup(): Promise<void> {
  const p = getPlatform();

  console.log('');
  console.log('🔧 Notion Local MCP Setup');
  console.log('='.repeat(40));
  console.log('');

  // Check platform
  console.log(`🔍 Operating system: ${PLATFORM_NAMES[p]}`);

  // Warn about unofficial platform support
  if (!isOfficiallySupported(p)) {
    console.log('');
    console.log('⚠️  Warning: Linux is not officially supported.');
    console.log('   Notion does not provide an official Linux desktop app.');
    console.log('   This may work with unofficial community builds (e.g., notion-app-electron).');
    console.log('');
  }

  // Check Notion installation
  const { installed, dbPath } = checkNotionInstalled(p);
  if (!installed) {
    console.log('');
    console.log('❌ Notion desktop app not found!');
    console.log('');
    console.log('Please install Notion desktop app first:');
    console.log('https://www.notion.so/desktop');
    console.log('');
    console.log('After installing, open Notion and let it sync your data,');
    console.log('then run this setup again.');
    process.exit(1);
  }

  console.log(`✅ Notion found: ${dbPath}`);
  console.log('');

  // Ask which apps to configure
  console.log('Which apps do you want to configure?');
  console.log('');
  console.log('  1. Claude Desktop Chat');
  console.log('  2. Claude Code (CLI)');
  console.log('  3. Both (recommended)');
  console.log('');

  const choice = await prompt('Enter choice [1-3, default: 3]: ');
  const selected = choice === '' ? '3' : choice;

  console.log('');

  const results: string[] = [];

  if (selected === '1' || selected === '3') {
    const result = setupClaudeDesktop(dbPath, p);
    if (result.success) {
      results.push(`✅ Claude Desktop: ${result.message}`);
    } else {
      results.push(`❌ Claude Desktop: ${result.message}`);
    }
  }

  if (selected === '2' || selected === '3') {
    const result = setupClaudeCode(dbPath);
    if (result.success) {
      results.push(`✅ Claude Code: ${result.message}`);
    } else {
      results.push(`❌ Claude Code: ${result.message}`);
    }
  }

  // Print results
  console.log('='.repeat(40));
  console.log('');
  for (const result of results) {
    console.log(result);
  }
  console.log('');
  console.log('🎉 Setup complete!');
  console.log('');
  console.log('Please restart your Claude app to apply the changes.');
  console.log('');
}
