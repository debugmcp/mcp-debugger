/**
 * Registry pattern for managing debug adapters
 * 
 * The AdapterRegistry provides centralized management of language-specific
 * debug adapters, including registration, discovery, and lifecycle management.
 * 
 * @since 2.0.0
 */
import { IDebugAdapter, AdapterConfig } from './debug-adapter.js';

/**
 * Registry for managing debug adapters across multiple languages
 */
export interface IAdapterRegistry {
  // ===== Registration =====
  
  /**
   * Register a new adapter factory for a language
   * @param language Language identifier (e.g., 'python', 'node')
   * @param factory Factory to create adapter instances
   * @throws Error if language is already registered
   */
  register(language: string, factory: IAdapterFactory): void;
  
  /**
   * Unregister an adapter factory
   * @param language Language identifier
   * @returns true if unregistered, false if not found
   */
  unregister(language: string): boolean;
  
  // ===== Creation =====
  
  /**
   * Create a new adapter instance for the specified language
   * @param language Language identifier
   * @param config Adapter configuration
   * @returns Initialized adapter instance
   * @throws AdapterNotFoundError if language not registered
   */
  create(language: string, config: AdapterConfig): Promise<IDebugAdapter>;
  
  // ===== Discovery =====
  
  /**
   * Get list of all supported languages
   * @returns Array of registered language identifiers
   */
  getSupportedLanguages(): string[];
  
  /**
   * Check if a language is supported
   * @param language Language identifier
   * @returns true if language has a registered adapter
   */
  isLanguageSupported(language: string): boolean;
  
  /**
   * Get metadata about a registered adapter
   * @param language Language identifier
   * @returns Adapter metadata or undefined if not found
   */
  getAdapterInfo(language: string): AdapterInfo | undefined;
  
  /**
   * Get all registered adapter information
   * @returns Map of language to adapter info
   */
  getAllAdapterInfo(): Map<string, AdapterInfo>;
  
  // ===== Lifecycle =====
  
  /**
   * Dispose all created adapters and clear registry
   */
  disposeAll(): Promise<void>;
  
  /**
   * Get count of active adapter instances
   * @returns Number of adapters currently in use
   */
  getActiveAdapterCount(): number;
}

/**
 * Factory interface for creating debug adapter instances
 */
export interface IAdapterFactory {
  /**
   * Create a new adapter instance with dependencies
   * @param dependencies Required dependencies for the adapter
   * @returns New adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter;
  
  /**
   * Get metadata about this adapter type
   * @returns Adapter metadata
   */
  getMetadata(): AdapterMetadata;
  
  /**
   * Validate that the factory can create adapters in current environment
   * @returns Validation result with any warnings or errors
   */
  validate(): Promise<FactoryValidationResult>;
}

/**
 * Dependencies injected into adapters
 */
export interface AdapterDependencies {
  fileSystem: IFileSystem;
  logger: ILogger;
  environment: IEnvironment;
  processLauncher: IProcessLauncher;
  networkManager?: INetworkManager;
}

/**
 * Metadata about an adapter
 */
export interface AdapterMetadata {
  /** Language identifier */
  language: string;
  
  /** Display name for UI */
  displayName: string;
  
  /** Adapter version */
  version: string;
  
  /** Author/maintainer */
  author: string;
  
  /** Description of adapter capabilities */
  description: string;
  
  /** URL to documentation */
  documentationUrl?: string;
  
  /** Minimum debugger version required */
  minimumDebuggerVersion?: string;
  
  /** File extensions supported */
  fileExtensions?: string[];
  
  /** Icon for UI (base64 or URL) */
  icon?: string;
}

/**
 * Combined adapter information (metadata + runtime info)
 */
export interface AdapterInfo extends AdapterMetadata {
  /** Whether adapter is currently available */
  available: boolean;
  
  /** Number of active instances */
  activeInstances: number;
  
  /** Last validation result */
  lastValidation?: FactoryValidationResult;
  
  /** Registration timestamp */
  registeredAt: Date;
}

/**
 * Factory validation result
 */
export interface FactoryValidationResult {
  /** Whether factory is valid and can create adapters */
  valid: boolean;
  
  /** Any errors preventing adapter creation */
  errors: string[];
  
  /** Warnings that don't prevent creation */
  warnings: string[];
  
  /** Additional validation details */
  details?: Record<string, unknown>;
}

// ===== Registry Implementation Helpers =====

/**
 * Base class for adapter factories (optional helper)
 */
export abstract class BaseAdapterFactory implements IAdapterFactory {
  constructor(protected metadata: AdapterMetadata) {}
  
  getMetadata(): AdapterMetadata {
    return this.metadata;
  }
  
  async validate(): Promise<FactoryValidationResult> {
    // Default validation - can be overridden
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }
  
  abstract createAdapter(dependencies: AdapterDependencies): IDebugAdapter;
}

/**
 * Registry configuration options
 */
export interface AdapterRegistryConfig {
  /** Whether to validate factories on registration */
  validateOnRegister?: boolean;
  
  /** Whether to allow re-registration of languages */
  allowOverride?: boolean;
  
  /** Maximum number of adapter instances per language */
  maxInstancesPerLanguage?: number;
  
  /** Whether to auto-dispose unused adapters */
  autoDispose?: boolean;
  
  /** Auto-dispose timeout in milliseconds */
  autoDisposeTimeout?: number;
}

// ===== Error Types =====

/**
 * Error thrown when requested adapter is not found
 */
export class AdapterNotFoundError extends Error {
  constructor(
    public language: string,
    public availableLanguages: string[]
  ) {
    super(`No debug adapter registered for language: ${language}. Available: ${availableLanguages.join(', ')}`);
    this.name = 'AdapterNotFoundError';
  }
}

/**
 * Error thrown when factory validation fails
 */
export class FactoryValidationError extends Error {
  constructor(
    public language: string,
    public validationResult: FactoryValidationResult
  ) {
    super(`Adapter factory validation failed for ${language}: ${validationResult.errors.join(', ')}`);
    this.name = 'FactoryValidationError';
  }
}

/**
 * Error thrown when trying to register duplicate language
 */
export class DuplicateRegistrationError extends Error {
  constructor(public language: string) {
    super(`Adapter already registered for language: ${language}`);
    this.name = 'DuplicateRegistrationError';
  }
}

// ===== Type Guards =====

/**
 * Check if an object implements IAdapterFactory
 */
export function isAdapterFactory(obj: unknown): obj is IAdapterFactory {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'createAdapter' in obj &&
    'getMetadata' in obj &&
    'validate' in obj
  );
}

/**
 * Check if an object implements IAdapterRegistry
 */
export function isAdapterRegistry(obj: unknown): obj is IAdapterRegistry {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'register' in obj &&
    'create' in obj &&
    'getSupportedLanguages' in obj
  );
}

// ===== Utility Types =====

/**
 * Map of language to adapter factory
 */
export type AdapterFactoryMap = Map<string, IAdapterFactory>;

/**
 * Map of language to active adapter instances
 */
export type ActiveAdapterMap = Map<string, Set<IDebugAdapter>>;

// ===== External Dependencies (imported from existing interfaces) =====

import type { IFileSystem } from './external-dependencies.js';
import type { ILogger } from './external-dependencies.js';
import type { IEnvironment } from './external-dependencies.js';
import type { IProcessLauncher } from './process-interfaces.js';
import type { INetworkManager } from './external-dependencies.js';
