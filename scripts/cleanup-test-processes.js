#!/usr/bin/env node

/**
 * Test Process Cleanup Script
 *
 * Cleans up orphaned processes after test suite execution on Linux/macOS.
 * Skipped on Windows (automatic cleanup) and in CI environments.
 *
 * This addresses a known issue where proxy-bootstrap processes
 * can become orphaned on Unix systems during test execution.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';

// Get the project root (parent of scripts directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('===============================================');
console.log('MCP Debugger Test Process Cleanup');
console.log(`Platform: ${process.platform}`);
console.log(`Project: ${projectRoot}`);
console.log('===============================================');

function executeCommand(cmd, silent = false) {
  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return result;
  } catch (error) {
    if (!silent) {
      console.error(`Command failed: ${cmd}`);
    }
    return null;
  }
}

function getProcessList() {
  // Unix: Use ps to get process info
  const cmd = 'ps aux';
  return executeCommand(cmd, true) || '';
}

function findMcpProcesses() {
  const processList = getProcessList();
  const mcpProcesses = [];

  // Patterns to match MCP-related processes
  // More specific to avoid killing unrelated processes
  // Escape projectRoot for safe use in regex (backslashes, dots, etc.)
  const escapedRoot = projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    `${escapedRoot}.*proxy-bootstrap`,  // Specific to this project
    `${escapedRoot}.*dap-proxy`,
    `vitest.*${escapedRoot}`,           // Vitest running in this project
    `debugpy.*${escapedRoot}`,          // debugpy spawned by this project
  ];

  const lines = processList.split('\n');
  for (const line of lines) {
    for (const pattern of patterns) {
      if (line.match(new RegExp(pattern, 'i'))) {
        // Extract PID from Unix ps format: USER PID %CPU %MEM ...
        let pid;
        const parts = line.trim().split(/\s+/);
        if (parts.length > 1) {
          pid = parts[1];
        }

        if (pid && !isNaN(pid)) {
          mcpProcesses.push({
            pid: parseInt(pid),
            command: line.substring(0, 100) // First 100 chars for logging
          });
        }
        break;
      }
    }
  }

  return mcpProcesses;
}

function killProcess(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    // Give it a moment to die gracefully
    setTimeout(() => {
      try {
        process.kill(pid, 'SIGKILL');
      } catch (e) {
        // Process already dead, that's fine
      }
    }, 100);
    return true;
  } catch (error) {
    // Process might already be dead
    return false;
  }
}

// Main cleanup logic (invoked below only on non-Windows, non-CI environments)
function cleanup() {
  console.log('Searching for orphaned test processes...');

  const mcpProcesses = findMcpProcesses();

  if (mcpProcesses.length === 0) {
    console.log('✓ No orphaned processes found');
    return;
  }

  console.log(`Found ${mcpProcesses.length} processes to clean up:`);
  mcpProcesses.forEach(p => {
    console.log(`  PID ${p.pid}: ${p.command}`);
  });

  console.log('\nTerminating processes...');
  let killed = 0;
  let failed = 0;

  for (const proc of mcpProcesses) {
    if (killProcess(proc.pid)) {
      killed++;
    } else {
      failed++;
    }
  }

  console.log(`\n✓ Cleaned up ${killed} processes`);
  if (failed > 0) {
    console.log(`⚠ Failed to kill ${failed} processes`);
  }

  // Show memory status on Linux
  if (isLinux) {
    console.log('\nMemory status:');
    executeCommand('free -h | head -2');
  }
}

// Check if we should run (not in CI, not on Windows)
const shouldRun = !process.env.CI && !isWindows;

if (shouldRun) {
  cleanup();
} else if (process.env.CI) {
  console.log('✓ CI environment: Skipping cleanup (CI handles it)');
} else {
  console.log('✓ Cleanup not needed on this platform');
}

console.log('===============================================');
console.log('Cleanup complete');
console.log('===============================================');