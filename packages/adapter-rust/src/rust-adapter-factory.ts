/**
 * Rust Adapter Factory
 * 
 * Factory for creating Rust debug adapter instances.
 * Implements the adapter factory interface for dependency injection.
 */
import { IDebugAdapter } from '@debugmcp/shared';
import { IAdapterFactory, AdapterDependencies, AdapterMetadata, FactoryValidationResult } from '@debugmcp/shared';
import { RustDebugAdapter } from './rust-debug-adapter.js';
import { DebugLanguage } from '@debugmcp/shared';
import { checkCargoInstallation, getCargoVersion, getRustHostTriple } from './utils/rust-utils.js';
import { resolveCodeLLDBExecutable, getCodeLLDBVersion } from './utils/codelldb-resolver.js';

/**
 * Factory for creating Rust debug adapters
 */
export class RustAdapterFactory implements IAdapterFactory {
  /**
   * Create a new Rust debug adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new RustDebugAdapter(dependencies);
  }
  
  /**
   * Get metadata about the Rust adapter
   */
  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.RUST,
      displayName: 'Rust',
      version: '0.1.0',
      author: 'mcp-debugger team',
      description: 'Debug Rust applications using CodeLLDB',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/rust',
      minimumDebuggerVersion: '1.0.0',
      fileExtensions: ['.rs'],
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBkPSJNMCA1MTJWMGg1MTJWNTI2LCJmaWxsPSIjMDAwIi8+PHBhdGggZD0iTTM5My4yIDIzNi42bC0zMC40LTMxLjRjLS43LS43LTEuOS0uNy0yLjYgMGwtMzAgMzFjLS43LjctLjcgMS45IDAgMi42bDMwIDMxLjRjLjcuNyAxLjkuNyAyLjYgMGwzMC40LTMxLjRjLjctLjcuNy0xLjkgMC0yLjZ6IiBmaWxsPSIjZmU3ZjJkIi8+PHBhdGggZD0iTTEyOC40IDI1NC41YzAtNy44LTYuMy0xNC4xLTE0LjEtMTQuMXMtMTQuMSA2LjMtMTQuMSAxNC4xIDYuMyAxNC4xIDE0LjEgMTQuMSAxNC4xLTYuMyAxNC4xLTE0LjF6bTI1NS45IDBjMC03LjgtNi4zLTE0LjEtMTQuMS0xNC4xcy0xNC4xIDYuMy0xNC4xIDE0LjEgNi4zIDE0LjEgMTQuMSAxNC4xIDE0LjEtNi4zIDE0LjEtMTQuMXoiIGZpbGw9IiNmZTdmMmQiLz48cGF0aCBkPSJNNDM5LjkgMjU0LjVjMC0xMS41LTkuNC0yMC45LTIwLjktMjAuOXMtMjAuOSA5LjQtMjAuOSAyMC45YzAgNC4xIDEuMiA3LjkgMy4yIDExLjFsLTI4LjggNDcuNWMtMS4xLS4xLTIuMy0uMi0zLjQtLjItMTIgMC0yMi45IDUuMS0zMC41IDEzLjNsLTkwLjgtOC4yYy0uOS0xMC4xLTkuNC0xOC4xLTE5LjctMTguMXMtMTguOCA4LTE5LjcgMTguMWwtOTAuOCA4LjJjLTcuNi04LjItMTguNi0xMy4zLTMwLjUtMTMuMy0xLjIgMC0yLjMgMC0zLjQuMWwtMjguOC00Ny41YzItMy4yIDMuMi03IDMuMi0xMS4xIDAtMTEuNS05LjQtMjAuOS0yMC45LTIwLjlTMTYgMjQzIDExNiAyNTQuNXM5LjQgMjAuOSAyMC45IDIwLjljOC40IDAgMTUuNi00LjkgMTkuMS0xMi4xbDI4LjggNDcuNWMtOC43IDcuNy0xNC4yIDEzLjktMTQuMiAzMS4xIDAgMjMgMTguNyA0MS43IDQxLjcgNDEuN3M0MS43LTE4LjcgNDEuNy00MS43YzAtMi0uMi0zLjktLjUtNS44bDkwLjgtOC4yYzcuNSA4LjMgMTguMyAxMy42IDMwLjQgMTMuNnMyMy00LjEgMzAuNC0xMy42bDkwLjggOC4yYy0uMyAxLjktLjUgMy44LS41IDUuOCAwIDIzIDE4LjcgNDEuNyA0MS43IDQxLjdzNDEuNy0xOC43IDQxLjctNDEuN2MwLTE3LjItNS41LTI1LjUtMTQuMi0zMi4xbDI4LjgtNDcuNWMzLjUgNy4yIDEwLjcgMTIuMSAxOS4xIDEyLjEgMTEuNSAwIDIwLjktOS40IDIwLjktMjAuOXoiIGZpbGw9IiNmZTdmMmQiLz48L3N2Zz4='
    };
  }
  
  /**
   * Validate that the factory can create adapters in current environment
   */
  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let codelldbPath: string | undefined;
    let codelldbVersion: string | undefined;
    let cargoVersion: string | undefined;
    let hostTriple: string | undefined;
    
    // Check CodeLLDB
    const resolvedCodelldb = await resolveCodeLLDBExecutable();
    if (!resolvedCodelldb) {
      errors.push('CodeLLDB not found. Run: npm run build:adapter');
    } else {
      codelldbPath = resolvedCodelldb;
      codelldbVersion = await getCodeLLDBVersion() || undefined;
    }
    
    // Check Cargo
    const cargoInstalled = await checkCargoInstallation();
    if (!cargoInstalled) {
      warnings.push('Cargo not found. Install Rust from https://rustup.rs/');
    } else {
      cargoVersion = await getCargoVersion() || undefined;
    }
    
    const rustHost = await getRustHostTriple();
    if (rustHost) {
      hostTriple = rustHost;
      if (/-pc-windows-msvc/i.test(rustHost)) {
        warnings.push('Rust MSVC toolchain detected. CodeLLDB works best with the GNU toolchain (x86_64-pc-windows-gnu) or DWARF debug info.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        codelldbPath,
        codelldbVersion,
        cargoVersion,
        hostTriple,
        platform: process.platform,
        arch: process.arch,
        timestamp: new Date().toISOString()
      }
    };
  }
}
