import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Check if a Python installation has debugpy installed.
 */
function hasDebugpy(pythonExe: string): boolean {
  try {
    const result = spawnSync(pythonExe, ['-m', 'debugpy', '--version'], {
      timeout: 5000,
      stdio: 'pipe',
      windowsHide: true,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function installDebugpy(pythonExe: string): { installed: boolean; log: string } {
  try {
    const result = spawnSync(
      pythonExe,
      ['-m', 'pip', 'install', '--user', '--upgrade', 'debugpy'],
      {
        timeout: 120_000,
        stdio: 'pipe',
        windowsHide: true,
      }
    );
    const log = (result.stdout?.toString() ?? '') + (result.stderr?.toString() ?? '');
    return { installed: result.status === 0, log };
  } catch (error) {
    return {
      installed: false,
      log: `spawn error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Ensure the spawned MCP server inherits a PATH that includes a valid Python installation
 * WITH debugpy installed. This guards against environments (notably Windows CI) where
 * Python is installed but not on PATH, or where newer Python versions lack debugpy.
 */
export function ensurePythonOnPath(env: Record<string, string>): void {
  if (process.platform !== 'win32') {
    return;
  }

  const pathDelimiter = ';';
  const currentPath = env.PATH ?? env.Path ?? '';
  const segments = currentPath ? currentPath.split(pathDelimiter).filter(Boolean) : [];
  const normalized = new Set(segments.map((segment) => segment.toLowerCase()));

  // Collect all candidate Python installations
  const candidateRoots: string[] = [];
  
  // Priority 1: PYTHONLOCATION (usually set by setup-python action with debugpy)
  const envPythonLocation =
    env.pythonLocation ??
    env.PythonLocation ??
    process.env.pythonLocation ??
    process.env.PythonLocation;

  if (envPythonLocation) {
    candidateRoots.push(envPythonLocation);
  }

  // Priority 2: All Python versions in hostedtoolcache (sorted by version, oldest first)
  const hostedToolCacheRoot = 'C:\\hostedtoolcache\\windows\\Python';
  try {
    if (fs.existsSync(hostedToolCacheRoot)) {
      const versions = fs.readdirSync(hostedToolCacheRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => ({
          name: entry.name,
          path: path.join(hostedToolCacheRoot, entry.name, 'x64')
        }))
        // Sort by version number (oldest first for stability)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      
      for (const version of versions) {
        candidateRoots.push(version.path);
      }
    }
  } catch {
    // Ignore discovery errors – absence simply means we fall back to existing PATH entries.
  }

  // Find the first Python with debugpy installed
  let selectedRoot: string | null = null;
  const diagnostics: string[] = [];

  for (const root of candidateRoots) {
    if (!root) {
      continue;
    }

    const pythonExe = path.join(root, 'python.exe');
    if (!fs.existsSync(pythonExe)) {
      diagnostics.push(`${root}: python.exe not found`);
      continue;
    }

    // Check for debugpy
    const hasDebugpyInstalled = hasDebugpy(pythonExe);
    diagnostics.push(`${root}: python.exe found, debugpy: ${hasDebugpyInstalled ? 'YES' : 'NO'}`);

    if (hasDebugpyInstalled) {
      selectedRoot = root;
      break;
    }
  }

  // If no Python with debugpy found, log diagnostics and use first available Python
  if (!selectedRoot && candidateRoots.length > 0) {
    console.warn('[env-utils] No Python with debugpy found. Diagnostics:');
    diagnostics.forEach(d => console.warn(`  ${d}`));
    console.warn('[env-utils] Attempting to install debugpy for first available Python');

    for (const root of candidateRoots) {
      const pythonExe = path.join(root, 'python.exe');
      if (!fs.existsSync(pythonExe)) {
        continue;
      }

      const installResult = installDebugpy(pythonExe);
      if (!installResult.installed) {
        diagnostics.push(`${root}: debugpy install failed -> ${installResult.log.trim()}`);
        continue;
      }

      diagnostics.push(`${root}: debugpy installed via pip`);
      if (hasDebugpy(pythonExe)) {
        selectedRoot = root;
        break;
      }
    }

    if (!selectedRoot) {
      console.warn('[env-utils] debugpy installation attempts failed. Falling back to first Python found (tests may fail)');
      for (const root of candidateRoots) {
        const pythonExe = path.join(root, 'python.exe');
        if (fs.existsSync(pythonExe)) {
          selectedRoot = root;
          break;
        }
      }
    }
  }

  // Add the selected Python to PATH
  let updated = false;
  if (selectedRoot) {
    const dirsToAdd = [selectedRoot, path.join(selectedRoot, 'Scripts')];
    for (const dir of dirsToAdd) {
      if (!fs.existsSync(dir)) {
        continue;
      }

      const normalizedDir = dir.toLowerCase();
      if (!normalized.has(normalizedDir)) {
        segments.unshift(dir);
        normalized.add(normalizedDir);
        updated = true;
      }
    }

    if (updated) {
      console.log(`[env-utils] Added Python with debugpy to PATH: ${selectedRoot}`);
    }
  }

  if (updated) {
    const newPath = segments.join(pathDelimiter);
    env.PATH = newPath;
    env.Path = newPath;
  }
}
