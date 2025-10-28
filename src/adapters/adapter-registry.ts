/**
 * Implementation of the Adapter Registry for managing debug adapters
 * 
 * @since 2.0.0
 */
import { EventEmitter } from 'events';
import { 
  IAdapterRegistry, 
  IAdapterFactory, 
  AdapterDependencies,
  AdapterInfo,
  AdapterNotFoundError,
  DuplicateRegistrationError,
  FactoryValidationError,
  AdapterRegistryConfig,
  AdapterFactoryMap,
  ActiveAdapterMap
} from '@debugmcp/shared';
import { IDebugAdapter, AdapterConfig } from '@debugmcp/shared';
import { AdapterLoader } from './adapter-loader.js';
import type { AdapterMetadata } from './adapter-loader.js';

/**
 * Default registry configuration
 */
const DEFAULT_CONFIG: Required<AdapterRegistryConfig> = {
  validateOnRegister: true,
  allowOverride: false,
  maxInstancesPerLanguage: 10,
  autoDispose: true,
  autoDisposeTimeout: 300000, // 5 minutes
};

/**
 * Implementation of the adapter registry
 */
export class AdapterRegistry extends EventEmitter implements IAdapterRegistry {
  private readonly factories: AdapterFactoryMap = new Map();
  private readonly activeAdapters: ActiveAdapterMap = new Map();
  private readonly config: Required<AdapterRegistryConfig>;
  private readonly disposeTimers = new Map<IDebugAdapter, NodeJS.Timeout>();
  private readonly loader = new AdapterLoader();
  // Dynamic loading is opt-in via constructor config to preserve backward compatibility in unit tests
  private readonly dynamicEnabled: boolean;

  constructor(config: AdapterRegistryConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Enable dynamic loading only when explicitly requested (default false to keep legacy behavior in tests)
    this.dynamicEnabled = Boolean(
      (config as unknown as { enableDynamicLoading?: boolean })?.enableDynamicLoading ??
      (process.env.MCP_CONTAINER === 'true')
    );
  }

  /**
   * Register a new adapter factory for a language
   */
  async register(language: string, factory: IAdapterFactory): Promise<void> {
    // Check for duplicate registration
    if (this.factories.has(language) && !this.config.allowOverride) {
      throw new DuplicateRegistrationError(language);
    }

    // Validate factory if configured
    if (this.config.validateOnRegister) {
      const validationResult = await factory.validate();
      if (!validationResult.valid) {
        throw new FactoryValidationError(language, validationResult);
      }
    }

    // Register the factory
    this.factories.set(language, factory);
    this.emit('factoryRegistered', language, factory.getMetadata());
  }

  /**
   * Unregister an adapter factory
   */
  unregister(language: string): boolean {
    const factory = this.factories.get(language);
    if (!factory) {
      return false;
    }

    // Dispose all active adapters for this language
    const activeSet = this.activeAdapters.get(language);
    if (activeSet) {
      for (const adapter of activeSet) {
        adapter.dispose().catch(err => {
          this.emit('error', new Error(`Failed to dispose adapter: ${err.message}`));
        });
        this.clearDisposeTimer(adapter);
      }
      this.activeAdapters.delete(language);
    }

    // Remove the factory
    this.factories.delete(language);
    this.emit('factoryUnregistered', language);
    return true;
  }

  /**
   * Create a new adapter instance for the specified language
   */
  async create(language: string, config: AdapterConfig): Promise<IDebugAdapter> {
    let factory = this.factories.get(language);
    if (!factory) {
      if (this.dynamicEnabled) {
        try {
          const loadedFactory = await this.loader.loadAdapter(language);
          // Register but also use the loadedFactory directly to avoid undefined from map lookup
          await this.register(language, loadedFactory);
          factory = loadedFactory;
        } catch {
          // If load fails, include dynamically detected languages (installed ones)
          const available = await this.listLanguages().catch(() => this.getSupportedLanguages());
          throw new AdapterNotFoundError(language, available);
        }
      } else {
        // Legacy behavior: not dynamically loading -> throw not found using registered languages only
        throw new AdapterNotFoundError(language, this.getSupportedLanguages());
      }
    }

    // Check instance limit
    const activeSet = this.activeAdapters.get(language) || new Set();
    if (activeSet.size >= this.config.maxInstancesPerLanguage) {
      throw new Error(
        `Maximum adapter instances (${this.config.maxInstancesPerLanguage}) reached for language: ${language}`
      );
    }

    // Create dependencies for the adapter
    const dependencies = await this.createDependencies(config);

    // Create the adapter
    const adapter = factory.createAdapter(dependencies);
    
    // Initialize the adapter
    await adapter.initialize();

    // Track the active adapter
    if (!this.activeAdapters.has(language)) {
      this.activeAdapters.set(language, new Set());
    }
    this.activeAdapters.get(language)!.add(adapter);

    // Set up auto-dispose if configured
    if (this.config.autoDispose) {
      this.setupAutoDispose(language, adapter);
    }

    // Listen for adapter disposal
    adapter.once('disposed', () => {
      const set = this.activeAdapters.get(language);
      if (set) {
        set.delete(adapter);
        if (set.size === 0) {
          this.activeAdapters.delete(language);
        }
      }
    });

    this.emit('adapterCreated', language, adapter);
    return adapter;
  }

  /**
   * Get list of all supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.factories.has(language);
  }

  /**
   * Get metadata about a registered adapter
   */
  getAdapterInfo(language: string): AdapterInfo | undefined {
    const factory = this.factories.get(language);
    if (!factory) {
      return undefined;
    }

    const metadata = factory.getMetadata();
    const activeSet = this.activeAdapters.get(language);
    
    return {
      ...metadata,
      language,
      available: true,
      activeInstances: activeSet?.size || 0,
      registeredAt: new Date(), // In a real implementation, track this
    };
  }

