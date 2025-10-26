import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const FALLBACK_VERSION = '0.0.0';

function getModuleDirectory(): string {
  try {
    if (typeof __dirname === 'string') {
      return __dirname;
    }
  } catch {
    // __dirname is not defined in ESM – fall through to import.meta
  }

  if (typeof import.meta !== 'undefined' && import.meta.url) {
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  }

  return process.cwd();
}

export function getVersion(): string {
  const moduleDir = getModuleDirectory();
  const candidatePaths = [
    path.resolve(moduleDir, '../../package.json'),
    path.resolve(moduleDir, '../package.json'),
    path.resolve(process.cwd(), 'package.json')
  ];

  for (const candidate of candidatePaths) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (packageJson && typeof packageJson.version === 'string' && packageJson.version.trim().length > 0) {
        return packageJson.version;
      }
    } catch (error) {
      // Only emit diagnostics when not running in stdio mode
      if (process.env.DEBUG_MCP_STDIO !== '1') {
        console.error('Failed to read version from package.json:', error);
      }
    }
  }

  return FALLBACK_VERSION;
}
