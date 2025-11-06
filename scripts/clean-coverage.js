#!/usr/bin/env node

/**
 * Clean Coverage Directory
 *
 * Safely removes the coverage directory, handling both user-owned and root-owned files.
 * This script handles permission issues that arise when Docker containers create files
 * with root ownership.
 */

import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const COVERAGE_DIR = path.join(ROOT, 'coverage');

async function cleanCoverage() {
  if (!existsSync(COVERAGE_DIR)) {
    console.log('[Clean Coverage] Coverage directory does not exist, nothing to clean');
    return;
  }

  const removeWithNode = async () => {
    console.log('[Clean Coverage] Removing coverage directory...');
    await rm(COVERAGE_DIR, { recursive: true, force: true });
    console.log('[Clean Coverage] Successfully removed coverage directory');
  };

  try {
    await removeWithNode();
    return;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    // If removal failed due to permissions, try escalation strategies when available.
    const stats = statSync(COVERAGE_DIR);
    const isRootOwned = typeof stats.uid === 'number' && stats.uid === 0;

    if (!isRootOwned) {
      console.error('[Clean Coverage] Error cleaning coverage directory:', error.message);
      console.error('[Clean Coverage] You may need to remove the "coverage" directory manually.');
      process.exit(1);
    }

    if (process.platform === 'win32') {
      const dockerMountPath = ROOT.replace(/\\/g, '/');
      console.log('[Clean Coverage] Attempting to remove via Docker helper container...');
      const dockerCommand = `docker run --rm -v "${dockerMountPath}:/workspace" --entrypoint sh alpine:3.19 -c "chmod -R +w /workspace/coverage 2>/dev/null || true && rm -rf /workspace/coverage"`;
      try {
        execSync(dockerCommand, { stdio: 'inherit' });
        console.log('[Clean Coverage] Successfully removed coverage directory via Docker');
        return;
      } catch (dockerError) {
        console.error('[Clean Coverage] Docker helper removal failed:', dockerError instanceof Error ? dockerError.message : dockerError);
        console.error('[Clean Coverage] You may need to remove the "coverage" directory manually (e.g., via WSL or Docker).');
        process.exit(1);
      }
    }

    console.log('[Clean Coverage] Coverage directory owned by root, attempting sudo removal...');
    try {
      execSync(`sudo rm -rf "${COVERAGE_DIR}"`, { stdio: 'inherit' });
      console.log('[Clean Coverage] Successfully removed root-owned coverage directory');
    } catch (sudoError) {
      console.error('[Clean Coverage] Failed to remove root-owned coverage directory with sudo.');
      console.error('[Clean Coverage] You may need to run: sudo rm -rf coverage');
      process.exit(1);
    }
  }
}

cleanCoverage().catch((error) => {
  console.error('[Clean Coverage] Unexpected error:', error);
  process.exit(1);
});
