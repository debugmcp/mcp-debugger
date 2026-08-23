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
  register(language: string, factory: IAdapterFactory): Promise<void>;
  
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
   * List every known language, registered or dynamically loadable.
   */
  listLanguages(): Promise<string[]>;

  /**
   * List every known adapter with its install state and attach mechanism.
   */
  listAvailableAdapters(): Promise<AdapterManifestEntry[]>;

  /**
   * Get the factory for a language, dynamically loading it when enabled.
   * Returns undefined when no factory can be produced (never throws) — use
   * getFactoryResult when the failure reason matters.
   *
   * These four members are the typed surface behind issue #435 part 4: the
   * availability probe and launch gate used to reach them through
   * `as unknown as` duck-typing, so a rename on the concrete registry
   * compiled clean and silently degraded every language to fail-open.
   */
  getFactory(language: string): Promise<IAdapterFactory | undefined>;

  /**
   * Get a language's metadata without registering or instantiating anything.
   */
  getFactoryMetadata(language: string): Promise<AdapterMetadata | undefined>;

  /**
   * Diagnostics variant of getFactory: never throws, and carries the load
   * failure so doctor can report the real import error instead of "the
   * registry returned no factory". Optional so minimal registry doubles
   * that stub only getFactory keep working; consumers must treat absence
   * as "use getFactory".
   */
  getFactoryResult?(language: string): Promise<FactoryLoadResult>;

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

  /**
   * Doctor-only presentation of the resolved toolchain (issue #435): the
   * adapter owns its own runtime/backend row instead of the CLI restating
   * adapter internals. Receives a snapshot of the just-computed validate()
   * result so the producer and consumer of each `details` key live in the
   * same class; may run additional best-effort probes, bounded by the
   * advisory options.timeoutMs (use probeWithinBudget so the method resolves
   * before the caller's hard timeout — a hard timeout blanks the whole row).
   * Must not throw for a missing toolchain — omit the cell instead
   * (toolchainComponent enforces this; '('-prefixed labels are the one
   * standalone exception, see ToolchainComponent.label). Absent method →
   * doctor renders empty cells with a version-skew warning.
   */
  describeToolchain?(
    validation: FactoryValidationResult,
    options?: DescribeToolchainOptions
  ): Promise<ToolchainDescription>;
}

/**
 * Dependencies injected into adapters
 */
export interface AdapterDependencies {
  fileSystem: IFileSystem;
  logger: ILogger;
  environment: IEnvironment;
  networkManager?: INetworkManager;
}

/**
 * How an adapter implements attach mode.
 * - 'none': attach is not implemented
 * - 'direct-connect': attach connects straight to a DAP socket exposed by the
 *   debuggee (e.g. debugpy --listen, rdbg --open) — no local toolchain needed
 * - 'spawn': attach spawns a local debug adapter process (needs its toolchain)
 */
export type AttachMechanism = 'none' | 'direct-connect' | 'spawn';

/**
 * Per-mode capability declaration for an adapter.
 */
export interface AdapterModes {
  /** Whether the adapter implements launch mode */
  launch: boolean;

  /** How the adapter implements attach mode */
  attach: AttachMechanism;
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

  /**
   * Per-mode capability declaration.
   * Absent means { launch: true, attach: 'none' }.
   */
  modes?: AdapterModes;
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

/**
 * A known-adapter manifest entry, as reported by
 * IAdapterRegistry.listAvailableAdapters(): the static facts about an
 * adapter package independent of whether its factory has been loaded.
 */
export interface AdapterManifestEntry {
  /** Language identifier, e.g. 'python' */
  name: string;

  /** npm package name, e.g. '@debugmcp/adapter-python' */
  packageName: string;

  /** Human-readable description */
  description?: string;

  /** Whether the adapter package is installed in this runtime */
  installed: boolean;

  /** How the adapter implements attach; absent means unknown (treat as 'none') */
  attach?: AttachMechanism;
}

/**
 * Outcome of a non-throwing factory-load attempt
 * (IAdapterRegistry.getFactoryResult). Exactly one of the fields is set.
 */
export interface FactoryLoadResult {
  /** The loaded factory, when one could be produced */
  factory?: IAdapterFactory;

  /** Set when a dynamic load was attempted and failed */
  loadError?: Error;

  /** Set when nothing is registered/cached and dynamic loading is disabled */
  dynamicLoadingDisabled?: boolean;
}

/**
 * One resolved toolchain component (a doctor table cell): the runtime a
 * debuggee needs (Python, Node.js, a C++ compiler) or the debug backend that
 * drives it (debugpy, js-debug, CodeLLDB).
 */
export interface ToolchainComponent {
  /**
   * Display name, e.g. 'Python', 'CodeLLDB', '(built-in)'. A label starting
   * with '(' is a standalone annotation: it renders by itself even when no
   * path/version/source was detected (and the table renders ONLY the label),
   * so use the prefix exclusively for cells that are not real detections.
   */
  label: string;

  /** Resolved executable/directory path, when detected */
  path?: string;

  /** Resolved version, when detected */
  version?: string;

  /** Where the component came from, e.g. 'vendored', 'env:CODELLDB_PATH' */
  source?: string;
}

/**
 * An adapter's own doctor row (issue #435). Absent cells render as empty —
 * a component that was not detected must be omitted, not named as if found.
 */
export interface ToolchainDescription {
  runtime?: ToolchainComponent;
  backend?: ToolchainComponent;
}

/**
 * Options for IAdapterFactory.describeToolchain.
 */
export interface DescribeToolchainOptions {
  /** Advisory budget for extra probes; the caller also enforces a hard timeout. */
  timeoutMs?: number;
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

  /**
   * Whether to load adapter packages on demand via AdapterLoader when no
   * factory is registered. Defaults to false; MCP_CONTAINER=true also
   * enables it.
   */
  enableDynamicLoading?: boolean;

  /**
   * Sink for discovery-fallback warnings (loader failures, malformed factory
   * metadata). Injected by the DI container so registry breadcrumbs follow
   * the configured log level/file instead of a per-instance logger piping
   * into the process-lifetime transport (issue #404 leak class). Absent →
   * warnings are dropped.
   */
  logger?: { warn?: (message: string) => void };
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
    'getSupportedLanguages' in obj &&
    // The typed discovery surface (issue #435 part 4): certifying a legacy
    // three-method registry would hand callers of these required members a
    // runtime TypeError with no compile-time warning.
    'listLanguages' in obj &&
    'listAvailableAdapters' in obj &&
    'getFactory' in obj &&
    'getFactoryMetadata' in obj
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
import type { INetworkManager } from './external-dependencies.js';