  /**
   * Get all registered adapter information
   */
  getAllAdapterInfo(): Map<string, AdapterInfo> {
    const result = new Map<string, AdapterInfo>();
    
    for (const [language] of this.factories) {
      const info = this.getAdapterInfo(language);
      if (info) {
        result.set(language, info);
      }
    }
    
    return result;
  }

  /**
   * List languages that are actually installed and available via dynamic loader
   */
  async listLanguages(): Promise<string[]> {
    const registered = this.getSupportedLanguages();

    if (!this.dynamicEnabled) {
      // Without dynamic loading, advertise the statically registered adapters.
      return registered;
    }

    const installed = new Set<string>();

    try {
      const adapters = await this.loader.listAvailableAdapters();
      for (const adapter of adapters) {
        if (adapter.installed) {
          installed.add(adapter.name);
        }
      }
    } catch {
      // Ignore loader errors in bundled environments where adapters are embedded.
    }

    // Always include statically registered adapters so bundled builds expose them.
    for (const language of registered) {
      installed.add(language);
    }

    return Array.from(installed);
  }

  /**
   * List detailed adapter metadata (known + install status)
   */
  async listAvailableAdapters(): Promise<AdapterMetadata[]> {
    const registered = new Set(this.getSupportedLanguages());

    const buildEntry = (language: string): AdapterMetadata => ({
      name: language,
      packageName: `@debugmcp/adapter-${language}`,
      description: undefined,
      installed: true
    });

    if (!this.dynamicEnabled) {
      // Provide minimal metadata from registered factories
      return Array.from(registered).map(buildEntry);
    }

    const results = new Map<string, AdapterMetadata>();
    try {
      const adapters = await this.loader.listAvailableAdapters();
      for (const adapter of adapters) {
        const installed = registered.has(adapter.name) ? true : adapter.installed;
        results.set(adapter.name, { ...adapter, installed });
        registered.delete(adapter.name);
      }
    } catch {
      // Ignore loader failures and fall back to registered adapters.
    }

    for (const language of registered) {
      results.set(language, buildEntry(language));
    }

    return Array.from(results.values());
  }

  /**
   * Dispose all created adapters and clear registry
   */
  async disposeAll(): Promise<void> {
    const disposePromises: Promise<void>[] = [];

    // Dispose all active adapters
    for (const [language, activeSet] of this.activeAdapters) {
      for (const adapter of activeSet) {
        disposePromises.push(
          adapter.dispose().catch(err => {
            this.emit('error', new Error(`Failed to dispose adapter for ${language}: ${err.message}`));
          })
        );
      }
    }

    // Clear all dispose timers
    for (const timer of this.disposeTimers.values()) {
      clearTimeout(timer);
    }
    this.disposeTimers.clear();

    // Wait for all disposals to complete
    await Promise.all(disposePromises);

    // Clear all tracking
    this.activeAdapters.clear();
    this.factories.clear();
    
    this.emit('registryDisposed');
  }

  /**
   * Get count of active adapter instances
   */
  getActiveAdapterCount(): number {
    let count = 0;
    for (const activeSet of this.activeAdapters.values()) {
      count += activeSet.size;
    }
    return count;
  }

  /**
   * Create dependencies for adapter creation
   */
  private async createDependencies(config: AdapterConfig): Promise<AdapterDependencies> {
    // In a real implementation, these would be injected or created from a container
    // For now, we'll import the implementations directly
    const { createProductionDependencies } = await import('../container/dependencies.js');
    const deps = createProductionDependencies({
      logLevel: 'debug',
      logFile: `${config.logDir}/${config.sessionId}.log`
    });
    
    return {
      fileSystem: deps.fileSystem,
      logger: deps.logger,
      environment: deps.environment,
      processLauncher: deps.processLauncher,
      networkManager: deps.networkManager,
    };
  }

  /**
   * Set up auto-dispose for an adapter
   */
  private setupAutoDispose(language: string, adapter: IDebugAdapter): void {
    this.clearDisposeTimer(adapter);

    // Listen for adapter state changes
    adapter.on('stateChanged', (oldState, newState) => {
      if (newState === 'disconnected' || newState === 'error') {
        // Start dispose timer
        const timer = setTimeout(() => {
          adapter.dispose().catch(err => {
            this.emit('error', new Error(`Auto-dispose failed: ${err.message}`));
          });
        }, this.config.autoDisposeTimeout);

        this.disposeTimers.set(adapter, timer);
      } else if (newState === 'connected' || newState === 'debugging') {
        // Cancel dispose timer if adapter becomes active again
        this.clearDisposeTimer(adapter);
      }
    });
  }

  private clearDisposeTimer(adapter: IDebugAdapter): void {
    const timer = this.disposeTimers.get(adapter);
    if (timer) {
      clearTimeout(timer);
      this.disposeTimers.delete(adapter);
    }
  }
}

/**
 * Create a singleton instance of the adapter registry
 */
let registryInstance: AdapterRegistry | null = null;

/**
 * Get the singleton adapter registry instance
 */
export function getAdapterRegistry(config?: AdapterRegistryConfig): AdapterRegistry {
  if (!registryInstance) {
    registryInstance = new AdapterRegistry(config);
  }
  return registryInstance;
}

/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetAdapterRegistry(): void {
  if (registryInstance) {
    registryInstance.disposeAll().catch(() => {
      // Ignore errors during reset
    });
    registryInstance = null;
  }
}
