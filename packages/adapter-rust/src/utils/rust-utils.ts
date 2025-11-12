/**
 * Rust debugging utilities
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Check if Cargo is installed and available
 */
export async function checkCargoInstallation(): Promise<boolean> {
  return new Promise((resolve) => {
    const cargoProcess = spawn('cargo', ['--version'], {
      stdio: 'ignore',
      shell: true
    });
    
    cargoProcess.on('error', () => resolve(false));
    cargoProcess.on('exit', (code) => resolve(code === 0));
  });
}

/**
 * Get Cargo version
 */
export async function getCargoVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const cargoProcess = spawn('cargo', ['--version'], {
      shell: true
    });
    
    let output = '';
    cargoProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    cargoProcess.on('error', () => resolve(null));
    cargoProcess.on('exit', (code) => {
      if (code === 0 && output) {
        // Parse version from "cargo 1.73.0 (9c4383fb5 2023-08-26)"
        const match = output.match(/cargo (\d+\.\d+\.\d+)/);
        resolve(match ? match[1] : null);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Resolve the path to the CodeLLDB executable
 * This is re-exported from codelldb-resolver for backward compatibility
 */
export { resolveCodeLLDBExecutable as resolveCodeLLDBPath } from './codelldb-resolver.js';

/**
 * Find Rust project root (containing Cargo.toml)
 */
export async function findCargoProjectRoot(startPath: string): Promise<string | null> {
  let currentPath = path.resolve(startPath);
  const root = path.parse(currentPath).root;
  
  while (currentPath !== root) {
    try {
      const cargoTomlPath = path.join(currentPath, 'Cargo.toml');
      await fs.access(cargoTomlPath, fs.constants.F_OK);
      return currentPath;
    } catch {
      // Not found, move up
      currentPath = path.dirname(currentPath);
    }
  }
  
  // Check root as well
  try {
    const cargoTomlPath = path.join(root, 'Cargo.toml');
    await fs.access(cargoTomlPath, fs.constants.F_OK);
    return root;
  } catch {
    return null;
  }
}

/**
 * Build a Rust project using Cargo
 */
export async function buildRustProject(
  projectPath: string,
  release: boolean = false
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const args = ['build'];
    if (release) {
      args.push('--release');
    }
    
    const buildProcess = spawn('cargo', args, {
      cwd: projectPath,
      shell: true
    });
    
    let output = '';
    let errorOutput = '';
    
    buildProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    buildProcess.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    buildProcess.on('error', (error) => {
      resolve({
        success: false,
        output: `Build failed: ${error.message}`
      });
    });
    
    buildProcess.on('exit', (code) => {
      resolve({
        success: code === 0,
        output: output + errorOutput
      });
    });
  });
}

/**
 * Get the path to the compiled binary
 */
export async function getRustBinaryPath(
  projectPath: string,
  binaryName: string,
  release: boolean = false
): Promise<string | null> {
  const targetDir = path.join(
    projectPath,
    'target',
    release ? 'release' : 'debug'
  );
  
  const extension = process.platform === 'win32' ? '.exe' : '';
  const binaryPath = path.join(targetDir, `${binaryName}${extension}`);
  
  try {
    await fs.access(binaryPath, fs.constants.F_OK);
    return binaryPath;
  } catch {
    return null;
  }
}
