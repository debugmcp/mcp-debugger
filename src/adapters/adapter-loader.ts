import { IAdapterFactory, AttachMechanism, AdapterManifestEntry } from '@debugmcp/shared';
import type { Logger as WinstonLogger } from 'winston';
import { createLogger } from '../utils/logger.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { promises as fsPromises } from 'fs';
import { dirname, join } from 'path';
import { getErrorMessage } from '../errors/debug-errors.js';
import { ErrorMessages } from '../utils/error-messages.js';

export interface ModuleLoader {
  load(modulePath: string): Promise<Record<string, unknown>>;
}

/** One failed import during loadAdapter: what was asked for, and how it failed. */
interface ImportAttempt {
  specifier: string;
  error: unknown;
}

const MODULE_NOT_FOUND_CODES = new Set(['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND']);

/** The specifier Node's module-not-found message names, when it names one. */
function missingSpecifierOf(message: string): string | undefined {
  return /Cannot find (?:package|module) '([^']+)'/.exec(message)?.[1];
}

/** A bare package specifier — not a path or URL: the shape a missing dependency takes. */
function isBareSpecifier(specifier: string): boolean {
  return !/^(?:\.{1,2}[\\/]|[\\/]|[A-Za-z]:[\\/]|file:)/.test(specifier);
}

/**
 * Whether a failed import says no more than "the thing you asked for is not
 * there": module-not-found naming the bare package, the candidate path
 * itself, or nothing at all. Such an attempt tells the user nothing the next
 * would not; an error naming anything else — a dependency the package
 * imports, a file inside it — is the one worth reporting (issue #795).
 */
function namesOnlyItself(attempt: ImportAttempt, packageName: string): boolean {
  const code = (attempt.error as { code?: string } | null)?.code;
  if (code === undefined || !MODULE_NOT_FOUND_CODES.has(code)) return false;
  const missing = missingSpecifierOf(getErrorMessage(attempt.error));
  return missing === undefined || missing === packageName || missing === attempt.specifier;
}

function tryFileURLToPath(url: string): string | undefined {
  try {
    return fileURLToPath(url);
  } catch {
    return undefined;
  }
}

/**
 * Metadata-only availability probe: is the adapter package (or a monorepo
 * fallback build) present on disk? Deliberately does NOT execute the module —
 * merely listing tools must not drag every installed adapter package into the
 * heap (issue #401). Full import + factory instantiation stays in loadAdapter,
 * i.e. the first real use of a language.
 */
export interface PackageResolver {
  isInstalled(packageName: string, fallbackUrls: string[]): Promise<boolean>;
}

export function createDefaultPackageResolver(io: {
  /** Node-resolve a bare package specifier to a file path. Default: createRequire(import.meta.url).resolve */
  resolve?: (id: string) => string;
  /** Check a file path exists. Default: fs.promises.access */
  access?: (fsPath: string) => Promise<void>;
} = {}): PackageResolver {
  const resolve = io.resolve ?? ((id: string) => createRequire(import.meta.url).resolve(id));
  const access = io.access ?? (async (fsPath: string) => { await fsPromises.access(fsPath); });
  return {
    async isInstalled(packageName: string, fallbackUrls: string[]): Promise<boolean> {
      // The entry, or failing that the manifest: a package whose built output
      // was wiped (or never built) is still on disk, and "npm install" is not
      // the remedy for it (issue #795).
      for (const specifier of [packageName, `${packageName}/package.json`]) {
        try {
          resolve(specifier);
          return true;
        } catch (error) {
          // An exports map that hides the CJS entry (or the manifest) still
          // proves the package is present on disk (ESM-only packages under
          // require.resolve).
          if ((error as { code?: string })?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
            return true;
          }
        }
      }
      for (const url of fallbackUrls) {
        // Each candidate is <package dir>/dist/index.js; the manifest sits two
        // levels up.
        const entry = fileURLToPath(url);
        for (const fsPath of [entry, join(dirname(dirname(entry)), 'package.json')]) {
          try {
            await access(fsPath);
            return true;
          } catch {
            // try next candidate
          }
        }
      }
      return false;
    }
  };
}

/**
 * The loader's manifest entry — the shared AdapterManifestEntry with attach
 * required (the known-adapter list always declares it). Kept as a distinct
 * name because shared's AdapterMetadata is the factory-declared metadata, a
 * different shape entirely.
 */
