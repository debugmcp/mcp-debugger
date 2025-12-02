/**
 * Java Adapter Factory
 *
 * Factory for creating Java debug adapter instances.
 * Implements the adapter factory interface for dependency injection.
 *
 * @since 1.0.0
 */
import { IDebugAdapter } from '@debugmcp/shared';
import { IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult } from '@debugmcp/shared';
import { JavaDebugAdapter } from './java-debug-adapter.js';
import { DebugLanguage } from '@debugmcp/shared';
import {
  findJavaExecutable,
  getJavaVersion,
  parseJavaMajorVersion,
  findJdb,
  validateJdb
} from './utils/java-utils.js';

/**
 * Factory for creating Java debug adapters
 */
export class JavaAdapterFactory implements IAdapterFactory {
  /**
   * Create a new Java debug adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new JavaDebugAdapter(dependencies);
  }

  /**
   * Get metadata about the Java adapter
   */
  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.JAVA,
      displayName: 'Java',
      version: '1.0.0',
      author: 'mcp-debugger team',
      description: 'Debug Java applications using jdb (Java Debugger)',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/java',
      minimumDebuggerVersion: '1.0.0',
      fileExtensions: ['.java', '.class'],
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0YzNTI1MyIgZD0iTTIzLjY1IDMyLjU4Yy0uNDEgMC0uODItLjE2LTEuMTMtLjQ3bC02LjE1LTYuMTVjLS42Mi0uNjItLjYyLTEuNjQgMC0yLjI2bDYuMTUtNi4xNWMuNjItLjYyIDEuNjQtLjYyIDIuMjYgMGw2LjE1IDYuMTVjLjYyLjYyLjYyIDEuNjQgMCAyLjI2bC02LjE1IDYuMTVjLS4zMi4zMS0uNzMuNDctMS4xMy40N3oiLz48cGF0aCBmaWxsPSIjRTY0QTRBIiBkPSJNMjMuNjUgMjYuMThjLS40MSAwLS44Mi0uMTYtMS4xMy0uNDdsLTIuNzItMi43MmMtLjYyLS42Mi0uNjItMS42NCAwLTIuMjZsMi43Mi0yLjcyYy42Mi0uNjIgMS42NC0uNjIgMi4yNiAwbDIuNzIgMi43MmMuNjIuNjIuNjIgMS42NCAwIDIuMjZsLTIuNzIgMi43MmMtLjMxLjMxLS43Mi40Ny0xLjEzLjQ3eiIvPjxwYXRoIGZpbGw9IiM1MDcwQTIiIGQ9Ik0yMS41IDM4Yy0yLjIxIDAtNC0xLjc5LTQtNGwuMDEtNS4wMWMwLTIuMjEgMS43OS00IDQtNGgyLjAxYzIuMjEgMCA0IDEuNzkgNCA0VjM0YzAgMi4yMS0xLjc5IDQtNCA0SDIxLjV6Ii8+PHBhdGggZmlsbD0iIzU3NzBBMiIgZD0iTTIxLjUgMjQuOTljLTIuMjEgMC00LTEuNzktNC00di01LjAxYzAtMi4yMSAxLjc5LTQgNC00aDIuMDFjMi4yMSAwIDQgMS43OSA0IDR2NS4wMWMwIDIuMjEtMS43OSA0LTQgNEgyMS41eiIvPjwvc3ZnPg=='
    };
  }

  /**
   * Validate that the factory can create adapters in current environment
   */
  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let javaPath: string | undefined;
    let javaVersion: string | undefined;
    let jdbPath: string | undefined;

    try {
      // Check Java executable
      javaPath = await findJavaExecutable();

      // Check Java version
      javaVersion = await getJavaVersion(javaPath) || undefined;
      if (javaVersion) {
        const majorVersion = parseJavaMajorVersion(javaVersion);
        if (majorVersion < 8) {
          errors.push(`Java 8 or higher required. Current version: ${javaVersion}`);
        }
      } else {
        warnings.push('Could not determine Java version');
      }

      // Check jdb (Java Debugger) availability
      try {
        jdbPath = await findJdb(javaPath);
        const isValidJdb = await validateJdb(jdbPath);
        if (!isValidJdb) {
          errors.push(`jdb found at ${jdbPath} but failed validation`);
        }
      } catch (jdbError) {
        errors.push(jdbError instanceof Error ? jdbError.message : 'jdb not found');
      }

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Java executable not found');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        javaPath,
        javaVersion,
        jdbPath,
        javaHome: process.env.JAVA_HOME,
        platform: process.platform,
        timestamp: new Date().toISOString()
      }
    };
  }
}
