import { IAdapterFactory } from '@debugmcp/shared';
import type { Logger as WinstonLogger } from 'winston';
import { createLogger } from '../utils/logger.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

export interface AdapterMetadata {
  name: string;
  packageName: string;
  description?: string;
  installed: boolean;
}

export class AdapterLoader {
  private cache = new Map<string, IAdapterFactory>();
  private logger: WinstonLogger;

  constructor(logger?: WinstonLogger) {
    this.logger = logger || createLogger('AdapterLoader');
  }

  /**
   * Dynamically load an adapter by language name
   */
  async loadAdapter(language: string): Promise<IAdapterFactory> {
    // Check cache first
    if (this.cache.has(language)) {
      return this.cache.get(language)!;
    }

    const packageName = this.getPackageName(language);
    const factoryClassName = this.getFactoryClassName(language);

    try {
      this.logger.debug?.(`[AdapterLoader] Attempting to load adapter '${language}' from package '${packageName}'`);

      // Try primary dynamic import by package name, with a monorepo fallback
      let loadedModule: Record<string, unknown> | undefined;
      try {
        loadedModule = await import(
          /* webpackIgnore: true */
          packageName
        ) as Record<string, unknown>;
      } catch {
        // Try multiple fallback locations in order of likelihood
        const candidates = this.getFallbackModulePaths(language);
        let loaded = false;
        let lastError: unknown = undefined;
        for (const url of candidates) {
          this.logger.debug?.(`[AdapterLoader] Primary import failed for ${packageName}, trying fallback URL: ${url}`);
          try {
            loadedModule = await import(
              /* webpackIgnore: true */
              url
            ) as Record<string, unknown>;
            loaded = true;
            break;
          } catch {
            // Try createRequire for this candidate (helps in CJS/bundled contexts)
            try {
              const req = createRequire(import.meta.url);
              const fsPath = fileURLToPath(url);
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              loadedModule = req(fsPath) as Record<string, unknown>;
              this.logger.debug?.(`[AdapterLoader] Loaded via createRequire from ${fsPath}`);
              loaded = true;
              break;
            } catch (err2) {
              lastError = err2;
              continue;
            }
          }
        }
        if (!loaded) {
          // Re-throw last error to be handled by outer catch
          throw lastError ?? new Error('Adapter fallback resolution failed');
        }
      }

      if (!loadedModule) {
        throw new Error(`Failed to resolve adapter module for '${language}'`);
      }
      const moduleRef = loadedModule as Record<string, unknown>;
      const FactoryClass = moduleRef[factoryClassName] as unknown;
      if (!FactoryClass) {
        throw new Error(`Factory class ${factoryClassName} not found in ${packageName}`);
      }

      const factory: IAdapterFactory = new (FactoryClass as new () => IAdapterFactory)();
      this.cache.set(language, factory);
      this.logger.info?.(`[AdapterLoader] Loaded adapter '${language}' from ${packageName}`);
      return factory;

    } catch (error: unknown) {
      const err = (error as { code?: string; message?: string } | Error | null) ?? null;
      const errLike = err as { code?: string; message?: string } | null;
      const code = errLike?.code;
      const message = errLike?.message ?? String(error);
      const baseMsg = `Failed to load adapter for '${language}' from package '${packageName}'.`;
      if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
        const msg = `${baseMsg} Adapter not installed. Install with: npm install ${packageName}`;
        this.logger.warn?.(`[AdapterLoader] ${msg}`);
        throw new Error(msg);
      } else {
        const msg = `${baseMsg} Error: ${message}. If the package is installed, try reinstalling or rebuilding.`;
        this.logger.error?.(`[AdapterLoader] ${msg}`);
        throw new Error(msg);
      }
    }
  }

  /**
   * Check if an adapter is available (and cache it if so)
   */
  async isAdapterAvailable(language: string): Promise<boolean> {
    try {
      await this.loadAdapter(language);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all potentially available adapters (known list for now)
   */
  async listAvailableAdapters(): Promise<AdapterMetadata[]> {
    const known = [
      { name: 'mock', packageName: '@debugmcp/adapter-mock', description: 'Mock adapter for testing' },
      { name: 'python', packageName: '@debugmcp/adapter-python', description: 'Python debugger using debugpy' },
    ];

    const results: AdapterMetadata[] = [];
    for (const a of known) {
      const installed = await this.isAdapterAvailable(a.name);
      results.push({ ...a, installed });
    }
    return results;
  }

  private getPackageName(language: string): string {
    return `@debugmcp/adapter-${language.toLowerCase()}`;
  }

  /**
   * Compute a monorepo fallback path to the adapter dist entry.
   * This supports running from the source tree and inside the Docker image where packages are copied.
   */
  private getFallbackModulePath(language: string): string {
    // When bundled, import.meta.url resolves to dist/bundle.cjs
    // Prefer node_modules path in runtime images
    return new URL(`../node_modules/@debugmcp/adapter-${language}/dist/index.js`, import.meta.url).href;
  }

  // Try multiple fallback locations (node_modules first, then packages for non-container/dev images)
  private getFallbackModulePaths(language: string): string[] {
    return [
      new URL(`../node_modules/@debugmcp/adapter-${language}/dist/index.js`, import.meta.url).href,
      new URL(`../packages/adapter-${language}/dist/index.js`, import.meta.url).href
    ];
  }
 
  private getFactoryClassName(language: string): string {
    const capitalized = language.charAt(0).toUpperCase() + language.slice(1);
    return `${capitalized}AdapterFactory`;
  }
}
