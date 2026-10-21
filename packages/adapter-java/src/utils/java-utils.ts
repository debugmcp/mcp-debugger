/**
 * Java utility functions for the Java debug adapter.
 *
 * Provides Java runtime detection, version checking, and path resolution.
 */
import * as path from 'path';
import { runVersionProbe } from '@debugmcp/shared';

/**
 * Find the Java executable path.
 *
 * Priority: provided path > JAVA_HOME/bin/java > 'java' in PATH
 */
export async function findJavaExecutable(preferredPath?: string): Promise<string> {
  return (await findJavaWithVersion(preferredPath)).path;
}

/**
 * Find the Java executable and read its version from the same
 * `java -version` that validates it (issue #969: the factory used to start a
 * second JVM just for the version). Same search order and errors as
 * findJavaExecutable.
 */
export async function findJavaWithVersion(preferredPath?: string): Promise<{ path: string; version: string | null }> {
  if (preferredPath) {
    const probed = await probeJava(preferredPath);
    if (probed) {
      return { path: preferredPath, version: probed.version };
    }
    throw new Error(`Specified Java executable not valid: ${preferredPath}`);
  }

  // Try JAVA_HOME
  if (process.env.JAVA_HOME) {
    /* istanbul ignore next -- platform-specific executable extension */
    const ext = process.platform === 'win32' ? '.exe' : '';
    const javaHome = path.join(process.env.JAVA_HOME, 'bin', `java${ext}`);
    const probed = await probeJava(javaHome);
    if (probed) {
      return { path: javaHome, version: probed.version };
    }
  }

  // Try PATH
  const probed = await probeJava('java');
  if (probed) {
    return { path: 'java', version: probed.version };
  }

  throw new Error(
    'Java not found. Install JDK (21+ recommended) and ensure java is in PATH or set JAVA_HOME.'
  );
}

/**
 * Run `<exe> -version` once (the shared probe: no shell, read on close,
 * killed after 10 s). Null when the executable does not run, exits non-zero
 * or prints nothing; otherwise its version, when the output carries one.
 */
async function probeJava(javaPath: string): Promise<{ version: string | null } | null> {
  const result = await runVersionProbe(javaPath, ['-version']);
  if (result.code !== 0) {
    return null;
  }
  // java -version prints to stderr
  const output = result.stderr + result.stdout;
  if (output.length === 0) {
    return null;
  }
  // "java version "17.0.1"" or "openjdk version "21.0.1""; else the first dotted number
  const match = output.match(/(?:java|openjdk)\s+version\s+"([^"]+)"/i) ?? output.match(/(\d+(?:\.\d+)*)/);
  return { version: match ? match[1]! : null };
}

/**
 * Validate that a Java-family executable (java or javac) works by running
 * `<exe> -version`.
 */
export async function validateJavaExecutable(javaPath: string): Promise<boolean> {
  return (await probeJava(javaPath)) !== null;
}

/**
 * Get the Java version string.
 */
export async function getJavaVersion(javaPath?: string): Promise<string | null> {
  return (await probeJava(javaPath || 'java'))?.version ?? null;
}

/**
 * Get Java search paths for executable resolution.
 */
export function getJavaSearchPaths(): string[] {
  const paths: string[] = [];

  if (process.env.JAVA_HOME) {
    paths.push(path.join(process.env.JAVA_HOME, 'bin'));
  }

  /* istanbul ignore next -- platform-specific: Windows */
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
  /* istanbul ignore next -- platform-specific: macOS */
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
