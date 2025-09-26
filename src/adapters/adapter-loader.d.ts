import { IAdapterFactory } from '@debugmcp/shared';
import type { Logger as WinstonLogger } from 'winston';
export interface ModuleLoader {
    load(modulePath: string): Promise<Record<string, unknown>>;
}
export interface AdapterMetadata {
    name: string;
    packageName: string;
    description?: string;
    installed: boolean;
}
export declare class AdapterLoader {
    private cache;
    private logger;
    private moduleLoader;
    constructor(logger?: WinstonLogger, moduleLoader?: ModuleLoader);
    private createDefaultModuleLoader;
    /**
     * Dynamically load an adapter by language name
     */
    loadAdapter(language: string): Promise<IAdapterFactory>;
    /**
     * Check if an adapter is available (and cache it if so)
     */
    isAdapterAvailable(language: string): Promise<boolean>;
    /**
     * List all potentially available adapters (known list for now)
     */
    listAvailableAdapters(): Promise<AdapterMetadata[]>;
    private getPackageName;
    /**
     * Compute a monorepo fallback path to the adapter dist entry.
     * This supports running from the source tree and inside the Docker image where packages are copied.
     */
    private getFallbackModulePath;
    private getFallbackModulePaths;
    private getFactoryClassName;
}
