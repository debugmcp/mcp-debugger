/**
 * Cargo project utilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Cargo target information
 */
export interface CargoTarget {
  name: string;
  kind: string[];
  src_path: string;
}

/**
 * Resolve Cargo project information
 */
export async function resolveCargoProject(projectPath: string): Promise<{
  name: string;
  version: string;
  targets: CargoTarget[];
} | null> {
  try {
    const cargoTomlPath = path.join(projectPath, 'Cargo.toml');
    const cargoTomlContent = await fs.readFile(cargoTomlPath, 'utf-8');
    
    // Parse basic info from Cargo.toml (simplified parsing)
    const nameMatch = cargoTomlContent.match(/name\s*=\s*"([^"]+)"/);
    const versionMatch = cargoTomlContent.match(/version\s*=\s*"([^"]+)"/);
    
    if (!nameMatch) {
      return null;
    }
    
    // Get targets using cargo metadata
    const targets = await getCargoTargets(projectPath);
    
    return {
      name: nameMatch[1],
      version: versionMatch ? versionMatch[1] : '0.1.0',
      targets
    };
  } catch {
    return null;
  }
}

/**
 * Get Cargo targets (binaries, libraries, tests, etc.)
 */
export async function getCargoTargets(projectPath: string): Promise<CargoTarget[]> {
  return new Promise((resolve) => {
    const metadataProcess = spawn('cargo', ['metadata', '--format-version', '1'], {
      cwd: projectPath,
      shell: true
    });
    
    let output = '';
    
    metadataProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    metadataProcess.on('error', () => resolve([]));
    metadataProcess.on('exit', (code) => {
      if (code === 0 && output) {
        try {
          const metadata = JSON.parse(output);
          const targets: CargoTarget[] = [];
          
          // Extract targets from packages
          for (const pkg of metadata.packages) {
            if (pkg.manifest_path.startsWith(projectPath)) {
              for (const target of pkg.targets) {
                targets.push({
                  name: target.name,
                  kind: target.kind,
                  src_path: target.src_path
                });
              }
            }
          }
          
          resolve(targets);
        } catch {
          resolve([]);
        }
      } else {
        resolve([]);
      }
    });
  });
}

/**
 * Find binary targets in a Cargo project
 */
export async function findBinaryTargets(projectPath: string): Promise<string[]> {
  const targets = await getCargoTargets(projectPath);
  return targets
    .filter(t => t.kind.includes('bin'))
    .map(t => t.name);
}

/**
 * Run Cargo test
 */
export async function runCargoTest(
  projectPath: string,
  testName?: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const args = ['test'];
    if (testName) {
      args.push(testName);
    }
    
    const testProcess = spawn('cargo', args, {
      cwd: projectPath,
      shell: true
    });
    
    let output = '';
    let errorOutput = '';
    
    testProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    testProcess.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    testProcess.on('error', (error) => {
      resolve({
        success: false,
        output: `Test failed: ${error.message}`
      });
    });
    
    testProcess.on('exit', (code) => {
      resolve({
        success: code === 0,
        output: output + errorOutput
      });
    });
  });
}

/**
 * Check if a Cargo project needs rebuilding
 */
export async function needsRebuild(
  projectPath: string,
  binaryName: string,
  release: boolean = false
): Promise<boolean> {
  const targetDir = path.join(
    projectPath,
    'target',
    release ? 'release' : 'debug'
  );
  
  const extension = process.platform === 'win32' ? '.exe' : '';
  const binaryPath = path.join(targetDir, `${binaryName}${extension}`);
  
  try {
    // Check if binary exists
    const binaryStats = await fs.stat(binaryPath);
    
    // Check source file modification times
    const srcDir = path.join(projectPath, 'src');
    const srcFiles = await getAllRustFiles(srcDir);
    
    for (const srcFile of srcFiles) {
      const srcStats = await fs.stat(srcFile);
      if (srcStats.mtime > binaryStats.mtime) {
        return true;
      }
    }
    
    // Check Cargo.toml modification time
    const cargoTomlPath = path.join(projectPath, 'Cargo.toml');
    const cargoStats = await fs.stat(cargoTomlPath);
    if (cargoStats.mtime > binaryStats.mtime) {
      return true;
    }
    
    return false;
  } catch {
    // Binary doesn't exist or error accessing files
    return true;
  }
}

