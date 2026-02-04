import { homedir, platform } from 'os';
import { join } from 'path';

export type Platform = 'darwin' | 'win32' | 'linux';

/**
 * Supported platforms (officially tested)
 * Note: Linux has no official Notion desktop app, only unofficial community builds
 */
export const SUPPORTED_PLATFORMS: Platform[] = ['darwin', 'win32'];

/**
 * Get the current platform
 */
export function getPlatform(): Platform {
  const p = platform();
  if (p === 'darwin' || p === 'win32' || p === 'linux') {
    return p;
  }
  throw new Error(`Unsupported platform: ${p}`);
}

/**
 * Check if the current platform is officially supported
 */
export function isOfficiallySupported(p: Platform = getPlatform()): boolean {
  return SUPPORTED_PLATFORMS.includes(p);
}

/**
 * Get Notion database path for the current platform
 */
export function getNotionDbPath(p: Platform = getPlatform()): string {
  const home = homedir();

  switch (p) {
    case 'darwin':
      return join(home, 'Library/Application Support/Notion/notion.db');
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData/Roaming'), 'Notion/notion.db');
    case 'linux':
      return join(home, '.config/Notion/notion.db');
  }
}

/**
 * Get Claude Desktop Chat config path for the current platform
 */
export function getClaudeDesktopConfigPath(p: Platform = getPlatform()): string {
  const home = homedir();

  switch (p) {
    case 'darwin':
      return join(home, 'Library/Application Support/Claude/claude_desktop_config.json');
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData/Roaming'), 'Claude/claude_desktop_config.json');
    case 'linux':
      return join(home, '.config/Claude/claude_desktop_config.json');
  }
}

/**
 * Get Claude Code config path (same for all platforms)
 */
export function getClaudeCodeConfigPath(): string {
  return join(homedir(), '.claude.json');
}

/**
 * Get the directory where this package is installed
 */
export function getPackageDir(): string {
  // When running via npx, __dirname will be in node_modules/.../dist
  // We need to find the actual package root
  const distDir = new URL('.', import.meta.url).pathname;
  // Remove trailing slash and go up one level from dist
  return join(distDir.replace(/\/$/, ''), '..');
}

/**
 * Get the path to the main MCP server script
 */
export function getMainScriptPath(): string {
  return join(getPackageDir(), 'dist', 'index.js');
}

/**
 * Platform display names
 */
export const PLATFORM_NAMES: Record<Platform, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};
