/**
 * Java utility functions for the Java debug adapter.
 *
 * Provides Java runtime detection, version checking, and path resolution.
 */
import { spawn } from 'child_process';
import * as path from 'path';

/**
 * Find the Java executable path.
 *
 * Priority: provided path > JAVA_HOME/bin/java > 'java' in PATH
 */
export async function findJavaExecutable(preferredPath?: string): Promise<string> {
  if (preferredPath) {
    if (await validateJavaExecutable(preferredPath)) {
      return preferredPath;
    }
    throw new Error(`Specified Java executable not valid: ${preferredPath}`);
  }

  // Try JAVA_HOME
  if (process.env.JAVA_HOME) {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const javaHome = path.join(process.env.JAVA_HOME, 'bin', `java${ext}`);
    if (await validateJavaExecutable(javaHome)) {
      return javaHome;
    }
  }

  // Try PATH
  if (await validateJavaExecutable('java')) {
    return 'java';
  }

  throw new Error(
    'Java not found. Install JDK 11+ and ensure java is in PATH or set JAVA_HOME.'
  );
}

/**
 * Validate that a Java executable works by running `java -version`.
 */
export async function validateJavaExecutable(javaPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(javaPath, ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let hasOutput = false;
      child.stderr?.on('data', () => { hasOutput = true; });
      child.stdout?.on('data', () => { hasOutput = true; });
      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0 && hasOutput));
    } catch {
      resolve(false);
    }
  });
}

/**
 * Get the Java version string.
 */
export async function getJavaVersion(javaPath?: string): Promise<string | null> {
  const cmd = javaPath || 'java';

  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      // java -version outputs to stderr
      child.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      child.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      child.on('error', () => resolve(null));
      child.on('exit', (code) => {
        if (code !== 0) {
          resolve(null);
          return;
        }

        // Parse version from output like: java version "17.0.1" or openjdk version "21.0.1"
        const match = output.match(/(?:java|openjdk)\s+version\s+"([^"]+)"/i);
        if (match) {
          resolve(match[1]);
        } else {
          // Try simpler pattern
          const simpleMatch = output.match(/(\d+(?:\.\d+)*)/);
          resolve(simpleMatch ? simpleMatch[1] : null);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Get Java search paths for executable resolution.
 */
export function getJavaSearchPaths(): string[] {
  const paths: string[] = [];

  if (process.env.JAVA_HOME) {
    paths.push(path.join(process.env.JAVA_HOME, 'bin'));
  }

  if (process.platform === 'win32') {
    // Common Windows JDK locations
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    paths.push(
      path.join(programFiles, 'Java'),
      path.join(programFilesX86, 'Java'),
      path.join(programFiles, 'Eclipse Adoptium'),
      path.join(programFiles, 'Microsoft', 'jdk'),
    );
  } else if (process.platform === 'darwin') {
    paths.push(
      '/Library/Java/JavaVirtualMachines',
      '/usr/local/opt/openjdk/bin',
      '/opt/homebrew/opt/openjdk/bin',
    );
  } else {
    paths.push(
      '/usr/lib/jvm',
      '/usr/local/lib/jvm',
      '/usr/bin',
      '/usr/local/bin',
    );
  }

  if (process.env.PATH) {
    paths.push(...process.env.PATH.split(path.delimiter));
  }

  return paths;
}
