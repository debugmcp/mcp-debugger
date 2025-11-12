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
