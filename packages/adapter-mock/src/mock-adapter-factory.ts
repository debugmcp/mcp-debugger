/**
 * Mock Adapter Factory implementation
 * 
 * Creates instances of the MockDebugAdapter for testing purposes.
 * 
 * @since 2.0.0
 */
import { 
  IAdapterFactory, 
  AdapterDependencies,
  AdapterMetadata,
  FactoryValidationResult
} from '@debugmcp/shared';
import { IDebugAdapter } from '@debugmcp/shared';
import { MockDebugAdapter, MockAdapterConfig } from './mock-debug-adapter.js';
import { DebugLanguage } from '@debugmcp/shared';

/**
 * Factory for creating mock debug adapter instances
 */
export class MockAdapterFactory implements IAdapterFactory {
  private readonly config: MockAdapterConfig;
  
  constructor(config: MockAdapterConfig = {}) {
    this.config = config;
  }
  
  /**
   * Create a new mock adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new MockDebugAdapter(dependencies, this.config);
  }
  
  /**
   * Get metadata about the mock adapter
   */
  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.MOCK,
      displayName: 'Mock Debug Adapter',
      version: '1.0.0',
      author: 'MCP Debugger Team',
      description: 'Mock debug adapter for testing the MCP debugger without external dependencies',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/docs/mock-adapter',
      minimumDebuggerVersion: '2.0.0',
      fileExtensions: ['.mock', '.test'],
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyUzYuNDggMjIgMTIgMjJTMjIgMTcuNTIgMjIgMTJTMTcuNTIgMiAxMiAyWk0xMiAyMEM4LjEzIDIwIDUgMTYuODcgNSAxMlM4LjEzIDQgMTIgNFMxOSA3LjEzIDE5IDEyUzE1Ljg3IDIwIDEyIDIwWk0xMiA2QzkuNzkgNiA4IDcuNzkgOCAxMFM5Ljc5IDE0IDEyIDE0UzE2IDEyLjIxIDE2IDEwUzE0LjIxIDYgMTIgNloiIGZpbGw9IiMwMDAwMDAiLz4KPC9zdmc+'
    };
  }
  
  /**
   * Validate that the factory can create adapters
   */
  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Mock adapter has no real requirements, but we can simulate some checks
    try {
      // Check if Node.js is available (always true in our environment)
      if (!process.version) {
        errors.push('Node.js runtime not detected');
      }
      
      // Simulate a warning for demonstration
      if (this.config.errorProbability && this.config.errorProbability > 0.5) {
        warnings.push(`High error probability configured: ${this.config.errorProbability * 100}%`);
      }
      
      // Check for conflicting configuration
      if (this.config.defaultDelay && this.config.defaultDelay > 1000) {
        warnings.push(`High default delay configured: ${this.config.defaultDelay}ms may slow down tests`);
      }
      
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        config: this.config
      }
    };
  }
}

/**
 * Create a default mock adapter factory
 */
export function createMockAdapterFactory(config?: MockAdapterConfig): MockAdapterFactory {
  return new MockAdapterFactory(config);
}
