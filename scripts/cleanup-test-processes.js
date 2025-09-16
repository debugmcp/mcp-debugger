#!/usr/bin/env node

/**
 * Test Process Cleanup Script
 *
 * Cleans up orphaned processes after test suite execution.
 * Cross-platform compatible (Windows/Linux/macOS).
 *
 * This addresses a known issue where proxy-bootstrap processes
 * can become orphaned on Unix systems during test execution.
 */

import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const isWindows = process.platform === 'win32';
const isDarwin = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// Get the project root (parent of scripts directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const projectName = path.basename(projectRoot);

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
  if (isWindows) {
    // Windows: Use WMIC to get process info
    const cmd = 'wmic process get ProcessId,ParentProcessId,CommandLine /format:csv';
    return executeCommand(cmd, true) || '';
  } else {
    // Unix: Use ps to get process info
    const cmd = 'ps aux';
    return executeCommand(cmd, true) || '';
  }
}

function findMcpProcesses() {
  const processList = getProcessList();
  const mcpProcesses = [];

  // Patterns to match MCP-related processes
  // More specific to avoid killing unrelated processes
  const patterns = [
    `${projectRoot}.*proxy-bootstrap`,  // Specific to this project
    `${projectRoot}.*dap-proxy`,
    `vitest.*${projectRoot}`,           // Vitest running in this project
    `debugpy.*${projectRoot}`,          // debugpy spawned by this project
  ];

  const lines = processList.split('\n');
  for (const line of lines) {
    for (const pattern of patterns) {
      if (line.match(new RegExp(pattern, 'i'))) {
        // Extract PID based on platform
        let pid;
        if (isWindows) {
          // CSV format: node,ProcessId,ParentProcessId,CommandLine
          const parts = line.split(',');
          if (parts.length > 2) {
            pid = parts[1];
          }
        } else {
          // Unix ps format: USER PID %CPU %MEM ...
          const parts = line.trim().split(/\s+/);
          if (parts.length > 1) {
            pid = parts[1];
          }
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
    if (isWindows) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
    } else {
      // Try graceful kill first, then force
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
      } catch (e) {
        // Process might already be dead
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

// Main cleanup logic
function cleanup() {
  // Skip on Windows - not needed due to process model
  if (isWindows) {
    console.log('✓ Windows: Process cleanup not needed (automatic)');
    return;
  }

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