/**
 * Get all Rust source files recursively
 */
async function getAllRustFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getAllRustFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.rs')) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore errors reading directories
  }
  
  return files;
}

/**
 * Run Cargo build with specified arguments
 */
export async function runCargoBuild(
  projectPath: string,
  args: string[]
): Promise<{ success: boolean; output: string; binaryPath?: string }> {
  return new Promise((resolve) => {
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
      const fullOutput = output + errorOutput;
      resolve({
        success: code === 0,
        output: fullOutput
      });
    });
  });
}

/**
 * Get the default binary name from Cargo.toml
 */
export async function getDefaultBinary(projectPath: string): Promise<string> {
  const cargoProject = await resolveCargoProject(projectPath);
  if (cargoProject) {
    // Find the first binary target
    const binTargets = cargoProject.targets.filter(t => t.kind.includes('bin'));
    if (binTargets.length > 0) {
      return binTargets[0].name;
    }
    // Fallback to package name
    return cargoProject.name;
  }
  
  // Last resort: look for main.rs
  try {
    const mainPath = path.join(projectPath, 'src', 'main.rs');
    await fs.access(mainPath);
    return path.basename(projectPath);
  } catch {
    return 'main';
  }
}

/**
 * Find the Cargo.toml file for a given Rust source file by walking up the directory tree
 */
export async function findCargoProjectRoot(filePath: string): Promise<string> {
  let dir = path.dirname(path.resolve(filePath));
  const root = path.parse(dir).root;
  
  while (dir !== root) {
    const cargoToml = path.join(dir, 'Cargo.toml');
    try {
      await fs.access(cargoToml);
      return dir;
    } catch {
      // Continue searching
    }
    const parentDir = path.dirname(dir);
    if (parentDir === dir) {
      break; // Reached the root
    }
    dir = parentDir;
  }
  
  throw new Error(`No Cargo.toml found for ${filePath}`);
}

/**
 * Build the Cargo project with progress reporting
 */
export async function buildCargoProject(
  projectRoot: string,
  logger?: { info?: (msg: string) => void; error?: (msg: string) => void },
  buildMode: 'debug' | 'release' = 'debug'
): Promise<{ success: boolean; binaryPath?: string; error?: string }> {
  logger?.info?.(`[Rust Debugger] Building project at ${projectRoot}...`);
  
  const args = ['build'];
  if (buildMode === 'release') {
    args.push('--release');
  }
  
  return new Promise((resolve) => {
    const buildProcess = spawn('cargo', args, {
      cwd: projectRoot,
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    buildProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      stdout += msg;
      // Show compilation progress
      if (msg.includes('Compiling')) {
        logger?.info?.(`[Rust Build] ${msg.trim()}`);
      }
    });
    
    buildProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    buildProcess.on('error', (error) => {
      const errorMsg = `Build process error: ${error.message}`;
      logger?.error?.(`[Rust Debugger] ${errorMsg}`);
      resolve({ success: false, error: errorMsg });
    });
    
    buildProcess.on('exit', async (code) => {
      if (code === 0) {
        try {
          const binaryName = await getDefaultBinary(projectRoot);
          const binaryPath = path.join(
            projectRoot,
            'target',
            buildMode,
            process.platform === 'win32' ? `${binaryName}.exe` : binaryName
          );
          
          logger?.info?.(`[Rust Debugger] Build successful: ${binaryPath}`);
          resolve({ success: true, binaryPath });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger?.error?.(`[Rust Debugger] Failed to determine binary path: ${errorMsg}`);
          resolve({ success: false, error: errorMsg });
        }
      } else {
        logger?.error?.(`[Rust Debugger] Build failed with code ${code}:\n${stderr}`);
        resolve({ success: false, error: stderr || stdout });
      }
    });
  });
}
