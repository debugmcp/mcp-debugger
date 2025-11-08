import fs from 'node:fs';
import path from 'node:path';

/**
 * Ensure the spawned MCP server inherits a PATH that includes a valid Python installation.
 * This guards against environments (notably Windows CI) where Python is installed but not on PATH.
 */
export function ensurePythonOnPath(env: Record<string, string>): void {
  if (process.platform !== 'win32') {
    return;
  }

  const pathDelimiter = ';';
  const currentPath = env.PATH ?? env.Path ?? '';
  const segments = currentPath ? currentPath.split(pathDelimiter).filter(Boolean) : [];
  const normalized = new Set(segments.map((segment) => segment.toLowerCase()));

  const candidateRoots = new Set<string>();
  const envPythonLocation =
    env.pythonLocation ??
    env.PythonLocation ??
    process.env.pythonLocation ??
    process.env.PythonLocation;

  if (envPythonLocation) {
    candidateRoots.add(envPythonLocation);
  }

  const hostedToolCacheRoot = 'C:\\hostedtoolcache\\windows\\Python';
  try {
    if (fs.existsSync(hostedToolCacheRoot)) {
      for (const entry of fs.readdirSync(hostedToolCacheRoot, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          candidateRoots.add(path.join(hostedToolCacheRoot, entry.name, 'x64'));
        }
      }
    }
  } catch {
    // Ignore discovery errors – absence simply means we fall back to existing PATH entries.
  }

  let updated = false;
  for (const root of candidateRoots) {
    if (!root) {
      continue;
    }

    const pythonExe = path.join(root, 'python.exe');
    if (!fs.existsSync(pythonExe)) {
      continue;
    }

    const dirsToAdd = [root, path.join(root, 'Scripts')];
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
  }

  if (updated) {
    const newPath = segments.join(pathDelimiter);
    env.PATH = newPath;
    env.Path = newPath;
  }
}
