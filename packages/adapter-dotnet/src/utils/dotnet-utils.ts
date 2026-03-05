/**
 * .NET debugger executable detection and PDB conversion utilities.
 *
 * ## Debugger Backend: netcoredbg
 *
 * This adapter uses netcoredbg (Samsung, open-source, MIT license).
 * Our modified fork extends netcoredbg with .NET Framework 4.8 Desktop CLR
 * support via ICorDebug COM interfaces.
 *
 * netcoredbg natively supports DAP over TCP via --server=PORT --interpreter=vscode.
 * No bridge process is needed.
 *
 * ## PDB Conversion (convertPdbsToTemp)
 *
 * netcoredbg's ManagedPart.dll only reads **Portable PDB** format.
 * .NET Framework compilers produce **Windows PDB** format by default.
 *
 * **Pdb2Pdb.exe** (from Microsoft's `Microsoft.DiaSymReader.Converter` NuGet)
 * converts Windows PDBs to Portable PDBs. We bundle it in
 * `packages/adapter-dotnet/tools/pdb2pdb/`.
 *
 * The conversion uses a **copy-to-temp** strategy because the target process
 * may hold a file lock on the original PDB.
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'node:fs';
import os from 'node:os';
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
 * Find the netcoredbg executable.
 *
 * Priority:
 * 1. NETCOREDBG_PATH environment variable
 * 2. User-specified preferred path
 * 3. Search PATH using 'which'
 * 4. Common installation locations
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
    logger.debug?.(`[Dotnet Detection] NETCOREDBG_PATH set but not found: ${envPath}`);
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

  // 4. Common installation locations
  const candidates = getNetcoredbgSearchPaths();
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      logger.debug?.(`[Dotnet Detection] Found netcoredbg at: ${candidate}`);
      return candidate;
    }
  }

  throw new CommandNotFoundError(
    'netcoredbg not found. Set NETCOREDBG_PATH environment variable or add netcoredbg to PATH.'
  );
}

/**
 * Get platform-specific common locations for netcoredbg.
 */
function getNetcoredbgSearchPaths(): string[] {
  const paths: string[] = [];
  const home = process.env.HOME || process.env.USERPROFILE || '';

  if (process.platform === 'win32') {
    paths.push(
      path.join(home, 'documents', 'github', 'netcoredbg', 'bin', 'netcoredbg.exe'),
      'C:\\netcoredbg\\netcoredbg.exe',
      path.join(home, 'netcoredbg', 'netcoredbg.exe'),
      'C:\\Program Files\\netcoredbg\\netcoredbg.exe'
    );
  } else {
    paths.push(
      '/usr/local/bin/netcoredbg',
      '/usr/bin/netcoredbg',
      '/opt/netcoredbg/netcoredbg',
      path.join(home, 'netcoredbg', 'netcoredbg')
    );
  }

  return paths;
}

/**
 * Auto-detect the best available .NET debug backend.
 * Prefers netcoredbg (supports both .NET Core and .NET Framework with our fork).
 *
 * @param logger Optional logger
 * @returns Backend type and path
 */
export async function findDotnetBackend(
  logger: Logger = noopLogger
): Promise<{ backend: 'netcoredbg'; path: string }> {
  const netcoredbgPath = await findNetcoredbgExecutable(undefined, logger);
  return { backend: 'netcoredbg', path: netcoredbgPath };
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

/**
 * Convert Windows PDB files to Portable PDB format using a copy-to-temp strategy.
 *
 * Copies DLL+PDB pairs to a temp directory and runs Pdb2Pdb.exe on the copies,
 * leaving the originals untouched (important when the debuggee has them locked).
 *
 * @param sourceDirs Directories to scan for .pdb files
 * @param pdb2pdbPath Path to Pdb2Pdb.exe
 * @returns Temp directory containing converted PDBs, or null if no conversions were made
 */
export function convertPdbsToTemp(sourceDirs: string[], pdb2pdbPath: string): string | null {
  const tempDir = path.join(os.tmpdir(), `mcp-debugger-pdbs-${Date.now()}`);
  let converted = 0;

  for (const dir of sourceDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }

    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }

    const pdbFiles = entries.filter(e => e.toLowerCase().endsWith('.pdb'));

    for (const pdbFile of pdbFiles) {
      const pdbPath = path.join(dir, pdbFile);

      // Skip if already portable
      if (isPortablePdb(pdbPath)) {
        continue;
      }

      // Find matching DLL
      const baseName = pdbFile.replace(/\.pdb$/i, '');
      const dllFile = baseName + '.dll';
      const dllPath = path.join(dir, dllFile);
      if (!fs.existsSync(dllPath)) {
        continue;
      }

      // Ensure temp dir exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Copy both DLL and PDB to temp
      try {
        fs.copyFileSync(dllPath, path.join(tempDir, dllFile));
        fs.copyFileSync(pdbPath, path.join(tempDir, pdbFile));
      } catch {
        continue;
      }

      // Convert: Pdb2Pdb.exe <dll> -- auto-finds the adjacent PDB
      const result = spawnSync(pdb2pdbPath, [path.join(tempDir, dllFile)], {
        timeout: 30000,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Pdb2Pdb outputs to <name>.pdb2, rename to .pdb
      const pdb2Path = path.join(tempDir, baseName + '.pdb2');
      if (fs.existsSync(pdb2Path)) {
        try {
          fs.renameSync(pdb2Path, path.join(tempDir, pdbFile));
          converted++;
        } catch {
          // rename failed
        }
      } else if (result.status === 0) {
        // Some versions overwrite in-place
        converted++;
      }
    }
  }

  return converted > 0 ? tempDir : null;
}
