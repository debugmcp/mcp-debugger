/**
 * Base adapter factory class for creating debug adapters
 * 
 * This abstract class provides a foundation for language-specific
 * adapter factories, ensuring consistency and compatibility across
 * different debug adapter implementations.
 * 
 * @since 0.14.1
 */

import type { IDebugAdapter } from '../interfaces/debug-adapter.js';
import type { 
  AdapterDependencies, 
  IAdapterFactory, 
  AdapterMetadata, 
  FactoryValidationResult 
} from '../interfaces/adapter-registry.js';

/**
 * Abstract base class for adapter factories
 * 
 * Language-specific adapter factories should extend this class
 * to provide their implementation details.
 */
export abstract class AdapterFactory implements IAdapterFactory {
  /**
   * Constructor
   * @param metadata - Metadata describing the adapter
   */
  constructor(protected readonly metadata: AdapterMetadata) {}

  /**
   * Get metadata about this adapter type
   * @returns Adapter metadata
   */
  getMetadata(): AdapterMetadata {
    return { ...this.metadata };
  }

  /**
   * Validate that the factory can create adapters in current environment
   * Default implementation returns valid. Override for specific validation.
   * @returns Validation result with any warnings or errors
   */
  async validate(): Promise<FactoryValidationResult> {
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Check if this adapter is compatible with a specific core version
   * @param coreVersion - The version of the core package
   * @returns true if compatible, false otherwise
   */
  isCompatibleWithCore(coreVersion: string): boolean {
    // Default implementation: always compatible
    // Override in specific factories if version checking is needed
    if (this.metadata.minimumDebuggerVersion) {
      return this.compareVersions(coreVersion, this.metadata.minimumDebuggerVersion) >= 0;
    }
    return true;
  }

  /**
   * Compare semantic version strings
   * @param version1 - First version to compare
   * @param version2 - Second version to compare
   * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  protected compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(n => parseInt(n, 10));
    const v2Parts = version2.split('.').map(n => parseInt(n, 10));
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  /**
   * Create a new adapter instance with dependencies
   * Must be implemented by language-specific factories
   * @param dependencies Required dependencies for the adapter
   * @returns New adapter instance
   */
  abstract createAdapter(dependencies: AdapterDependencies): IDebugAdapter;
}
