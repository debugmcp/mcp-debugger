/**
 * .NET debugger executable detection utilities.
 *
 * Supports two backends:
 * - vsdbg (Microsoft, ships with VS Code C# extension) — required for .NET Framework 4.8
 * - netcoredbg (Samsung, open-source) — alternative for .NET Core/.NET 5+
 */
import { spawn } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import which from 'which';

interface Logger {
  error: (message: string) => void;
  debug?: (message: string) => void;
}

const noopLogger: Logger = {
  error: () => {},
  debug: () => {}
};

export class CommandNotFoundError extends Error {
  command: string;
  constructor(command: string) {
    super(command);
    this.name = 'CommandNotFoundError';
    this.command = command;
  }
}

/**
 * Find the vsdbg executable.
 *
 * Priority:
 * 1. VSDBG_PATH environment variable
 * 2. User-specified preferred path
 * 3. Glob VS Code extensions directory for the C# extension's bundled vsdbg
 *
 * @param preferredPath Optional user-specified path
 * @param logger Optional logger for diagnostics
 * @returns Absolute path to vsdbg executable
 */
export async function findVsdbgExecutable(
  preferredPath?: string,
  logger: Logger = noopLogger
): Promise<string> {
  logger.debug?.('[Dotnet Detection] Starting vsdbg discovery...');

  // 1. Environment variable
  if (process.env.VSDBG_PATH) {
    const envPath = process.env.VSDBG_PATH;
    if (fs.existsSync(envPath)) {
      logger.debug?.(`[Dotnet Detection] Using VSDBG_PATH: ${envPath}`);
      return envPath;
    }
    logger.debug?.(`[Dotnet Detection] VSDBG_PATH set but not found: ${envPath}`);
  }

  // 2. User-specified path
  if (preferredPath) {
    if (fs.existsSync(preferredPath)) {
      logger.debug?.(`[Dotnet Detection] Using preferred path: ${preferredPath}`);
      return preferredPath;
    }
    logger.debug?.(`[Dotnet Detection] Preferred path not found: ${preferredPath}`);
  }

  // 3. Scan VS Code extensions directory
  const vsdbgPath = await findVsdbgInVscodeExtensions(logger);
  if (vsdbgPath) {
    return vsdbgPath;
  }

  throw new CommandNotFoundError(
    'vsdbg not found. Install the C# extension in VS Code, or set VSDBG_PATH environment variable.'
  );
}

/**
 * Scan VS Code extension directories for the C# extension's bundled vsdbg.
 */
async function findVsdbgInVscodeExtensions(logger: Logger): Promise<string | null> {
  const extensionsDirs = getVscodeExtensionsDirs();

  for (const extDir of extensionsDirs) {
    if (!fs.existsSync(extDir)) {
      continue;
    }

    logger.debug?.(`[Dotnet Detection] Scanning VS Code extensions: ${extDir}`);

    let entries: string[];
    try {
      entries = fs.readdirSync(extDir);
    } catch {
      continue;
    }

    // Find C# extension directories (ms-dotnettools.csharp-*)
    const csharpExtensions = entries
      .filter(e => e.startsWith('ms-dotnettools.csharp-'))
      .sort()
      .reverse(); // Latest version first

    for (const ext of csharpExtensions) {
      // Try both x86_64 and the root debugger paths
      const candidates = [
        path.join(extDir, ext, '.debugger', 'x86_64', 'vsdbg.exe'),
        path.join(extDir, ext, '.debugger', 'vsdbg.exe'),
        path.join(extDir, ext, '.debugger', 'x86_64', 'vsdbg'),
        path.join(extDir, ext, '.debugger', 'vsdbg'),
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          logger.debug?.(`[Dotnet Detection] Found vsdbg: ${candidate}`);
          return candidate;
        }
      }
    }
  }

  return null;
}

/**
 * Get platform-specific VS Code extensions directories.
 */
function getVscodeExtensionsDirs(): string[] {
  const dirs: string[] = [];
  const home = process.env.HOME || process.env.USERPROFILE || '';

  if (process.platform === 'win32') {
    // Standard VS Code
    dirs.push(path.join(home, '.vscode', 'extensions'));
    // VS Code Insiders
    dirs.push(path.join(home, '.vscode-insiders', 'extensions'));
  } else if (process.platform === 'darwin') {
    dirs.push(path.join(home, '.vscode', 'extensions'));
    dirs.push(path.join(home, '.vscode-insiders', 'extensions'));
  } else {
    dirs.push(path.join(home, '.vscode', 'extensions'));
    dirs.push(path.join(home, '.vscode-insiders', 'extensions'));
    // Also check flatpak VS Code
    dirs.push(path.join(home, '.var', 'app', 'com.visualstudio.code', 'data', 'vscode', 'extensions'));
  }

  return dirs;
}

