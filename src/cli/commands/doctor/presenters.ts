/**
 * Per-language presentation for `mcp-debugger doctor` (issue #423).
 *
 * presentLanguage maps the raw factory-validate `details` (plus doctor-only
 * extras) onto the table's runtime/backend columns; collectDoctorExtras runs
 * the doctor-only probes that live in the adapter packages but are too
 * expensive for the server's validate() path (netcoredbg/SDK versions, javac,
 * compiler banner). Both are presentation-side: no probing logic lives here.
 */

export interface DoctorRuntimeInfo {
  label: string;
  path?: string;
  version?: string;
}

export interface DoctorBackendInfo {
  label: string;
  path?: string;
  version?: string;
  source?: string;
}

export interface LanguageView {
  runtime?: DoctorRuntimeInfo;
  backend?: DoctorBackendInfo;
}

type Details = Record<string, unknown>;

const str = (details: Details | undefined, key: string): string | undefined => {
  const value = details?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/**
 * A cell is only rendered when something was actually detected — a bare label
 * would make an absent toolchain read as present. `(built-in)` style labels
 * stand alone by design (mock).
 */
function component<T extends DoctorRuntimeInfo | DoctorBackendInfo>(info: T): T | undefined {
  const { label, ...rest } = info as DoctorBackendInfo;
  if (label.startsWith('(')) {
    return info;
  }
  return Object.values(rest).some((value) => value !== undefined) ? info : undefined;
}

export function presentLanguage(language: string, details: Details | undefined): LanguageView {
  if (details === undefined) {
    // The probe failed or timed out before producing anything — an empty row
    // is the honest rendering.
    return {};
  }
  switch (language) {
    case 'python':
      return {
        runtime: component({ label: 'Python', path: str(details, 'pythonPath'), version: str(details, 'pythonVersion') }),
        backend: component({ label: 'debugpy', version: str(details, 'debugpyVersion') })
      };
    case 'javascript':
      return {
        runtime: component({ label: 'Node.js', version: str(details, 'nodeVersion') }),
        backend: { label: 'js-debug', source: 'vendored' }
      };
    case 'ruby':
      return {
        runtime: component({ label: 'Ruby', path: str(details, 'rubyPath'), version: str(details, 'rubyVersion') }),
        backend: component({ label: 'rdbg', path: str(details, 'rdbgPath'), version: str(details, 'rdbgVersion') })
      };
    case 'go':
      return {
        runtime: component({ label: 'Go', path: str(details, 'goPath'), version: str(details, 'goVersion') }),
        backend: component({ label: 'Delve', path: str(details, 'dlvPath'), version: str(details, 'dlvVersion') })
      };
    case 'java':
      return {
        runtime: component({ label: 'Java', path: str(details, 'javaPath'), version: str(details, 'javaVersion') }),
        backend: component({ label: 'JDI bridge', path: str(details, 'jdiBridgeDir') })
      };
    case 'dotnet':
      return {
        runtime: component({ label: '.NET SDK', version: str(details, 'dotnetSdkVersion') }),
        backend: component({
          label: 'netcoredbg',
          path: str(details, 'debuggerPath'),
          version: str(details, 'netcoredbgVersion')
        })
      };
    case 'rust':
      return {
        runtime: component({ label: 'Rust', version: str(details, 'cargoVersion') }),
        backend: component({
          label: 'CodeLLDB',
          path: str(details, 'codelldbPath'),
          version: str(details, 'codelldbVersion'),
          source: str(details, 'codelldbSource')
        })
      };
    case 'cpp': {
      // The --version banner already names the command; only show the bare
      // command when no banner was captured.
      const compilerVersion = str(details, 'compilerVersion');
      return {
        runtime: component({
          label: 'C/C++ compiler',
          path: compilerVersion ? undefined : str(details, 'compiler'),
          version: compilerVersion
        }),
        backend: component({
          label: 'CodeLLDB',
          path: str(details, 'codelldbPath'),
          version: str(details, 'codelldbVersion'),
          source: str(details, 'codelldbSource')
        })
      };
    }
    case 'mock':
      return {
        runtime: { label: '(built-in)' },
        backend: { label: '(built-in)' }
      };
    default:
      return {};
  }
}

type ImportModule = (id: string) => Promise<unknown>;

/**
 * Literal specifiers only: a variable `import(id)` cannot be inlined by the
 * npx bundle's esbuild pass, so it would throw ERR_MODULE_NOT_FOUND in every
 * npx/global install (the CLI package ships no adapter dependencies — they
 * are bundled). With literals, esbuild bundles each target and the same code
 * works in repo checkouts, Docker, and npx.
 */
const defaultImportModule: ImportModule = (id) => {
  switch (id) {
    case '@debugmcp/adapter-dotnet':
      return import('@debugmcp/adapter-dotnet');
    case '@debugmcp/adapter-java':
      return import('@debugmcp/adapter-java');
    case '@debugmcp/adapter-cpp':
      return import('@debugmcp/adapter-cpp');
    default:
      return Promise.reject(new Error(`No doctor extras module registered for '${id}'`));
  }
};

/**
 * Doctor-only probes, run per installed language after validate(). Each is
 * best-effort: an unimportable adapter package or a failing probe yields no
 * extras rather than an error — the verdict already stands on validate().
 */
export async function collectDoctorExtras(
  language: string,
  details: Details,
  options: { importModule?: ImportModule } = {}
): Promise<Details> {
  const importModule = options.importModule ?? defaultImportModule;
  try {
    switch (language) {
      case 'dotnet': {
        const mod = (await importModule('@debugmcp/adapter-dotnet')) as Partial<{
          getNetcoredbgVersion(path: string): Promise<string | null>;
          getDotnetSdkVersion(): Promise<string | null>;
        }>;
        const extras: Details = {};
        const debuggerPath = str(details, 'debuggerPath');
        if (debuggerPath && typeof mod.getNetcoredbgVersion === 'function') {
          const version = await mod.getNetcoredbgVersion(debuggerPath);
          if (version) extras.netcoredbgVersion = version;
        }
        if (typeof mod.getDotnetSdkVersion === 'function') {
          const sdk = await mod.getDotnetSdkVersion();
          if (sdk) extras.dotnetSdkVersion = sdk;
        }
        return extras;
      }
      case 'java': {
        const mod = (await importModule('@debugmcp/adapter-java')) as Partial<{
          findJavacExecutable(javaPath?: string): Promise<string | null>;
        }>;
        if (typeof mod.findJavacExecutable === 'function') {
          const javacPath = await mod.findJavacExecutable(str(details, 'javaPath'));
          if (javacPath) return { javacPath };
        }
        return {};
      }
      case 'cpp': {
        const mod = (await importModule('@debugmcp/adapter-cpp')) as Partial<{
          getCompilerInfo(command?: string): Promise<{ command: string; version: string | null } | null>;
        }>;
        if (typeof mod.getCompilerInfo === 'function') {
          // validate() already discovered the command — reuse it instead of
          // re-probing the whole candidate list.
          const info = await mod.getCompilerInfo(str(details, 'compiler'));
          if (info?.version) return { compilerVersion: info.version };
        }
        return {};
      }
      default:
        return {};
    }
  } catch {
    return {};
  }
}
