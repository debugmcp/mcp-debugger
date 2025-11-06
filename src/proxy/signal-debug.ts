/**
 * Signal debugging utilities for tracking SIGTERM source
 */

import fs from 'fs';
import { execSync } from 'child_process';

export function setupSignalDebugging(sessionId: string): void {
  console.error(`[Signal Debug] Setting up signal handlers for session ${sessionId}`);
  console.error(`[Signal Debug] Process PID: ${process.pid}`);
  console.error(`[Signal Debug] Parent PID: ${process.ppid}`);

  // Log initial process tree
  try {
    const psTree = execSync('ps auxf', { encoding: 'utf8' });
    fs.writeFileSync(`/tmp/process-tree-${sessionId}-start.log`, psTree);
    console.error('[Signal Debug] Initial process tree saved');
  } catch (error) {
    console.error('[Signal Debug] Failed to get process tree:', error);
  }

  // Set up SIGTERM handler
  process.on('SIGTERM', () => {
    console.error('[Signal Debug] SIGTERM received!');
    console.error(`[Signal Debug] Time: ${new Date().toISOString()}`);
    console.error(`[Signal Debug] Current PID: ${process.pid}`);
    console.error(`[Signal Debug] Parent PID: ${process.ppid}`);

    // Try to get process status
    try {
      const status = fs.readFileSync('/proc/self/status', 'utf8');
      console.error('[Signal Debug] Process status:');
      const lines = status.split('\n');
      for (const line of lines) {
        if (line.startsWith('PPid:') || line.startsWith('TracerPid:') || line.startsWith('SigQ:')) {
          console.error(`  ${line}`);
        }
      }
    } catch (error) {
      console.error('[Signal Debug] Could not read /proc/self/status:', error);
    }

    // Try to get process tree at termination
    try {
      const psTree = execSync('ps auxf', { encoding: 'utf8' });
      fs.writeFileSync(`/tmp/process-tree-${sessionId}-sigterm.log`, psTree);
      console.error('[Signal Debug] Process tree at SIGTERM saved');
      
      // Also log to stderr for immediate visibility
      console.error('[Signal Debug] Current process tree:');
      const lines = psTree.split('\n');
      for (const line of lines) {
        if (line.includes('node') || line.includes('proxy')) {
          console.error(line);
        }
      }
    } catch (error) {
      console.error('[Signal Debug] Failed to get process tree:', error);
    }

    // Check who might be sending the signal
    try {
      // Check if we're being killed by OOM killer
      const dmesg = execSync('dmesg | tail -20', { encoding: 'utf8' });
      if (dmesg.includes('Out of memory') || dmesg.includes('Kill process')) {
        console.error('[Signal Debug] OOM killer may be active!');
      }
    } catch {
      // Ignore dmesg errors
    }

    // Don't exit immediately - give time for logging
    setTimeout(() => {
      console.error('[Signal Debug] Exiting after SIGTERM...');
      process.exit(128 + 15); // Standard exit code for SIGTERM
    }, 500);
  });

  // Also track other signals
  const signals: NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGUSR1', 'SIGUSR2'];
  signals.forEach(signal => {
    process.on(signal, () => {
      console.error(`[Signal Debug] Received ${signal}`);
    });
  });

  console.error('[Signal Debug] Signal handlers installed');
}