/**
 * Find the netcoredbg executable (Samsung open-source .NET debugger).
 *
 * Priority:
 * 1. NETCOREDBG_PATH environment variable
 * 2. User-specified preferred path
 * 3. Search PATH using 'which'
 *
 * @param preferredPath Optional user-specified path
 * @param logger Optional logger for diagnostics
 * @returns Absolute path to netcoredbg executable
 */
export async function findNetcoredbgExecutable(
  preferredPath?: string,
  logger: Logger = noopLogger
): Promise<string> {
  logger.debug?.('[Dotnet Detection] Starting netcoredbg discovery...');

  // 1. Environment variable
  if (process.env.NETCOREDBG_PATH) {
    const envPath = process.env.NETCOREDBG_PATH;
    if (fs.existsSync(envPath)) {
      logger.debug?.(`[Dotnet Detection] Using NETCOREDBG_PATH: ${envPath}`);
      return envPath;
    }
  }

  // 2. User-specified path
  if (preferredPath && fs.existsSync(preferredPath)) {
    logger.debug?.(`[Dotnet Detection] Using preferred path: ${preferredPath}`);
    return preferredPath;
  }

  // 3. Search PATH
  try {
    const resolved = await which('netcoredbg');
    logger.debug?.(`[Dotnet Detection] Found netcoredbg in PATH: ${resolved}`);
    return resolved;
  } catch {
    // Not found in PATH
  }

  throw new CommandNotFoundError(
    'netcoredbg not found. Install from https://github.com/Samsung/netcoredbg or set NETCOREDBG_PATH.'
  );
}

/**
 * Auto-detect the best available .NET debug backend.
 *
 * @param logger Optional logger
 * @returns Backend type and path
 */
export async function findDotnetBackend(
  logger: Logger = noopLogger
): Promise<{ backend: 'vsdbg' | 'netcoredbg'; path: string }> {
  const backendEnv = process.env.DOTNET_DBG_BACKEND?.toLowerCase() || 'auto';

  if (backendEnv === 'vsdbg') {
    const vsdbgPath = await findVsdbgExecutable(undefined, logger);
    return { backend: 'vsdbg', path: vsdbgPath };
  }

  if (backendEnv === 'netcoredbg') {
    const netcoredbgPath = await findNetcoredbgExecutable(undefined, logger);
    return { backend: 'netcoredbg', path: netcoredbgPath };
  }

  // Auto: try vsdbg first (required for .NET Framework), fall back to netcoredbg
  try {
    const vsdbgPath = await findVsdbgExecutable(undefined, logger);
    return { backend: 'vsdbg', path: vsdbgPath };
  } catch {
    logger.debug?.('[Dotnet Detection] vsdbg not found, trying netcoredbg...');
  }

  try {
    const netcoredbgPath = await findNetcoredbgExecutable(undefined, logger);
    return { backend: 'netcoredbg', path: netcoredbgPath };
  } catch {
    // Neither found
  }

  throw new CommandNotFoundError(
    '.NET debugger not found. Install the C# extension in VS Code (for vsdbg) or netcoredbg.'
  );
}

/**
 * List running .NET processes on the system.
 * Currently Windows-only using tasklist.
 *
 * @returns Array of process info objects
 */
export async function listDotnetProcesses(
  logger: Logger = noopLogger
): Promise<Array<{ name: string; pid: number }>> {
  if (process.platform !== 'win32') {
    logger.debug?.('[Dotnet Detection] Process listing is currently Windows-only');
    return [];
  }

  return new Promise((resolve) => {
    const child = spawn('tasklist', ['/FO', 'CSV', '/NH'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve([]));
    child.on('exit', (code) => {
      if (code !== 0) {
        resolve([]);
        return;
      }

      const processes: Array<{ name: string; pid: number }> = [];
      const knownDotnetProcesses = [
        'ninjatrader.exe',
        'devenv.exe',
        'dotnet.exe',
        'w3wp.exe',
        'iisexpress.exe',
      ];

      const lines = output.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // CSV format: "ImageName","PID","SessionName","Session#","MemUsage"
        const match = trimmed.match(/^"([^"]+)","(\d+)"/);
        if (!match) continue;

        const name = match[1].toLowerCase();
        const pid = parseInt(match[2], 10);

        if (knownDotnetProcesses.includes(name)) {
          processes.push({ name: match[1], pid });
        }
      }

      logger.debug?.(`[Dotnet Detection] Found ${processes.length} .NET processes`);
      resolve(processes);
    });
  });
}

