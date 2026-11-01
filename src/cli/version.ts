import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const FALLBACK_VERSION = '0.0.0';

/**
 * The release version esbuild bakes into the server bundle (`scripts/bundle.js`,
 * `define`). The Docker image runs `dist/bundle.cjs` from `/app/dist` with no
 * `package.json` beside it, so the file walk below found nothing there and the
 * banner, `--version` and `serverInfo` all said `0.0.0` (issue #1054). Unbundled —
 * `dist/index.js`, the npm CLI, vitest — the identifier is simply undefined and the
 * walk is the answer. A global rather than an environment variable, so nothing on
 * the host can spoof the version.
 */
declare const __MCP_DEBUGGER_VERSION__: string | undefined;

function bakedVersion(): string | null {
  const baked = typeof __MCP_DEBUGGER_VERSION__ === 'string' ? __MCP_DEBUGGER_VERSION__.trim() : '';
  return baked.length > 0 ? baked : null;
}

function getModuleDirectory(): string {
  if (typeof __dirname === 'string') {
    return __dirname;
  }

  if (typeof import.meta !== 'undefined' && import.meta.url) {
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  }

  return process.cwd();
}

export function getVersion(): string {
  const baked = bakedVersion();
  if (baked) return baked;

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
      if (process.env.CONSOLE_OUTPUT_SILENCED !== '1') {
        console.error('Failed to read version from package.json:', error);
      }
    }
  }

  return FALLBACK_VERSION;
}
