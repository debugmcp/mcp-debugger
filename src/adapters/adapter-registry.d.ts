/**
 * Implementation of the Adapter Registry for managing debug adapters
 *
 * @since 2.0.0
 */
import { EventEmitter } from 'events';
import { IAdapterRegistry, IAdapterFactory, AdapterInfo, AdapterRegistryConfig } from '@debugmcp/shared';
import { IDebugAdapter, AdapterConfig } from '@debugmcp/shared';
import type { AdapterMetadata } from './adapter-loader.js';
/**
 * Implementation of the adapter registry
 */
export declare class AdapterRegistry extends EventEmitter implements IAdapterRegistry {
    private readonly factories;
    private readonly activeAdapters;
    private readonly config;
    private readonly disposeTimers;
    private readonly loader;
    private readonly dynamicEnabled;
    constructor(config?: AdapterRegistryConfig);
    /**
     * Register a new adapter factory for a language
     */
    register(language: string, factory: IAdapterFactory): Promise<void>;
    /**
     * Unregister an adapter factory
     */
    unregister(language: string): boolean;
    /**
     * Create a new adapter instance for the specified language
     */
    create(language: string, config: AdapterConfig): Promise<IDebugAdapter>;
    /**
     * Get list of all supported languages
     */
    getSupportedLanguages(): string[];
    /**
     * Check if a language is supported
     */
    isLanguageSupported(language: string): boolean;
    /**
     * Get metadata about a registered adapter
     */
    getAdapterInfo(language: string): AdapterInfo | undefined;
    /**
     * Get all registered adapter information
     */
    getAllAdapterInfo(): Map<string, AdapterInfo>;
    /**
     * List languages that are actually installed and available via dynamic loader
     */
    listLanguages(): Promise<string[]>;
    /**
     * List detailed adapter metadata (known + install status)
     */
    listAvailableAdapters(): Promise<AdapterMetadata[]>;
    /**
     * Dispose all created adapters and clear registry
     */
    disposeAll(): Promise<void>;
    /**
     * Get count of active adapter instances
     */
    getActiveAdapterCount(): number;
    /**
     * Create dependencies for adapter creation
     */
    private createDependencies;
    /**
     * Set up auto-dispose for an adapter
     */
    private setupAutoDispose;
}
/**
 * Get the singleton adapter registry instance
 */
export declare function getAdapterRegistry(config?: AdapterRegistryConfig): AdapterRegistry;
/**
 * Reset the singleton instance (mainly for testing)
 */
export declare function resetAdapterRegistry(): void;
