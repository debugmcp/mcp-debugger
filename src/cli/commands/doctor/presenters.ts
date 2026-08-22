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

export function presentLanguage(language: string, details: Details | undefined): LanguageView {
  switch (language) {
    case 'python':
      return {
        runtime: { label: 'Python', path: str(details, 'pythonPath'), version: str(details, 'pythonVersion') },
        backend: { label: 'debugpy', version: str(details, 'debugpyVersion') }
      };
    case 'javascript':
      return {
        runtime: { label: 'Node.js', version: str(details, 'nodeVersion') },
        backend: { label: 'js-debug', source: 'vendored' }
      };
    case 'ruby':
      return {
        runtime: { label: 'Ruby', path: str(details, 'rubyPath'), version: str(details, 'rubyVersion') },
        backend: { label: 'rdbg', path: str(details, 'rdbgPath'), version: str(details, 'rdbgVersion') }
      };
    case 'go':
      return {
        runtime: { label: 'Go', path: str(details, 'goPath'), version: str(details, 'goVersion') },
        backend: { label: 'Delve', path: str(details, 'dlvPath'), version: str(details, 'dlvVersion') }
      };
    case 'java':
      return {
        runtime: { label: 'Java', path: str(details, 'javaPath'), version: str(details, 'javaVersion') },
        backend: { label: 'JDI bridge', path: str(details, 'jdiBridgeDir') }
      };
    case 'dotnet':
      return {
        runtime: { label: '.NET SDK', version: str(details, 'dotnetSdkVersion') },
        backend: {
          label: 'netcoredbg',
          path: str(details, 'debuggerPath'),
          version: str(details, 'netcoredbgVersion')
        }
      };
    case 'rust':
      return {
        runtime: { label: 'Rust', version: str(details, 'cargoVersion') },
        backend: {
          label: 'CodeLLDB',
          path: str(details, 'codelldbPath'),
          version: str(details, 'codelldbVersion'),
          source: str(details, 'codelldbSource')
        }
      };
    case 'cpp': {
      // The --version banner already names the command; only show the bare
      // command when no banner was captured.
      const compilerVersion = str(details, 'compilerVersion');
      return {
        runtime: {
          label: 'C/C++ compiler',
          path: compilerVersion ? undefined : str(details, 'compiler'),
          version: compilerVersion
        },
        backend: {
          label: 'CodeLLDB',
          path: str(details, 'codelldbPath'),
          version: str(details, 'codelldbVersion'),
          source: str(details, 'codelldbSource')
        }
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

const defaultImportModule: ImportModule = (id) => import(/* @vite-ignore */ id);

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
          getCompilerInfo(): Promise<{ command: string; version: string | null } | null>;
        }>;
        if (typeof mod.getCompilerInfo === 'function') {
          const info = await mod.getCompilerInfo();
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