export interface AdapterMetadata extends AdapterManifestEntry {
  /** How the adapter implements attach mode (static knowledge; kept in sync with each factory's declaration) */
  attach: AttachMechanism;
}

export class AdapterLoader {
  private cache = new Map<string, IAdapterFactory>();
  private logger: WinstonLogger;
  private moduleLoader: ModuleLoader;
  private resolver: PackageResolver;

  constructor(logger?: WinstonLogger, moduleLoader?: ModuleLoader, resolver?: PackageResolver) {
    this.logger = logger || createLogger('AdapterLoader');
    this.moduleLoader = moduleLoader || this.createDefaultModuleLoader();
    this.resolver = resolver || createDefaultPackageResolver();
  }

  private createDefaultModuleLoader(): ModuleLoader {
    return {
      load: async (modulePath: string) => {
        return await import(
          /* webpackIgnore: true */
          modulePath
        ) as Record<string, unknown>;
      }
    };
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
        loadedModule = await this.moduleLoader.load(packageName);
      } catch (primaryError) {
        // Every failed attempt is kept (issue #795): the one to report is the
        // first whose error names something other than the specifier it was
        // itself asked for — a dependency the package imports, a broken dist —
        // where a candidate that is simply absent says only that.
        const attempts: ImportAttempt[] = [{ specifier: packageName, error: primaryError }];
        let loaded = false;
        for (const url of this.getFallbackModulePaths(language)) {
          this.logger.debug?.(`[AdapterLoader] Primary import failed for ${packageName}, trying fallback URL: ${url}`);
          try {
            loadedModule = await this.moduleLoader.load(url);
            loaded = true;
            break;
          } catch (esmError) {
            attempts.push({ specifier: url, error: esmError });
          }
          // Try createRequire for this candidate (helps in CJS/bundled contexts)
          const fsPath = tryFileURLToPath(url);
          if (fsPath === undefined) continue;
          try {
            const req = createRequire(import.meta.url);
            loadedModule = req(fsPath) as Record<string, unknown>;
            this.logger.debug?.(`[AdapterLoader] Loaded via createRequire from ${fsPath}`);
            loaded = true;
            break;
          } catch (requireError) {
            attempts.push({ specifier: fsPath, error: requireError });
          }
        }
        if (!loaded) {
          this.logger.warn?.(
            `[AdapterLoader] Every import of ${packageName} failed: ` +
              attempts.map((attempt) => `${attempt.specifier}: ${getErrorMessage(attempt.error)}`).join(' | ')
          );
          throw (attempts.find((attempt) => !namesOnlyItself(attempt, packageName)) ?? attempts[0]).error;
        }
      }

      if (!loadedModule) {
        throw new Error(`Failed to resolve adapter module for '${language}'`);
      }
      const moduleRef = loadedModule as Record<string, unknown>;
      const FactoryClass = moduleRef[factoryClassName];
      if (!FactoryClass) {
        throw new Error(`Factory class ${factoryClassName} not found in ${packageName}`);
      }

