import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Platform } from './paths.js';

export interface NodePaths {
  nodePath: string | null;
  npxPath: string | null;
  binDir: string | null;
}

/**
 * Get common Node.js installation paths for the platform
 */
export function getCommonNodePaths(p: Platform): string[] {
  const home = homedir();

  switch (p) {
    case 'darwin':
      return [
        // nvm (most common)
        join(home, '.nvm/versions/node'),
        // Homebrew Apple Silicon
        '/opt/homebrew/bin',
        // Homebrew Intel
        '/usr/local/bin',
        // volta
        join(home, '.volta/bin'),
        // asdf
        join(home, '.asdf/shims'),
        // fnm
        join(home, '.fnm/node-versions'),
        // System
        '/usr/bin',
      ];

    case 'win32': {
      const appData = process.env.APPDATA || join(home, 'AppData/Roaming');
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      return [
        // nvm-windows
        join(appData, 'nvm'),
        // volta
        join(home, '.volta/bin'),
        // Default Node.js installation
        join(programFiles, 'nodejs'),
        // fnm
        join(appData, 'fnm/node-versions'),
      ];
    }

    case 'linux':
      return [
        // nvm
        join(home, '.nvm/versions/node'),
        // volta
        join(home, '.volta/bin'),
        // asdf
        join(home, '.asdf/shims'),
        // fnm
        join(home, '.fnm/node-versions'),
        // System paths
        '/usr/local/bin',
        '/usr/bin',
      ];
  }
}

/**
 * Try to find Node.js using which/where command
 */
function findNodeViaWhich(p: Platform): string | null {
  try {
    const cmd = p === 'win32' ? 'where node' : 'which node';
    const result = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // On Windows, 'where' can return multiple paths
    const firstPath = result.split('\n')[0].trim();
    if (existsSync(firstPath)) {
      return firstPath;
    }
  } catch {
    // Command not found or failed
  }
  return null;
}

/**
 * Find the latest Node.js version in nvm versions directory
 */
function findLatestNvmNode(nvmVersionsPath: string, p: Platform): string | null {
  if (!existsSync(nvmVersionsPath)) {
    return null;
  }

  try {
    const { readdirSync } = require('fs');
    const versions = readdirSync(nvmVersionsPath)
      .filter((v: string) => v.startsWith('v'))
      .sort((a: string, b: string) => {
        // Sort by version number (v20.10.0 > v18.19.0)
        const parseVersion = (v: string) => {
          const match = v.match(/v(\d+)\.(\d+)\.(\d+)/);
          if (match) {
            return parseInt(match[1]) * 10000 + parseInt(match[2]) * 100 + parseInt(match[3]);
          }
          return 0;
        };
        return parseVersion(b) - parseVersion(a);
      });

    if (versions.length > 0) {
      const binDir = p === 'win32' ? '' : 'bin';
      const nodePath = join(nvmVersionsPath, versions[0], binDir, 'node');
      if (existsSync(nodePath)) {
        return nodePath;
      }
    }
  } catch {
    // Failed to read directory
  }
  return null;
}

/**
 * Scan common paths to find Node.js binary
 */
function findNodeViaScan(p: Platform): string | null {
  const commonPaths = getCommonNodePaths(p);
  const nodeExe = p === 'win32' ? 'node.exe' : 'node';

  for (const basePath of commonPaths) {
    // Check if this is an nvm versions directory
    if (basePath.includes('.nvm/versions/node') || basePath.includes('fnm/node-versions')) {
      const found = findLatestNvmNode(basePath, p);
      if (found) {
        return found;
      }
      continue;
    }

    // Check direct path
    const nodePath = join(basePath, nodeExe);
    if (existsSync(nodePath)) {
      return nodePath;
    }
  }

  return null;
}

/**
 * Resolve Node.js and npx paths
 */
export function resolveNodePaths(p: Platform): NodePaths {
  // Try which/where first (respects current shell PATH)
  let nodePath = findNodeViaWhich(p);

  // Fall back to scanning common paths
  if (!nodePath) {
    nodePath = findNodeViaScan(p);
  }

  if (!nodePath) {
    return { nodePath: null, npxPath: null, binDir: null };
  }

  // Derive npx path from node path
  const binDir = join(nodePath, '..');
  const npxExe = p === 'win32' ? 'npx.cmd' : 'npx';
  const npxPath = join(binDir, npxExe);

  return {
    nodePath,
    npxPath: existsSync(npxPath) ? npxPath : null,
    binDir,
  };
}

/**
 * Build extended PATH environment variable with common Node.js locations
 */
export function buildExtendedPath(p: Platform): string {
  const home = homedir();
  const paths: string[] = [];
  const { binDir } = resolveNodePaths(p);

  // Add detected bin directory first
  if (binDir) {
    paths.push(binDir);
  }

  // Add common paths
  switch (p) {
    case 'darwin':
      // nvm current version
      paths.push(join(home, '.nvm/versions/node/*/bin'));
      // Homebrew
      paths.push('/opt/homebrew/bin');
      paths.push('/usr/local/bin');
      // volta
      paths.push(join(home, '.volta/bin'));
      // asdf
      paths.push(join(home, '.asdf/shims'));
      // System
      paths.push('/usr/bin');
      paths.push('/bin');
      break;

    case 'win32': {
      const appData = process.env.APPDATA || join(home, 'AppData/Roaming');
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      paths.push(join(appData, 'nvm'));
      paths.push(join(home, '.volta/bin'));
      paths.push(join(programFiles, 'nodejs'));
      paths.push(join(home, 'AppData/Local/Programs/nodejs'));
      break;
    }

    case 'linux':
      paths.push(join(home, '.nvm/versions/node/*/bin'));
      paths.push(join(home, '.volta/bin'));
      paths.push(join(home, '.asdf/shims'));
      paths.push('/usr/local/bin');
      paths.push('/usr/bin');
      paths.push('/bin');
      break;
  }

  // Filter to only existing paths (except glob patterns)
  const existingPaths = paths.filter((p) => {
    if (p.includes('*')) {
      return true; // Keep glob patterns for shell expansion
    }
    return existsSync(p);
  });

  // Remove glob patterns for final PATH (they won't work)
  const finalPaths = existingPaths.filter((p) => !p.includes('*'));

  // Remove duplicates while preserving order
  const uniquePaths = [...new Set(finalPaths)];

  const separator = p === 'win32' ? ';' : ':';
  return uniquePaths.join(separator);
}

/**
 * Validate that a node path actually works
 */
export function validateNode(nodePath: string): boolean {
  try {
    const result = execSync(`"${nodePath}" --version`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim().startsWith('v');
  } catch {
    return false;
  }
}
