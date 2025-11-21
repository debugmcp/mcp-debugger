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
const DEFAULT_IMAGE = process.env.DOCKER_IMAGE_NAME || 'mcp-debugger:local';
let dockerBuildPromise: Promise<void> | null = null;

export interface DockerTestConfig {
  imageName?: string;
  containerName?: string;
  workspaceMount?: string;
  logLevel?: string;
  forceRebuild?: boolean;
}

/**
 * Build the Docker image if needed.
 * Uses the same logic as scripts/docker-build-if-needed.js so we only rebuild once per test run.
 */
export async function buildDockerImage(config: DockerTestConfig = {}): Promise<void> {
  const imageName = config.imageName || DEFAULT_IMAGE;
  const forceRebuild = config.forceRebuild === true || process.env.DOCKER_FORCE_REBUILD === 'true';

  // Force rebuild bypasses the shared cache and always runs docker build
  if (forceRebuild) {
    console.log(`[Docker Test] Forcing Docker rebuild for ${imageName}...`);
    await runDockerBuild(imageName);
    return;
  }

  if (!dockerBuildPromise) {
    dockerBuildPromise = (async () => {
      console.log(`[Docker Test] Ensuring Docker image ${imageName} is up to date...`);
      const scriptPath = path.join(ROOT, 'scripts', 'docker-build-if-needed.js');
      try {
        await execAsync(`node "${scriptPath}"`, {
          cwd: ROOT,
          env: {
            ...process.env,
            DOCKER_IMAGE_NAME: imageName
          }
        });
      } catch (error) {
        dockerBuildPromise = null;
        throw error;
      }
    })();
  }

  await dockerBuildPromise;
}

async function runDockerBuild(imageName: string): Promise<void> {
  try {
    const { stderr } = await execAsync(`docker build -t ${imageName} .`, { cwd: ROOT });
    if (stderr && stderr.trim().length > 0) {
      console.warn('[Docker Test] Build warnings:', stderr);
    }
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
  // Build args array conditionally
  const dockerArgs = [
    'run',
    '--rm',
    '-i',
  ];

  // Only add --user flag for local Unix development (not Windows, not CI)
  // This prevents root-owned files locally but avoids permission issues in CI
  if (process.platform !== 'win32' && process.env.CI !== 'true' && typeof process.getuid === 'function') {
    dockerArgs.push('--user', `${process.getuid()}:${process.getgid()}`);
  }

  dockerArgs.push(
    '--name', containerName,
    '-v', `${workspaceMount}:/workspace:rw`,
    '-v', `${ROOT}/logs:/tmp:rw`,
    imageName,
    'stdio',
    '--log-level', logLevel,
    '--log-file', '/tmp/docker-test.log'
  );

  const transport = new StdioClientTransport({
    command: 'docker',
    args: dockerArgs,
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
