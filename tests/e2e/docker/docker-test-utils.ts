/**
 * Docker Test Utilities
 * 
 * Helper functions for running MCP debugger tests against a Docker container
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');

export interface DockerTestConfig {
  imageName?: string;
  containerName?: string;
  workspaceMount?: string;
  logLevel?: string;
}

/**
 * Build the Docker image if needed
 */
export async function buildDockerImage(config: DockerTestConfig = {}): Promise<void> {
  const imageName = config.imageName || 'mcp-debugger:test';
  console.log(`[Docker Test] Building image ${imageName}...`);
  
  try {
    const { stdout, stderr } = await execAsync(
      `docker build -t ${imageName} .`,
      { cwd: ROOT }
    );
    
    if (stderr && !stderr.includes('Successfully built')) {
      console.warn('[Docker Test] Build warnings:', stderr);
    }
    
    console.log('[Docker Test] Image built successfully');
  } catch (error) {
    console.error('[Docker Test] Failed to build image:', error);
    throw error;
  }
}

/**
 * Check if a container is already running
 */
export async function isContainerRunning(containerName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`);
    return stdout.trim() === containerName;
  } catch {
    return false;
  }
}

/**
 * Stop and remove a container if it exists
 */
export async function cleanupContainer(containerName: string): Promise<void> {
  try {
    // Stop container if running
    await execAsync(`docker stop ${containerName}`);
    console.log(`[Docker Test] Stopped container ${containerName}`);
  } catch {
    // Container might not be running
  }
  
  try {
    // Remove container
    await execAsync(`docker rm ${containerName}`);
    console.log(`[Docker Test] Removed container ${containerName}`);
  } catch {
    // Container might not exist
  }
}

/**
 * Create an MCP client connected to the Docker container
 */
export async function createDockerMcpClient(config: DockerTestConfig = {}): Promise<{
  client: Client;
  transport: StdioClientTransport;
  cleanup: () => Promise<void>;
}> {
  const imageName = config.imageName || 'mcp-debugger:test';
  const containerName = config.containerName || `mcp-debugger-test-${Date.now()}`;
  const workspaceMount = config.workspaceMount || path.resolve(ROOT, 'examples');
  const logLevel = config.logLevel || 'info';
  
  // Clean up any existing container with same name
  await cleanupContainer(containerName);
  
  console.log(`[Docker Test] Starting container ${containerName}...`);
  
  // Use docker run with stdio transport
  // Run as current user to avoid permission issues with mounted volumes
  const transport = new StdioClientTransport({
    command: 'docker',
    args: [
      'run',
      '--rm',
      '-i',
      '--user', `${process.getuid()}:${process.getgid()}`,
      '--name', containerName,
      '-v', `${workspaceMount}:/workspace:rw`,
      '-v', `${ROOT}/logs:/tmp:rw`,
      imageName,
      'stdio',
      '--log-level', logLevel,
      '--log-file', '/tmp/docker-test.log'
    ],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });
  
  const client = new Client({
    name: 'docker-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });
  
  try {
    await client.connect(transport);
    console.log('[Docker Test] MCP client connected to Docker container');
  } catch (error) {
    console.error('[Docker Test] Failed to connect to container:', error);
    await cleanupContainer(containerName);
    throw error;
  }
  
  const cleanup = async () => {
    try {
      await client.close();
    } catch {
      // Ignore close errors
    }
    
    try {
      await transport.close();
    } catch {
      // Ignore transport close errors
    }
    
    // Container should auto-remove with --rm, but clean up just in case
    await cleanupContainer(containerName);
  };
  
  return { client, transport, cleanup };
}

/**
 * Convert host path to container path
 * The container expects RELATIVE paths from /workspace
 */
export function hostToContainerPath(hostPath: string, workspaceMount = '/workspace'): string {
  // Normalize the path to use forward slashes
  const normalizedPath = hostPath.replace(/\\/g, '/');
  
  // If it's already a relative path without /workspace, return as-is
  if (!normalizedPath.startsWith('/') && !normalizedPath.includes(':')) {
    return normalizedPath;
  }
  
  // If it starts with /workspace/, strip it to get relative path
  if (normalizedPath.startsWith('/workspace/')) {
    return normalizedPath.substring('/workspace/'.length);
  }
  
  // Extract relative path from examples directory
  const examplesDir = path.resolve(ROOT, 'examples').replace(/\\/g, '/');
  if (normalizedPath.startsWith(examplesDir)) {
    // Get the relative path without leading slash
    const relativePath = normalizedPath.substring(examplesDir.length).replace(/^\//, '');
    // Return just the relative path - container will prepend /workspace/ internally
    return relativePath;
  }
  
  // For other paths, try to make them relative to workspace
  const rootDir = ROOT.replace(/\\/g, '/');
  if (normalizedPath.startsWith(rootDir)) {
    const relativePath = normalizedPath.substring(rootDir.length);
    // Map to container path - examples are mounted at /workspace
    if (relativePath.startsWith('/examples/')) {
      // Return relative path without /examples/ prefix
      return relativePath.substring('/examples/'.length);
    }
  }
  
  // Default: assume it's relative to workspace
  const basename = path.basename(normalizedPath);
  return basename;
}

/**
 * Get Docker logs for debugging
 */
export async function getDockerLogs(containerName: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`docker logs ${containerName} --tail 100`);
    return stdout;
  } catch (error) {
    console.error(`[Docker Test] Failed to get logs for ${containerName}:`, error);
    return '';
  }
}
