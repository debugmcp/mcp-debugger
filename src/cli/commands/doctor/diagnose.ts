/**
 * Orchestration for `mcp-debugger doctor` (issue #423).
 *
 * Reuses the exact probing surface the server uses for
 * list_supported_languages — registry.listAvailableAdapters(), one
 * factory.validate() per installed language, computeModeAvailability() —
 * so doctor's launch/attach availability can never disagree with the
 * server. Doctor adds what the server deliberately omits: per-probe
 * timeouts, doctor-only extras, host-platform checks, and an honest
 * verdict where the server fails open (recorded via probe.failed /
 * probe.timedOut so the divergence is visible).
 */
import type {
  AttachMechanism,
  FactoryValidationResult,
  IAdapterFactory,
  IEnvironment,
  IFileSystem,
  ILogger
} from '@debugmcp/shared';
import { computeModeAvailability, type LanguageModes } from '../../../utils/language-availability.js';
import { getDisabledLanguages } from '../../../utils/language-config.js';
import {
  checkContainerWorkspace,
  checkYamaPtraceScope,
  type PlatformCheckResult
} from './platform-checks.js';
import {
  collectDoctorExtras,
  presentLanguage,
  type DoctorBackendInfo,
  type DoctorRuntimeInfo
} from './presenters.js';
import { isContainerMode } from '../../../utils/container-path-utils.js';

export type DoctorVerdict = 'ok' | 'warn' | 'missing' | 'disabled' | 'broken';

export interface LanguageDiagnosis {
  language: string;
  package: string;
  installed: boolean;
  disabled: boolean;
  verdict: DoctorVerdict;
  errors: string[];
  warnings: string[];
  runtime?: DoctorRuntimeInfo;
  backend?: DoctorBackendInfo;
  /** Verbatim computeModeAvailability output — matches list_supported_languages */
  modes?: LanguageModes;
  /** Raw validate() details plus doctor-only extras */
  details?: Record<string, unknown>;
  probe: { durationMs: number; timedOut: boolean; failed: boolean };
}

export interface DoctorReport {
  schemaVersion: 1;
  version: string;
  platform: { os: string; arch: string; node: string; containerMode: boolean };
  requested: string[];
  unknownLanguages: string[];
  languages: LanguageDiagnosis[];
  platformChecks: PlatformCheckResult[];
  exitCode: 0 | 1;
}

interface RegistryAdapterEntry {
  name: string;
  packageName: string;
  installed: boolean;
  attach?: AttachMechanism;
  description?: string;
}

export interface DoctorRegistry {
  listAvailableAdapters(): Promise<RegistryAdapterEntry[]>;
  getFactory(language: string): Promise<IAdapterFactory | undefined>;
}

