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

  try {
    // Try to get the owner of the coverage directory
    const stats = statSync(COVERAGE_DIR);
    const isRoot = stats.uid === 0;

    if (isRoot) {
      console.log('[Clean Coverage] Coverage directory is owned by root, using sudo to remove...');
      try {
        execSync(`sudo rm -rf "${COVERAGE_DIR}"`, { stdio: 'inherit' });
        console.log('[Clean Coverage] Successfully removed root-owned coverage directory');
      } catch (error) {
        console.error('[Clean Coverage] Failed to remove root-owned coverage directory');
        console.error('[Clean Coverage] You may need to run: sudo rm -rf coverage');
        process.exit(1);
      }
    } else {
      console.log('[Clean Coverage] Removing coverage directory...');
      await rm(COVERAGE_DIR, { recursive: true, force: true });
      console.log('[Clean Coverage] Successfully removed coverage directory');
    }
  } catch (error) {
    console.error('[Clean Coverage] Error cleaning coverage directory:', error.message);
    process.exit(1);
  }
}

cleanCoverage().catch((error) => {
  console.error('[Clean Coverage] Unexpected error:', error);
  process.exit(1);
});
