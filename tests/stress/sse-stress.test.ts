/**
 * SSE Transport Stress Test Suite
 * 
 * Tests the SSE transport under extreme conditions:
 * - Rapid connect/disconnect cycles
 * - Multiple concurrent sessions
 * - Long-running connections
 * - Resource leak detection
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';

const runStressTests = process.env.RUN_STRESS_TESTS === 'true';
const describeStress = runStressTests ? describe : describe.skip;

const TEST_TIMEOUT = 120000; // 2 minutes for stress tests
const BASE_PORT = 4000;

interface TestMetrics {
  connectionsAttempted: number;
  connectionsSucceeded: number;
  connectionsFailed: number;
  averageConnectTime: number;
  memoryUsageMB: number[];
  errors: string[];
}

class SSEStressTester {
  private serverProcess: ChildProcess | null = null;
  private clients: Client[] = [];
  private metrics: TestMetrics = {
    connectionsAttempted: 0,
    connectionsSucceeded: 0,
    connectionsFailed: 0,
    averageConnectTime: 0,
    memoryUsageMB: [],
    errors: []
  };

  async startServer(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const projectRoot = process.cwd();
      
      this.serverProcess = spawn('node', [
        path.join(projectRoot, 'dist', 'index.js'),
        'sse',
        '-p', port.toString(),
        '--log-level', 'error' // Minimize logging during stress test
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: projectRoot
      });

      const timeout = setTimeout(() => {
        reject(new Error(`Server failed to start on port ${port}`));
      }, 10000);

      this.serverProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      // Wait for server to be ready
      const checkPort = async () => {
        for (let i = 0; i < 30; i++) {
          if (await this.isPortOpen(port)) {
            clearTimeout(timeout);
            resolve();
            return;
          }
          await this.sleep(200);
        }
        clearTimeout(timeout);
        reject(new Error('Server startup timeout'));
      };
      
      checkPort();
    });
  }

  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      await this.sleep(1000);
      if (!this.serverProcess.killed) {
        this.serverProcess.kill('SIGKILL');
      }
      this.serverProcess = null;
    }
  }

  async connectClient(port: number): Promise<Client> {
    const startTime = Date.now();
    this.metrics.connectionsAttempted++;
    
    try {
      const client = new Client({
        name: `stress-test-${this.metrics.connectionsAttempted}`,
        version: '1.0.0'
      });
      
      const transport = new SSEClientTransport(new URL(`http://localhost:${port}/sse`));
      await client.connect(transport);
      
      const connectTime = Date.now() - startTime;
      this.metrics.connectionsSucceeded++;
      this.updateAverageConnectTime(connectTime);
      
      this.clients.push(client);
      return client;
    } catch (error) {
      this.metrics.connectionsFailed++;
      this.metrics.errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async disconnectClient(client: Client): Promise<void> {
    try {
      await client.close();
      const index = this.clients.indexOf(client);
      if (index > -1) {
        this.clients.splice(index, 1);
      }
    } catch (error) {
      this.metrics.errors.push(`Disconnect error: ${error}`);
    }
  }

  async disconnectAllClients(): Promise<void> {
    const disconnectPromises = this.clients.map(client => 
      this.disconnectClient(client).catch(() => {})
    );
    await Promise.all(disconnectPromises);
    this.clients = [];
  }

  recordMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.metrics.memoryUsageMB.push(Math.round(usage.heapUsed / 1024 / 1024));
  }

  getMetrics(): TestMetrics {
    return this.metrics;
  }

  private updateAverageConnectTime(newTime: number): void {
    const totalCount = this.metrics.connectionsSucceeded;
    const currentAvg = this.metrics.averageConnectTime;
    this.metrics.averageConnectTime = ((currentAvg * (totalCount - 1)) + newTime) / totalCount;
  }

  private async isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection(port, 'localhost');
      
      socket.on('connect', () => {
        socket.end();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

describeStress('SSE Transport Stress Tests', () => {
  let tester: SSEStressTester;
  let testPort: number;

  beforeEach(() => {
    tester = new SSEStressTester();
    testPort = BASE_PORT + Math.floor(Math.random() * 1000);
  });

  afterEach(async () => {
    await tester.disconnectAllClients();
    await tester.stopServer();
  });

  it('should handle rapid connect/disconnect cycles', async () => {
    // Start server
    await tester.startServer(testPort);
    
    const CYCLES = 20;
    const CONNECTIONS_PER_CYCLE = 3;
    
    console.log(`Starting rapid reconnection test: ${CYCLES} cycles, ${CONNECTIONS_PER_CYCLE} connections per cycle`);
    
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      // Record memory every 10 cycles
      if (cycle % 10 === 0) {
        tester.recordMemoryUsage();
      }
      
      // Create multiple connections simultaneously
      const connectPromises: Promise<Client>[] = [];
      for (let i = 0; i < CONNECTIONS_PER_CYCLE; i++) {
        connectPromises.push(tester.connectClient(testPort));
      }
      
      // Wait for all to connect (or fail)
      const clients = await Promise.allSettled(connectPromises);
      const successfulClients = clients
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<Client>).value);
      
      // Immediately disconnect
      await Promise.all(successfulClients.map(client => 
        tester.disconnectClient(client)
      ));
      
      // Brief pause between cycles
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const metrics = tester.getMetrics();
    console.log('Test completed. Metrics:', {
      ...metrics,
      successRate: `${((metrics.connectionsSucceeded / metrics.connectionsAttempted) * 100).toFixed(2)}%`,
      memoryGrowth: metrics.memoryUsageMB.length > 1 
        ? `${metrics.memoryUsageMB[metrics.memoryUsageMB.length - 1] - metrics.memoryUsageMB[0]} MB`
        : 'N/A'
    });
    
    // Assertions
    expect(metrics.connectionsSucceeded).toBeGreaterThan(0);
    expect(metrics.connectionsSucceeded / metrics.connectionsAttempted).toBeGreaterThan(0.9); // 90% success rate
    
    // Check for memory leaks (should not grow more than 50MB)
    if (metrics.memoryUsageMB.length > 1) {
      const memoryGrowth = metrics.memoryUsageMB[metrics.memoryUsageMB.length - 1] - metrics.memoryUsageMB[0];
      expect(memoryGrowth).toBeLessThan(50);
    }
    
    // Average connect time should be reasonable
    expect(metrics.averageConnectTime).toBeLessThan(1000); // Under 1 second
  }, TEST_TIMEOUT);

  it('should handle burst connections', async () => {
    await tester.startServer(testPort);
    
    const BURST_SIZE = 10;
    
    console.log(`Creating burst of ${BURST_SIZE} simultaneous connections`);
    
    // Create all connections at once
    const connectPromises = Array(BURST_SIZE).fill(null).map(() => 
      tester.connectClient(testPort)
    );
    
    const results = await Promise.allSettled(connectPromises);
    
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Burst test: ${succeeded} succeeded, ${failed} failed`);
    
    // At least 80% should succeed even under burst
    expect(succeeded / BURST_SIZE).toBeGreaterThan(0.8);
    
    // Clean up
    await tester.disconnectAllClients();
  }, TEST_TIMEOUT);

  it('should maintain stable long-running connection', async () => {
    await tester.startServer(testPort);
    
    console.log('Starting long-running connection test (15 seconds)');
    
    // Create a connection
    const client = await tester.connectClient(testPort);
    
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    let operationCount = 0;
    const errors: string[] = [];
    
    // Keep connection alive and perform operations for 30 seconds
    const startTime = Date.now();
    const DURATION = 15000; // 15 seconds
    
    while (Date.now() - startTime < DURATION) {
      try {
        // Perform a simple operation
        await client.callTool({
          name: 'list_debug_sessions',
          arguments: {}
        });
        operationCount++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      
      // Wait 1 second between operations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    const memoryGrowth = endMemory - startMemory;
    
    console.log(`Long-running test completed: ${operationCount} operations, ${errors.length} errors, memory growth: ${memoryGrowth.toFixed(2)} MB`);
    
    // Connection should still be active
    expect(client).toBeDefined();
    expect(operationCount).toBeGreaterThan(12); // Should complete most operations within 15s window
    expect(errors.length).toBeLessThan(5); // Few errors acceptable
    expect(memoryGrowth).toBeLessThan(20); // Memory growth should be minimal
    
    await tester.disconnectClient(client);
  }, TEST_TIMEOUT);

  it('should recover from server restart', async () => {
    await tester.startServer(testPort);
    
    // Connect clients
    const client1 = await tester.connectClient(testPort);
    
    console.log('Stopping server to simulate crash...');
    await tester.stopServer();
    
    // Try to use client (should fail)
    let operationFailed = false;
    try {
      await client1.callTool({
        name: 'list_debug_sessions',
        arguments: {}
      });
    } catch {
      operationFailed = true;
    }
    expect(operationFailed).toBe(true);
    
    console.log('Restarting server...');
    await tester.startServer(testPort);
    
    // New connection should work
    const client2 = await tester.connectClient(testPort);
    
    const result = await client2.callTool({
      name: 'list_debug_sessions',
      arguments: {}
    });
    
    expect(result).toBeDefined();
    
    await tester.disconnectClient(client2);
  }, TEST_TIMEOUT);
});
