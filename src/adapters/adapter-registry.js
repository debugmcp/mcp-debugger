/**
 * Implementation of the Adapter Registry for managing debug adapters
 *
 * @since 2.0.0
 */
import { EventEmitter } from 'events';
import { AdapterNotFoundError, DuplicateRegistrationError, FactoryValidationError } from '@debugmcp/shared';
import { AdapterLoader } from './adapter-loader.js';
/**
 * Default registry configuration
 */
const DEFAULT_CONFIG = {
    validateOnRegister: true,
    allowOverride: false,
    maxInstancesPerLanguage: 10,
    autoDispose: true,
    autoDisposeTimeout: 300000, // 5 minutes
};
/**
 * Implementation of the adapter registry
 */
export class AdapterRegistry extends EventEmitter {
    factories = new Map();
    activeAdapters = new Map();
    config;
    disposeTimers = new Map();
    loader = new AdapterLoader();
    // Dynamic loading is opt-in via constructor config to preserve backward compatibility in unit tests
    dynamicEnabled;
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Enable dynamic loading only when explicitly requested (default false to keep legacy behavior in tests)
        this.dynamicEnabled = Boolean(config?.enableDynamicLoading ??
            (process.env.MCP_CONTAINER === 'true'));
    }
    /**
     * Register a new adapter factory for a language
     */
    async register(language, factory) {
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
    unregister(language) {
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
            }
            this.activeAdapters.delete(language);
        }
        // Clear any dispose timers
        const timer = this.disposeTimers.get(language);
        if (timer) {
            clearTimeout(timer);
            this.disposeTimers.delete(language);
        }
        // Remove the factory
        this.factories.delete(language);
        this.emit('factoryUnregistered', language);
        return true;
    }
    /**
     * Create a new adapter instance for the specified language
     */
    async create(language, config) {
        let factory = this.factories.get(language);
        if (!factory) {
            if (this.dynamicEnabled) {
                try {
                    const loadedFactory = await this.loader.loadAdapter(language);
                    // Register but also use the loadedFactory directly to avoid undefined from map lookup
                    await this.register(language, loadedFactory);
                    factory = loadedFactory;
                }
                catch {
                    // If load fails, include dynamically detected languages (installed ones)
                    const available = await this.listLanguages().catch(() => this.getSupportedLanguages());
                    throw new AdapterNotFoundError(language, available);
                }
            }
            else {
                // Legacy behavior: not dynamically loading -> throw not found using registered languages only
                throw new AdapterNotFoundError(language, this.getSupportedLanguages());
            }
        }
        // Check instance limit
        const activeSet = this.activeAdapters.get(language) || new Set();
        if (activeSet.size >= this.config.maxInstancesPerLanguage) {
            throw new Error(`Maximum adapter instances (${this.config.maxInstancesPerLanguage}) reached for language: ${language}`);
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
        this.activeAdapters.get(language).add(adapter);
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
    getSupportedLanguages() {
        return Array.from(this.factories.keys());
    }
    /**
     * Check if a language is supported
     */
    isLanguageSupported(language) {
        return this.factories.has(language);
    }
    /**
     * Get metadata about a registered adapter
     */
    getAdapterInfo(language) {
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
    getAllAdapterInfo() {
        const result = new Map();
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
    async listLanguages() {
        if (!this.dynamicEnabled) {
            // Fall back to currently registered languages
            return this.getSupportedLanguages();
        }
        const adapters = await this.loader.listAvailableAdapters();
        return adapters.filter(a => a.installed).map(a => a.name);
    }
    /**
     * List detailed adapter metadata (known + install status)
     */
    async listAvailableAdapters() {
        if (!this.dynamicEnabled) {
            // Provide minimal metadata from registered factories
            const langs = this.getSupportedLanguages();
            return langs.map(l => ({
                name: l,
                packageName: `@debugmcp/adapter-${l}`,
                description: undefined,
                installed: true
            }));
        }
        return this.loader.listAvailableAdapters();
    }
    /**
     * Dispose all created adapters and clear registry
     */
    async disposeAll() {
        const disposePromises = [];
        // Dispose all active adapters
        for (const [language, activeSet] of this.activeAdapters) {
            for (const adapter of activeSet) {
                disposePromises.push(adapter.dispose().catch(err => {
                    this.emit('error', new Error(`Failed to dispose adapter for ${language}: ${err.message}`));
                }));
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
    getActiveAdapterCount() {
        let count = 0;
        for (const activeSet of this.activeAdapters.values()) {
            count += activeSet.size;
        }
        return count;
    }
    /**
     * Create dependencies for adapter creation
     */
    async createDependencies(config) {
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
    setupAutoDispose(language, adapter) {
        // Clear any existing timer for this language
        const existingTimer = this.disposeTimers.get(`${language}-${adapter}`);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        // Listen for adapter state changes
        adapter.on('stateChanged', (oldState, newState) => {
            if (newState === 'disconnected' || newState === 'error') {
                // Start dispose timer
                const timer = setTimeout(() => {
                    adapter.dispose().catch(err => {
                        this.emit('error', new Error(`Auto-dispose failed: ${err.message}`));
                    });
                }, this.config.autoDisposeTimeout);
                this.disposeTimers.set(`${language}-${adapter}`, timer);
            }
            else if (newState === 'connected' || newState === 'debugging') {
                // Cancel dispose timer if adapter becomes active again
                const timer = this.disposeTimers.get(`${language}-${adapter}`);
                if (timer) {
                    clearTimeout(timer);
                    this.disposeTimers.delete(`${language}-${adapter}`);
                }
            }
        });
    }
}
/**
 * Create a singleton instance of the adapter registry
 */
let registryInstance = null;
/**
 * Get the singleton adapter registry instance
 */
export function getAdapterRegistry(config) {
    if (!registryInstance) {
        registryInstance = new AdapterRegistry(config);
    }
    return registryInstance;
}
/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetAdapterRegistry() {
    if (registryInstance) {
        registryInstance.disposeAll().catch(() => {
            // Ignore errors during reset
        });
        registryInstance = null;
    }
}
//# sourceMappingURL=adapter-registry.js.map