      const factory: IAdapterFactory = new (FactoryClass as new () => IAdapterFactory)();
      this.cache.set(language, factory);
      this.logger.info?.(`[AdapterLoader] Loaded adapter '${language}' from ${packageName}`);
      return factory;

    } catch (error: unknown) {
      const code = (error as { code?: string } | null)?.code;
      const message = getErrorMessage(error);
      const moduleNotFound = code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND';
      // A module-not-found code alone does not mean the ADAPTER is missing
      // (issue #795): an installed package whose own import fails — a
      // transitive dependency absent from the image — raises the very same
      // code. Only a package the resolver cannot find on disk is "not
      // installed"; everything else is reported with the import's own words.
      const installed = moduleNotFound
        ? await this.resolver.isInstalled(packageName, this.getFallbackModulePaths(language)).catch(() => false)
        : true;
      if (moduleNotFound && !installed) {
        const msg = ErrorMessages.adapterLoad.notInstalled(language, packageName);
        this.logger.warn?.(`[AdapterLoader] ${msg}`);
        throw new Error(msg, { cause: error });
      }
      if (moduleNotFound) {
        // Only a bare specifier is a dependency the package imports; a path —
        // the package's own dist, a nested dependency's broken main — is left
        // to Node's words, which already name it.
        const missing = missingSpecifierOf(message);
        const dependency =
          missing !== undefined && missing !== packageName && isBareSpecifier(missing) ? missing : undefined;
        const msg = ErrorMessages.adapterLoad.importFailed(language, packageName, message, dependency);
        this.logger.error?.(`[AdapterLoader] ${msg}`);
        throw new Error(msg, { cause: error });
      }
      const msg = ErrorMessages.adapterLoad.failed(language, packageName, message);
      this.logger.error?.(`[AdapterLoader] ${msg}`);
      throw new Error(msg, { cause: error });
    }
  }

  /**
   * Check if an adapter is available. Metadata-only: probes package presence
   * via the resolver without importing or instantiating anything (issue #401).
   * A factory already loaded for real short-circuits to true. Trade-off: a
   * present-but-broken package reports available here and surfaces its error
   * at first loadAdapter, with the existing install-hint message.
   */
  async isAdapterAvailable(language: string): Promise<boolean> {
    if (this.cache.has(language)) {
      return true;
    }
    try {
      return await this.resolver.isInstalled(
        this.getPackageName(language),
        this.getFallbackModulePaths(language)
      );
    } catch {
      return false;
    }
  }

  /**
   * List all potentially available adapters (known list for now)
   */
  async listAvailableAdapters(): Promise<AdapterMetadata[]> {
    const known: Array<Omit<AdapterMetadata, 'installed'>> = [
      { name: 'mock', packageName: '@debugmcp/adapter-mock', description: 'Mock adapter for testing', attach: 'none' },
      { name: 'python', packageName: '@debugmcp/adapter-python', description: 'Python debugger using debugpy', attach: 'direct-connect' },
      { name: 'javascript', packageName: '@debugmcp/adapter-javascript', description: 'JavaScript/TypeScript debugger using js-debug', attach: 'spawn' },
      { name: 'ruby', packageName: '@debugmcp/adapter-ruby', description: 'Ruby debugger using rdbg', attach: 'direct-connect' },
      { name: 'rust', packageName: '@debugmcp/adapter-rust', description: 'Rust debugger using CodeLLDB', attach: 'none' },
      { name: 'go', packageName: '@debugmcp/adapter-go', description: 'Go debugger using Delve', attach: 'none' },
      { name: 'java', packageName: '@debugmcp/adapter-java', description: 'Java debugger using JDI bridge', attach: 'spawn' },
      { name: 'dotnet', packageName: '@debugmcp/adapter-dotnet', description: '.NET/C# debugger using netcoredbg', attach: 'spawn' },
      { name: 'cpp', packageName: '@debugmcp/adapter-cpp', description: 'C/C++ debugger using CodeLLDB', attach: 'spawn' },
      { name: 'cobol', packageName: '@debugmcp/adapter-cobol', description: 'COBOL debugger using GnuCOBOL and CodeLLDB', attach: 'spawn' },
    ];

    const results: AdapterMetadata[] = [];
    for (const a of known) {
      // Metadata-only presence probe (issue #401) — adapters are imported
      // on-demand at first create(), so unavailability here just means
      // installed=false in the metadata
      const installed = await this.isAdapterAvailable(a.name);
      // Prefer a genuinely-loaded factory's own declaration over the static known-list value
      const factoryAttach = installed ? this.cache.get(a.name)?.getMetadata().modes?.attach : undefined;
      results.push({ ...a, installed, attach: factoryAttach ?? a.attach });
    }
    return results;
  }

  /**
   * Get an already-loaded factory without triggering a load
   */
  getCachedFactory(language: string): IAdapterFactory | undefined {
    return this.cache.get(language);
  }

  private getPackageName(language: string): string {
    return `@debugmcp/adapter-${language.toLowerCase()}`;
  }

  // Try multiple fallback locations (node_modules first, then packages for non-container/dev images)
  private getFallbackModulePaths(language: string): string[] {
    const lang = language.toLowerCase();
    return [
      new URL(`../../node_modules/@debugmcp/adapter-${lang}/dist/index.js`, import.meta.url).href,
      new URL(`../../packages/adapter-${lang}/dist/index.js`, import.meta.url).href
    ];
  }

  private getFactoryClassName(language: string): string {
    const lower = language.toLowerCase();
    const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
    return `${capitalized}AdapterFactory`;
  }
}
