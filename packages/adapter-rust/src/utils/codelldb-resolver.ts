/**
 * CodeLLDB executable resolver
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the CodeLLDB executable path based on platform
 */
export async function resolveCodeLLDBExecutable(): Promise<string | null> {
  const platform = process.platform;
  const arch = process.arch;
  
  // Determine platform directory
  let platformDir = '';
  if (platform === 'win32') {
    platformDir = 'win32-x64';
  } else if (platform === 'darwin') {
    platformDir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (platform === 'linux') {
    platformDir = arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  } else {
    return null;
  }
  
  // Build path to vendored CodeLLDB
  const executableName = platform === 'win32' ? 'codelldb.exe' : 'codelldb';
  const candidatePaths = [
    // Package root (production install)
    path.resolve(__dirname, '..', '..', 'vendor', 'codelldb', platformDir, 'adapter', executableName),
    // Backward compatibility for older builds that expected vendor under dist/
    path.resolve(__dirname, '..', 'vendor', 'codelldb', platformDir, 'adapter', executableName),
    // Monorepo source tree fallbacks
    path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'adapter-rust', 'vendor', 'codelldb', platformDir, 'adapter', executableName),
    path.resolve(process.cwd(), 'packages', 'adapter-rust', 'vendor', 'codelldb', platformDir, 'adapter', executableName)
  ];
  
  for (const candidate of candidatePaths) {
    try {
      await fs.access(candidate, fs.constants.F_OK);
      return candidate;
    } catch {
      // Try next candidate
    }
  }
  
  // Check environment variable as fallback
  if (process.env.CODELLDB_PATH) {
    try {
      await fs.access(process.env.CODELLDB_PATH, fs.constants.F_OK);
      return process.env.CODELLDB_PATH;
    } catch {
      // Fall through
    }
  }
  
  return null;
}

/**
 * Check if CodeLLDB is installed and get version
 */
export async function getCodeLLDBVersion(): Promise<string | null> {
  const codelldbPath = await resolveCodeLLDBExecutable();
  
  if (!codelldbPath) {
    return null;
  }
  
  // Try to get version from manifest file
  // NOTE: Platform detection is intentionally duplicated from resolveCodeLLDBExecutable()
  // because the two functions may be called independently, and extracting a shared helper
  // would add coupling without meaningful benefit for this small mapping.
  const platform = process.platform;
  const arch = process.arch;

  let platformDir = '';
  if (platform === 'win32') {
    platformDir = 'win32-x64';
  } else if (platform === 'darwin') {
    platformDir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (platform === 'linux') {
    platformDir = arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  }
  
  const versionFileCandidates = [
    path.resolve(__dirname, '..', '..', 'vendor', 'codelldb', platformDir, 'version.json'),
    path.resolve(__dirname, '..', 'vendor', 'codelldb', platformDir, 'version.json'),
    path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'adapter-rust', 'vendor', 'codelldb', platformDir, 'version.json'),
    path.resolve(process.cwd(), 'packages', 'adapter-rust', 'vendor', 'codelldb', platformDir, 'version.json')
  ];
  
  for (const versionFile of versionFileCandidates) {
    try {
      const versionData = await fs.readFile(versionFile, 'utf-8');
      const parsed = JSON.parse(versionData);
      return parsed.version || '1.11.0';
    } catch {
      // Continue to next candidate
    }
  }
  
  return '1.11.0'; // Default version fallback
}
