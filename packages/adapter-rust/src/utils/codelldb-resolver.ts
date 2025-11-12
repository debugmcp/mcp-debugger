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
  const codelldbPath = path.resolve(
    __dirname,
    '..',
    '..',
    'vendor',
    'codelldb',
    platformDir,
    'adapter',
    executableName
  );
  
  // Check if file exists
  try {
    await fs.access(codelldbPath, fs.constants.F_OK);
    return codelldbPath;
  } catch {
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
  
  const versionFile = path.resolve(
    __dirname,
    '..',
    '..',
    'vendor',
    'codelldb',
    platformDir,
    'version.json'
  );
  
  try {
    const versionData = await fs.readFile(versionFile, 'utf-8');
    const parsed = JSON.parse(versionData);
    return parsed.version || '1.11.0';
  } catch {
    return '1.11.0'; // Default version
  }
}
