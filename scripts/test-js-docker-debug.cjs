#!/usr/bin/env node

/**
 * Debug script to test JavaScript debugging in Docker
 * This will help us understand what's happening with path resolution
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const containerName = `mcp-debugger-js-debug-${Date.now()}`;

async function execCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { 
      shell: true,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function runTest() {
  console.log('=== JavaScript Docker Debugging Test ===\n');
  
  try {
    // 1. Start the Docker container with extra logging
    console.log('Starting Docker container with debug logging...');
    const dockerCmd = `docker run -d --name ${containerName} ` +
      `-v "${ROOT}:/workspace" ` +
      `-e MCP_CONTAINER=true ` +
      `-e MCP_WORKSPACE_ROOT=/workspace ` +
      `-e LOG_LEVEL=debug ` +
      `mcp-debugger:local ` +
      `node /app/dist/index.js stdio --log-level debug --log-file /tmp/mcp-debug.log`;
    
    await execCommand(dockerCmd);
    console.log(`Container started: ${containerName}\n`);
    
    // 2. Wait for container to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Test file existence check
    console.log('Testing file existence checks...');
    const testFiles = [
      '/workspace/examples/javascript/mcp_target.js',
      'examples/javascript/mcp_target.js',
      './examples/javascript/mcp_target.js'
    ];
    
    for (const file of testFiles) {
      try {
        const { stdout } = await execCommand(
          `docker exec ${containerName} ls -la "${file}" 2>&1`
        );
        console.log(`✓ File exists: ${file}`);
      } catch (e) {
        console.log(`✗ File not found: ${file}`);
      }
    }
    
    // 4. Check environment variables
    console.log('\nChecking environment variables...');
    const { stdout: envVars } = await execCommand(
      `docker exec ${containerName} sh -c "env | grep MCP"`
    );
    console.log('Environment:\n', envVars);
    
    // 5. Get container logs
    console.log('\nGetting container logs...');
    const { stdout: logs } = await execCommand(
      `docker logs ${containerName} --tail 50`
    );
    console.log('Container logs:\n', logs);
    
    // 6. Try to get the debug log file
    console.log('\nTrying to get debug log file...');
    try {
      const { stdout: debugLog } = await execCommand(
        `docker exec ${containerName} cat /tmp/mcp-debug.log 2>&1 | tail -100`
      );
      console.log('Debug log:\n', debugLog);
    } catch (e) {
      console.log('No debug log file yet');
    }
    
    // 7. Test Node.js availability
    console.log('\nTesting Node.js availability...');
    const { stdout: nodeVersion } = await execCommand(
      `docker exec ${containerName} node --version`
    );
    console.log('Node version:', nodeVersion.trim());
    
    // 8. Test the actual script can be run
    console.log('\nTesting if script can be run with Node...');
    try {
      const { stdout } = await execCommand(
        `docker exec ${containerName} sh -c "cd /workspace && node --version && ls -la examples/javascript/mcp_target.js"`
      );
      console.log('Script check:', stdout);
    } catch (e) {
      console.error('Script check failed:', e.message);
    }
    
    // 9. Check if the js-debug vendor files are present
    console.log('\nChecking js-debug vendor files...');
    try {
      const { stdout } = await execCommand(
        `docker exec ${containerName} ls -la /app/packages/adapter-javascript/vendor/js-debug/`
      );
      console.log('Vendor files:\n', stdout);
    } catch (e) {
      console.error('Vendor files not found:', e.message);
    }
    
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    try {
      await execCommand(`docker stop ${containerName}`);
      await execCommand(`docker rm ${containerName}`);
      console.log('Container removed');
    } catch (e) {
      console.error('Cleanup failed:', e.message);
    }
  }
}

// Run the test
runTest().catch(console.error);
