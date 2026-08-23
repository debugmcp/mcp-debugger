/**
 * Orchestration for `mcp-debugger doctor` (issue #423).
 *
 * Reuses the exact probing surface the server uses for
 * list_supported_languages — registry.listAvailableAdapters(), one
 * factory.validate() per installed language, computeModeAvailability() —
 * so doctor's launch/attach availability can never disagree with the
 * server. Doctor adds what the server deliberately omits: per-probe
 * timeouts, adapter-owned presentation (describeToolchain), host-platform
 * checks, and an honest verdict where the server fails open (recorded via
 * probe.failed / probe.timedOut so the divergence is visible).
 */
import type {
  AttachMechanism,
  IAdapterFactory,
  IEnvironment,
  IFileSystem,
  ILogger,
  ToolchainComponent,
  ToolchainDescription
} from '@debugmcp/shared';
import { normalizeToolchainDescription } from '@debugmcp/shared';
import { probeLanguageEntry, type LanguageModes } from '../../../utils/language-availability.js';
import { getDisabledLanguages } from '../../../utils/language-config.js';
import {
  checkContainerWorkspace,
  checkYamaPtraceScope,
  type PlatformCheckResult
} from './platform-checks.js';
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
  runtime?: ToolchainComponent;
  backend?: ToolchainComponent;
  /** Verbatim computeModeAvailability output — matches list_supported_languages */
  modes?: LanguageModes;
  /** Raw validate() details, verbatim */
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
    // Promise.resolve: a plain-JS factory can return a non-thenable from
    // describeToolchain; `.then` on it would throw inside this executor,
    // discarding the value and leaving the timer armed to stall the CLI.
    Promise.resolve(promise).then(
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

  const entries = await deps.registry.listAvailableAdapters();
  const knownNames = new Set(entries.map((entry) => entry.name));
  const requestedNormalized = requested.map((name) => name.trim().toLowerCase()).filter(Boolean);
  const unknownLanguages = requestedNormalized.filter((name) => !knownNames.has(name));
  const disabledSet = getDisabledLanguages(env);

  const languages = await Promise.all(
    entries.map((entry) => diagnoseLanguage(entry, disabledSet, deps))
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
  disabledSet: Set<string>,
  deps: DiagnoseDeps
): Promise<LanguageDiagnosis> {
  const probeStarted = Date.now();
  // The validate/extras budget clock starts when validate actually runs, so a
  // slow factory import cannot eat the budget and manufacture timeouts.
  let validateStarted = probeStarted;

  const base = {
    language: entry.name,
    package: entry.packageName,
    installed: entry.installed,
    disabled: disabledSet.has(entry.name)
  };

  // The shared probe (issue #435) — the same function the server's
  // list_supported_languages runs, so the two views cannot drift apart.
  // Doctor's wrapper adds what the server deliberately omits: a per-probe
  // timeout (the probe carries the outcome back; computeModeAvailability
  // fails open on the rethrow exactly as it does for the server). The outer
  // timeout bounds everything else — chiefly a wedged getFactory dynamic
  // import, which validate's inner timeout can never see.
  let probe;
  try {
    probe = await withTimeout(
      probeLanguageEntry(
        {
          language: entry.name,
          packageName: entry.packageName,
          installed: entry.installed,
          attach: entry.attach
        },
        {
          registry: deps.registry,
          disabledSet,
          runValidate: (_language, validate) => {
            validateStarted = Date.now();
            return withTimeout(validate(), deps.timeoutMs);
          },
          logger: deps.logger
        }
      ),
      deps.timeoutMs * 2
    );
  } catch (error) {
    const outerTimedOut = error instanceof ProbeTimeoutError;
    return {
      ...base,
      verdict: 'broken',
      errors: [
        outerTimedOut
          ? `Adapter probe timed out after ${deps.timeoutMs * 2}ms while loading the adapter — ` +
            `the ${entry.packageName} import may be wedged`
          : `Adapter probe failed: ${error instanceof Error ? error.message : String(error)}`
      ],
      warnings: [],
      probe: { durationMs: Date.now() - probeStarted, timedOut: outerTimedOut, failed: !outerTimedOut }
    };
  }

  if (probe.disabled || !entry.installed) {
    return {
      ...base,
      verdict: probe.disabled ? 'disabled' : 'missing',
      errors: [],
      warnings: [],
      modes: probe.modes,
      probe: { durationMs: 0, timedOut: false, failed: false }
    };
  }

  if (!probe.factory) {
    // An installed adapter whose factory cannot even be loaded cannot start
    // any session — that is broken, and a gated run must fail. (The server
    // fails open here; probe.modes reflects that so the divergence stays
    // visible rather than silent.)
    const loadDetail =
      probe.factoryLoadError instanceof Error
        ? `: ${probe.factoryLoadError.message}`
        : ' (the registry returned no factory)';
    return {
      ...base,
      verdict: 'broken',
      errors: [
        `Adapter factory could not be loaded${loadDetail} — the installed ${entry.packageName} ` +
          `may be corrupt or version-skewed; try reinstalling it. ` +
          `(The server assumes availability when it cannot probe.)`
      ],
      warnings: [],
      modes: probe.modes,
      probe: { durationMs: Date.now() - probeStarted, timedOut: false, failed: true }
    };
  }

  if (!probe.probeable) {
    // The factory loaded but is not probeable — a different defect than a
    // load failure, and 'reinstall' phrasing would misdiagnose it.
    return {
      ...base,
      verdict: 'broken',
      errors: [
        `Adapter factory loaded but exposes no validate() function — the installed ${entry.packageName} ` +
          `is likely version-skewed relative to this server. ` +
          `(The server assumes availability when it cannot probe.)`
      ],
      warnings: [],
      modes: probe.modes,
      probe: { durationMs: Date.now() - probeStarted, timedOut: false, failed: true }
    };
  }

  const validation = probe.validation;
  const probeError = probe.validationError;
  let timedOut = probeError instanceof ProbeTimeoutError;
  const failed = probeError !== undefined && !timedOut;
  const modes = probe.modes;

  const details = validation?.details ? { ...validation.details } : undefined;
  // Snapshot the verdict inputs before any adapter-owned code runs: the
  // factory is plain JS and receives only a defensive clone below, so a buggy
  // (or malicious) describeToolchain cannot mutate its way past a broken
  // verdict or blank the reported errors.
  const verdictInputs = validation
    ? { valid: validation.valid, errors: [...validation.errors], warnings: [...validation.warnings] }
    : undefined;

  // Adapter-owned presentation (issue #435): the factory renders its own
  // runtime/backend row from the validate() result — including valid:false,
  // so partially detected toolchains still show what IS there. It shares the
  // language's timeout budget: whatever validate() left over (clocked from
  // validate start, so factory-import time is excluded). A hung probe child
  // is flagged via probe.timedOut so the handler's force-exit containment
  // covers it too.
  let view: ToolchainDescription = {};
  let describeMissing = false;
  if (validation) {
    if (typeof probe.factory.describeToolchain === 'function') {
      const remainingMs = Math.max(0, deps.timeoutMs - (Date.now() - validateStarted));
      try {
        view = normalizeToolchainDescription(
          await withTimeout(
            probe.factory.describeToolchain(
              {
                valid: validation.valid,
                errors: [...validation.errors],
                warnings: [...validation.warnings],
                ...(validation.details ? { details: { ...validation.details } } : {})
              },
              { timeoutMs: remainingMs }
            ),
            remainingMs
          )
        );
      } catch (error) {
        // Presentation is best-effort; the verdict stands on validate() alone.
        if (error instanceof ProbeTimeoutError) {
          timedOut = true;
        }
      }
    } else {
      describeMissing = true;
    }
  }
  // Validate + presentation — the toolchain's own cost, excluding the module import
  const durationMs = Date.now() - validateStarted;

  let verdict: DoctorVerdict;
  let errors: string[];
  let warnings: string[];
  if (!verdictInputs) {
    verdict = 'broken';
    errors = [
      timedOut
        ? `Toolchain probe timed out after ${deps.timeoutMs}ms (the server assumes available when a probe fails)`
        : `Toolchain probe failed: ${probeError instanceof Error ? probeError.message : String(probeError)}`
    ];
    warnings = [];
  } else if (!verdictInputs.valid) {
    // A failed toolchain probe kills launch, but direct-connect attach runs
    // the debug engine inside the debuggee and needs nothing local (container
    // ruby is attach-only by design) — a partially usable adapter is a warn,
    // not broken, and must not fail a gated run.
    if (modes.attach.available) {
      verdict = 'warn';
      errors = verdictInputs.errors;
      warnings = [
        ...verdictInputs.warnings,
        `Launch is unavailable, but attach (direct-connect) still works — see the errors above for what launch would need.`
      ];
    } else {
      verdict = 'broken';
      errors = verdictInputs.errors;
      warnings = verdictInputs.warnings;
    }
  } else {
    verdict = verdictInputs.warnings.length > 0 ? 'warn' : 'ok';
    errors = [];
    warnings = verdictInputs.warnings;
  }

  if (describeMissing) {
    // Display-only breadcrumb (appended after the verdict is computed so an
    // older adapter package never flips ok→warn): the cells are empty because
    // the factory predates adapter-owned presentation, not because nothing
    // was detected.
    warnings = [
      ...warnings,
      `The installed ${entry.packageName} predates adapter-owned doctor presentation ` +
        `(describeToolchain) — runtime/backend cells are left empty; update the package to restore them.`
    ];
  }

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
