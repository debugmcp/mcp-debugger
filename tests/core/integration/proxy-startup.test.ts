import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

/**
 * IMPORTANT: Test Environment Anti-Pattern Documentation
 * 
 * This test file previously contained tests that expected the proxy to behave
 * differently when running in test environments (e.g., detecting VITEST=true).
 * 
 * These tests were removed because:
 * 1. Production code should NEVER behave differently in tests vs production
 * 2. Test-specific behavior undermines the entire purpose of testing
 * 3. It can mask bugs that only appear in production
 * 4. It makes tests unreliable and doesn't test real behavior
 * 
 * The proxy should start and behave identically regardless of environment.
 * If you need different behavior in tests, use proper mocking/stubbing in the
 * test code itself, not conditional logic in production code.
 * 
 * Removed tests:
 * - "should not start when imported in unit tests" - Expected proxy to detect VITEST env
 * - "should detect all proxy modes correctly" - Expected non-existent testEnv parameter
 */

describe('Proxy Startup Integration', () => {
  let proxy: ChildProcess | null = null;

  afterEach(async () => {
    // Clean up any spawned processes
    if (proxy) {
      // First try to send a terminate command if IPC is available
      if (proxy.connected) {
        try {
          proxy.send({ cmd: 'terminate' });
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          // Ignore IPC errors
        }
      }

      // Then kill the process
      if (!proxy.killed) {
        proxy.kill('SIGTERM');
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!proxy.killed) {
          proxy.kill('SIGKILL');
        }
      }
    }
    proxy = null;
  });

  it('should start proxy when spawned via bootstrap', async () => {
    const proxyPath = path.join(__dirname, '../../../dist/proxy/proxy-bootstrap.js');
    
    // Create environment without test-related variables
    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_ENV;
    delete cleanEnv.VITEST;
    
    // Spawn the proxy with IPC
    proxy = spawn('node', [proxyPath], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: cleanEnv
    });

    // Collect stderr output
    let stderr = '';
    proxy.stderr!.on('data', (data) => {
      stderr += data.toString();
    });

    // Wait for startup or timeout
    const result = await new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        proxy!.kill();
        reject(new Error(`Proxy startup timeout. Stderr output:\n${stderr}`));
      }, 5000);

      proxy!.stderr!.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Ready to receive commands')) {
          clearTimeout(timeout);
          resolve(true);
        }
      });

      proxy!.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Proxy exited with code ${code}. Stderr output:\n${stderr}`));
        }
      });

      proxy!.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn proxy: ${err.message}`));
      });
    });

    expect(result).toBe(true);
    expect(stderr).toContain('Starting DAP Proxy worker process');
    expect(stderr).toContain('Ready to receive commands');
    
    // Verify detection results - only check for actual existing parameters
    expect(stderr).toMatch(/Detection results:.*hasIPC=true/);
    expect(stderr).toMatch(/Detection results:.*workerEnv=true/);
  });
});