export interface DiagnoseDeps {
  registry: DoctorRegistry;
  environment: IEnvironment;
  fileSystem: IFileSystem;
  /** Disabled-language source; defaults to process.env */
  env?: NodeJS.ProcessEnv;
  /** Platform for the Yama check; defaults to process.platform */
  platform?: NodeJS.Platform;
  timeoutMs: number;
  version: string;
  logger?: ILogger;
  /** Doctor-only extras collector; injectable for tests. Defaults to collectDoctorExtras. */
  collectExtras?: (language: string, details: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

class ProbeTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`probe timed out after ${timeoutMs}ms`);
    this.name = 'ProbeTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProbeTimeoutError(timeoutMs)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

const GATING_VERDICTS: ReadonlySet<DoctorVerdict> = new Set(['broken', 'missing', 'disabled']);

export async function diagnose(requested: string[], deps: DiagnoseDeps): Promise<DoctorReport> {
  const env = deps.env ?? process.env;
  const platform = deps.platform ?? process.platform;
  const collectExtras =
    deps.collectExtras ?? ((language, details) => collectDoctorExtras(language, details));

  const entries = await deps.registry.listAvailableAdapters();
  const knownNames = new Set(entries.map((entry) => entry.name));
  const requestedNormalized = requested.map((name) => name.trim().toLowerCase()).filter(Boolean);
  const unknownLanguages = requestedNormalized.filter((name) => !knownNames.has(name));
  const disabledSet = getDisabledLanguages(env);

  const languages = await Promise.all(
    entries.map((entry) =>
      diagnoseLanguage(entry, disabledSet.has(entry.name), deps, collectExtras)
    )
  );

  const platformChecks: PlatformCheckResult[] = [
    ...(await checkContainerWorkspace(deps.environment, deps.fileSystem)),
    await checkYamaPtraceScope(deps.fileSystem, platform)
  ];

  const requestedBroken = languages.some(
    (diagnosis) =>
      requestedNormalized.includes(diagnosis.language) && GATING_VERDICTS.has(diagnosis.verdict)
  );
  const exitCode: 0 | 1 =
    requestedNormalized.length > 0 && (unknownLanguages.length > 0 || requestedBroken) ? 1 : 0;

  return {
    schemaVersion: 1,
    version: deps.version,
    platform: {
      os: platform,
      arch: process.arch,
      node: process.version,
      containerMode: isContainerMode(deps.environment)
    },
    requested: requestedNormalized,
    unknownLanguages,
    languages,
    platformChecks,
    exitCode
  };
}

async function diagnoseLanguage(
  entry: RegistryAdapterEntry,
  disabled: boolean,
  deps: DiagnoseDeps,
  collectExtras: (language: string, details: Record<string, unknown>) => Promise<Record<string, unknown>>
): Promise<LanguageDiagnosis> {
  const base = {
    language: entry.name,
    package: entry.packageName,
    installed: entry.installed,
    disabled
  };

  if (disabled || !entry.installed) {
    const modes = await computeModeAvailability({
      language: entry.name,
      packageName: entry.packageName,
      installed: entry.installed,
      disabled,
      attach: entry.attach ?? 'none',
      logger: deps.logger
    });
    return {
      ...base,
      verdict: disabled ? 'disabled' : 'missing',
      errors: [],
      warnings: [],
      modes,
      probe: { durationMs: 0, timedOut: false, failed: false }
    };
  }

  let factoryLoadError: unknown;
  const factory = await deps.registry.getFactory(entry.name).catch((error: unknown) => {
    factoryLoadError = error;
    return undefined;
  });

  if (!factory || typeof factory.validate !== 'function') {
    // An installed adapter whose factory cannot even be loaded cannot start
    // any session — that is broken, and a gated run must fail. (The server
    // fails open here; the modes below reflect that so the divergence stays
    // visible rather than silent.)
    const modes = await computeModeAvailability({
      language: entry.name,
      packageName: entry.packageName,
      installed: true,
      disabled: false,
      attach: entry.attach ?? 'none',
      logger: deps.logger
    });
    const loadDetail =
      factoryLoadError instanceof Error ? `: ${factoryLoadError.message}` : '';
    return {
      ...base,
      verdict: 'broken',
      errors: [
        `Adapter factory could not be loaded${loadDetail} — the installed ${entry.packageName} ` +
          `may be corrupt or version-skewed; try reinstalling it. ` +
          `(The server assumes availability when it cannot probe.)`
      ],
      warnings: [],
      modes,
      probe: { durationMs: 0, timedOut: false, failed: true }
    };
  }

  const started = Date.now();
  let validation: FactoryValidationResult | undefined;
  let probeError: unknown;
  let timedOut = false;
  try {
    validation = await withTimeout(factory.validate(), deps.timeoutMs);
  } catch (error) {
    probeError = error;
    timedOut = error instanceof ProbeTimeoutError;
  }
  const failed = probeError !== undefined && !timedOut;

  // Feed computeModeAvailability the same outcome the server would see: the
  // memoized result, or a throwing probe so its fail-open path runs. A
  // throwing getMetadata (malformed third-party factory) must not take the
  // other languages down with it.
  let metadataAttach: AttachMechanism | undefined;
  try {
    metadataAttach = factory.getMetadata().modes?.attach;
  } catch {
    metadataAttach = undefined;
  }
  const modes = await computeModeAvailability({
    language: entry.name,
    packageName: entry.packageName,
    installed: true,
    disabled: false,
    attach: metadataAttach ?? entry.attach ?? 'none',
    validate: validation
      ? async () => validation
      : async () => {
          throw probeError;
        },
    logger: deps.logger
  });

  let details = validation?.details ? { ...validation.details } : undefined;
  if (validation) {
    // Extras share the language's timeout budget: whatever validate() left
    // over. A hung extras child is flagged via probe.timedOut so the handler's
    // force-exit containment covers it too.
    const remainingMs = Math.max(0, deps.timeoutMs - (Date.now() - started));
    try {
      const extras = await withTimeout(collectExtras(entry.name, details ?? {}), remainingMs);
      if (extras && Object.keys(extras).length > 0) {
        details = { ...(details ?? {}), ...extras };
      }
    } catch (error) {
      // Extras are best-effort; the verdict stands on validate() alone.
      if (error instanceof ProbeTimeoutError) {
        timedOut = true;
      }
    }
  }
  const durationMs = Date.now() - started;

  let verdict: DoctorVerdict;
  let errors: string[];
  let warnings: string[];
  if (!validation) {
    verdict = 'broken';
    errors = [
      timedOut
        ? `Toolchain probe timed out after ${deps.timeoutMs}ms (the server assumes available when a probe fails)`
        : `Toolchain probe failed: ${probeError instanceof Error ? probeError.message : String(probeError)}`
    ];
    warnings = [];
  } else if (!validation.valid) {
    // A failed toolchain probe kills launch, but direct-connect attach runs
    // the debug engine inside the debuggee and needs nothing local (container
    // ruby is attach-only by design) — a partially usable adapter is a warn,
    // not broken, and must not fail a gated run.
    if (modes.attach.available) {
      verdict = 'warn';
      errors = validation.errors;
      warnings = [
        ...validation.warnings,
        `Launch is unavailable, but attach (direct-connect) still works — see the errors above for what launch would need.`
      ];
    } else {
      verdict = 'broken';
      errors = validation.errors;
      warnings = validation.warnings;
    }
  } else {
    verdict = validation.warnings.length > 0 ? 'warn' : 'ok';
    errors = [];
    warnings = validation.warnings;
  }

  const view = presentLanguage(entry.name, details);

  return {
    ...base,
    verdict,
    errors,
    warnings,
    runtime: view.runtime,
    backend: view.backend,
    modes,
    details,
    probe: { durationMs, timedOut, failed }
  };
}
