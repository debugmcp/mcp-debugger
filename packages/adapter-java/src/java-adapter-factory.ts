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
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cGF0aCBmaWxsPSIjRTc2RjAwIiBkPSJNNDcuNiA3Ni41cy00LjYgMi43IDMuMyAzLjZjOS41IDEuMSAxNC40LjkgMjQuOS0xLjEgMCAwIDIuOCAxLjcgNi42IDMuMi0yMy40IDEwLTUzLTAuNi0zNC44LTUuN3ptLTIuOS0xMy4xcy01LjIgMy44IDIuNyA0LjZjMTAuMiAxLjEgMTguMiAxLjIgMzIuMS0xLjYgMCAwIDEuOSAyIDQuOSAzLjEtMjguMyA4LjMtNTkuOC42LTM5LjctNi4xeiIvPjxwYXRoIGZpbGw9IiM1MzgyQTEiIGQ9Ik02OS40IDQ1LjFjNS43IDYuNi0xLjUgMTIuNS0xLjUgMTIuNXMxNC41LTcuNSA3LjktMTYuOWMtNi4yLTguOC0xMC45LTEzLjIgMTQuNy0yOC4yIDAgMC00MC4yIDEwLTIxLjEgMzIuNnoiLz48cGF0aCBmaWxsPSIjRTc2RjAwIiBkPSJNOTUuOCA4My45czMuNCAyLjgtMy44IDVjLTEzLjUgNC4xLTU2LjIgNS4zLTY4LjEuMi00LjMtMS45IDMuOC00LjQgNi40LTUgMi43LS42IDQuMi0uNSA0LjItLjUtNC44LTMuNC0zMS4zIDYuNy0xMy40IDkuNSA0OC42IDcuNyA4OC42LTMuNSA3NC43LTkuMnpNNDkuOSA1NS42cy0yMi4yIDUuMy03LjkgNy4yYzYuMS44IDE4LjIuNiAyOS41LS4zIDkuMi0uOCAxOC41LTIuNCAxOC41LTIuNHMtMy4zIDEuNC01LjYgM2MtMjIuOCA2LTY2LjggMy4yLTU0LjEtMi45IDEwLjctNS4yIDE5LjYtNC42IDE5LjYtNC42ek04NS43IDcxLjJjMjMuMS0xMiAxMi40LTIzLjYgNS0yMiAtMS44LjQtMi42LjctMi42LjdzLjctMS4xIDItMS41YzE0LjctNS4yIDI2IDE1LjItNC44IDIzLjMgMCAwIC40LS4zLjQtLjV6Ii8+PHBhdGggZmlsbD0iIzUzODJBMSIgZD0iTTc2LjUgMS45czEyLjggMTIuOC0xMi4xIDMyLjVjLTIwIDE1LjgtNC42IDI0LjggMCAzNS4xLTExLjctMTAuNS0yMC4yLTE5LjgtMTQuNS0yOC40QzU4LjMgMjguNCA4MS4xIDIyIDc2LjUgMS45eiIvPjxwYXRoIGZpbGw9IiNFNzZGMDAiIGQ9Ik01MS40IDEwNC41YzIyLjIgMS40IDU2LjMtLjggNTcuMS0xMS4zIDAgMC0xLjYgNC0xOC40IDcuMi0xOSAzLjYtNDIuNCAzLjItNTYuMy45IDAgMCAyLjggMi40IDE3LjYgMy4yeiIvPjwvc3ZnPg==',
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
