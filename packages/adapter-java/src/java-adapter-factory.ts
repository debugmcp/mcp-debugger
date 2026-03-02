/**
 * Java Adapter Factory
 *
 * Factory for creating Java debug adapter instances.
 * Uses JDI bridge (JdiDapServer) as the underlying DAP server.
 */
import { IDebugAdapter } from '@debugmcp/shared';
import { IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult } from '@debugmcp/shared';
import { JavaDebugAdapter } from './java-debug-adapter.js';
import { DebugLanguage } from '@debugmcp/shared';
import { findJavaExecutable, getJavaVersion } from './utils/java-utils.js';
import { resolveJdiBridgeClassDir } from './utils/jdi-resolver.js';

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
      version: '0.2.0',
      author: 'mcp-debugger team',
      description: 'Debug Java applications using JDI bridge (JdiDapServer)',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/java',
      minimumDebuggerVersion: '0.18.0',
      fileExtensions: ['.java'],
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
    let jdiBridgeDir: string | undefined;

    // Check JDI bridge
    const resolvedBridge = resolveJdiBridgeClassDir();
    if (!resolvedBridge) {
      warnings.push('JDI bridge not compiled. Run: pnpm --filter @debugmcp/adapter-java run build:adapter');
    } else {
      jdiBridgeDir = resolvedBridge;
    }

    // Check Java
    try {
      javaPath = await findJavaExecutable();
      javaVersion = await getJavaVersion(javaPath) || undefined;

      if (javaVersion) {
        // Parse major version: "17.0.1" -> 17, "1.8.0_301" -> 8
        const parts = javaVersion.split('.');
        const major = parseInt(parts[0], 10);
        const effectiveMajor = major === 1 ? parseInt(parts[1], 10) : major;

        if (effectiveMajor < 21) {
          warnings.push(`Java 21+ recommended. Current version: ${javaVersion}`);
        }
      }
    } catch {
      errors.push('Java not found. Install JDK 21+ from https://adoptium.net/');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        javaPath,
        javaVersion,
        jdiBridgeDir,
        platform: process.platform,
        arch: process.arch,
        timestamp: new Date().toISOString()
      }
    };
  }
}
