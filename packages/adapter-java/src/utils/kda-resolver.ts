/**
 * Resolve the vendored kotlin-debug-adapter executable path.
 *
 * kotlin-debug-adapter ships as a Gradle application with bin/ scripts
 * and lib/ JARs. The launch script is at bin/kotlin-debug-adapter.
 */
import { existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the kotlin-debug-adapter launch script path.
 * Searches in vendor directory locations relative to this module.
 *
 * @returns Absolute path to the KDA launch script, or null if not found
 */
export function resolveKDAExecutable(): string | null {
  const isWindows = process.platform === 'win32';
  const scriptName = isWindows ? 'kotlin-debug-adapter.bat' : 'kotlin-debug-adapter';

  const candidatePaths = [
    // When running from TypeScript source (ts-node, vitest)
    path.resolve(__dirname, '..', '..', 'vendor', 'kotlin-debug-adapter', 'bin', scriptName),
    // When running from compiled dist/
    path.resolve(__dirname, '..', 'vendor', 'kotlin-debug-adapter', 'bin', scriptName),
    // From compiled workspace distribution (dist/packages/adapter-java/src)
    path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'adapter-java', 'vendor', 'kotlin-debug-adapter', 'bin', scriptName),
    // Fallback: workspace-relative from CWD
    path.resolve(process.cwd(), 'packages', 'adapter-java', 'vendor', 'kotlin-debug-adapter', 'bin', scriptName),
  ];

  // Check environment variable override
  if (process.env.KDA_PATH) {
    if (existsSync(process.env.KDA_PATH)) {
      return process.env.KDA_PATH;
    }
  }

  for (const candidate of candidatePaths) {
    try {
      if (existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Try next
    }
  }

  return null;
}

/**
 * Get the vendored KDA lib directory for classpath resolution.
 */
export function resolveKDALibDir(): string | null {
  const candidatePaths = [
    path.resolve(__dirname, '..', '..', 'vendor', 'kotlin-debug-adapter', 'lib'),
    path.resolve(__dirname, '..', 'vendor', 'kotlin-debug-adapter', 'lib'),
    path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'adapter-java', 'vendor', 'kotlin-debug-adapter', 'lib'),
    path.resolve(process.cwd(), 'packages', 'adapter-java', 'vendor', 'kotlin-debug-adapter', 'lib'),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Try next
    }
  }

  return null;
}