/**
 * Find the vsda.node native module (VS Code's handshake signer).
 *
 * vsdbg sends a cryptographic handshake challenge that must be signed
 * with the vsda signer bundled inside the VS Code installation.
 *
 * @param logger Optional logger for diagnostics
 * @returns Absolute path to vsda.node, or null if not found
 */
export function findVsdaNode(logger: Logger = noopLogger): string | null {
  // 1. Environment variable
  if (process.env.VSDA_PATH) {
    const envPath = process.env.VSDA_PATH;
    if (fs.existsSync(envPath)) {
      logger.debug?.(`[Dotnet Detection] Using VSDA_PATH: ${envPath}`);
      return envPath;
    }
    logger.debug?.(`[Dotnet Detection] VSDA_PATH set but not found: ${envPath}`);
  }

  // 2. Scan VS Code installation directories
  const codePaths: string[] = [];
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    if (localAppData) {
      codePaths.push(path.join(localAppData, 'Programs', 'Microsoft VS Code'));
    }
    codePaths.push('C:\\Program Files\\Microsoft VS Code');
  } else if (process.platform === 'darwin') {
    codePaths.push('/Applications/Visual Studio Code.app/Contents');
  } else {
    codePaths.push('/usr/share/code');
    codePaths.push('/usr/lib/code');
  }

  for (const codeDir of codePaths) {
    if (!fs.existsSync(codeDir)) continue;

    let entries: string[];
    try {
      entries = fs.readdirSync(codeDir).filter(e => !e.startsWith('.'));
    } catch {
      continue;
    }

    for (const entry of entries) {
      const candidate = path.join(codeDir, entry, 'resources', 'app',
        'node_modules.asar.unpacked', 'vsda', 'build', 'Release', 'vsda.node');
      if (fs.existsSync(candidate)) {
        logger.debug?.(`[Dotnet Detection] Found vsda.node: ${candidate}`);
        return candidate;
      }
    }
  }

  logger.debug?.('[Dotnet Detection] vsda.node not found');
  return null;
}

/**
 * Check whether a PDB file is in Portable PDB format.
 *
 * Portable PDBs start with the magic bytes "BSJB" (0x42 0x53 0x4A 0x42).
 * Windows-format PDBs have a different signature ("Microsoft C/C++ MSF 7.00").
 *
 * @param pdbPath Absolute path to the PDB file
 * @returns true if the file is a Portable PDB, false if Windows-format or on error
 */
export function isPortablePdb(pdbPath: string): boolean {
  try {
    const fd = fs.openSync(pdbPath, 'r');
    try {
      const buf = Buffer.alloc(4);
      const bytesRead = fs.readSync(fd, buf, 0, 4, 0);
      if (bytesRead < 4) return false;
      // Portable PDB magic: "BSJB" = 0x42 0x53 0x4A 0x42
      return buf[0] === 0x42 && buf[1] === 0x53 && buf[2] === 0x4A && buf[3] === 0x42;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

/**
 * Find the Pdb2Pdb.exe converter tool.
 *
 * Priority:
 * 1. PDB2PDB_PATH environment variable
 * 2. Bundled with this package at tools/pdb2pdb/Pdb2Pdb.exe
 * 3. Fallback at /tmp/pdb2pdb-tool/Pdb2Pdb.exe
 *
 * @returns Absolute path to Pdb2Pdb.exe, or null if not found
 */
export function findPdb2PdbExecutable(): string | null {
  // 1. Environment variable
  if (process.env.PDB2PDB_PATH) {
    if (fs.existsSync(process.env.PDB2PDB_PATH)) {
      return process.env.PDB2PDB_PATH;
    }
  }

  // 2. Bundled with this package
  const thisFile = fileURLToPath(import.meta.url);
  const bundled = path.resolve(path.dirname(thisFile), '..', '..', 'tools', 'pdb2pdb', 'Pdb2Pdb.exe');
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  // 3. Fallback temp location
  const fallback = '/tmp/pdb2pdb-tool/Pdb2Pdb.exe';
  if (fs.existsSync(fallback)) {
    return fallback;
  }

  return null;
}
