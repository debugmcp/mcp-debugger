/**
 * Per-mode language availability computation for list_supported_languages.
 *
 * Availability is advisory-but-enforced for launch (checkLaunchToolchain
 * gates create_debug_session/start_debugging, failing open whenever the probe
 * can't assess the toolchain — issue #360) and authoritative for attach
 * 'none' (enforced in SessionManagerOperations.attachToProcess).
 */
import type { AttachMechanism, FactoryValidationResult, IAdapterFactory } from '@debugmcp/shared';
import { ErrorMessages } from './error-messages.js';

export interface ModeAvailability {
  /** Whether the adapter implements this mode at all */
  supported: boolean;
  /** Whether the mode is usable in this runtime right now */
  available: boolean;
  /** Present iff available === false */
  reason?: string;
}

export interface LanguageModes {
  launch: ModeAvailability;
  attach: ModeAvailability;
}

export interface ModeAvailabilityInput {
  language: string;
  packageName: string;
  installed: boolean;
  disabled: boolean;
  attach: AttachMechanism;
  /**
   * Toolchain probe (IAdapterFactory.validate). Only called when the adapter
   * is installed and not disabled. Optional: absent means "assume valid".
   */
  validate?: () => Promise<FactoryValidationResult>;
  logger?: { warn?: (message: string) => void };
}

/**
 * TTL cache for factory validation results so repeated
 * list_supported_languages calls don't re-probe toolchains.
 */
export class ValidationResultCache {
  private readonly entries = new Map<string, { result: FactoryValidationResult; at: number }>();

  constructor(private readonly ttlMs: number = 30_000) {}

  async get(
    language: string,
    validate: () => Promise<FactoryValidationResult>
  ): Promise<FactoryValidationResult> {
    const cached = this.entries.get(language);
    if (cached && Date.now() - cached.at < this.ttlMs) {
      return cached.result;
    }
    const result = await validate();
    this.entries.set(language, { result, at: Date.now() });
    return result;
  }

  clear(): void {
    this.entries.clear();
  }
}

/**
 * Launch-mode gate shared by create_debug_session and start_debugging
 * (issue #360): consult the same toolchain probe list_supported_languages
 * uses, so a known-unavailable adapter fails fast with the same reason text
 * instead of reporting success and silently running nothing.
 *
 * Fail-open contract: any probe failure (registry without getFactory, missing
 * factory, thrown validate) reports available — enforcement must never block
 * a launch the advisory probe can't assess (mirrors computeModeAvailability).
 */
export async function checkLaunchToolchain(
  language: string,
  registry: unknown,
  cache: ValidationResultCache,
  logger?: { warn?: (message: string) => void }
): Promise<{ available: true } | { available: false; reason: string }> {
  try {
    const dyn = registry as
      | { getFactory?: (language: string) => Promise<{ validate?: () => Promise<FactoryValidationResult> } | undefined> }
      | undefined;
    if (typeof dyn?.getFactory !== 'function') {
      return { available: true };
    }
    const factory = await dyn.getFactory(language);
    if (!factory || typeof factory.validate !== 'function') {
      return { available: true };
    }
    const validate = factory.validate.bind(factory) as () => Promise<FactoryValidationResult>;
    const validation = await cache.get(language, validate);
    if (validation.valid) {
      return { available: true };
    }
    const reason = validation.errors.join('; ') || `The '${language}' debug adapter is not available in this runtime.`;
    return { available: false, reason };
  } catch (error) {
    logger?.warn?.(
      `[language-availability] launch gate probe failed for '${language}'; allowing launch. ` +
        `${error instanceof Error ? error.message : String(error)}`
    );
    return { available: true };
  }
}

/** A registry adapter entry as reported by listAvailableAdapters(). */
export interface LanguageAdapterEntry {
  language: string;
  packageName: string;
  installed: boolean;
  attach?: AttachMechanism;
}

/**
 * The structural minimum the probe needs from a factory, plus the optional
 * adapter-owned doctor presentation (issue #435) so doctor can call it on
 * probe.factory without a re-fetch.
 */
export type ProbeableAdapterFactory = Pick<IAdapterFactory, 'validate' | 'getMetadata' | 'describeToolchain'>;

export interface AvailabilityProbeOptions {
  /** Source of factories; absent getFactory means "cannot probe" (assume valid). */
  registry?: { getFactory?: (language: string) => Promise<ProbeableAdapterFactory | undefined> };
  disabledSet: Set<string>;
  /**
   * Wraps each factory.validate call — the injection point for the server's
   * TTL cache and doctor's per-probe timeout. Default: call straight through.
   */
  runValidate?: (
    language: string,
    validate: () => Promise<FactoryValidationResult>
  ) => Promise<FactoryValidationResult>;
  logger?: { warn?: (message: string) => void };
}

export interface LanguageAvailabilityProbe {
  disabled: boolean;
  /** The loaded factory, when one was loaded (installed, enabled, load succeeded). */
  factory?: ProbeableAdapterFactory;
  /** Set when registry.getFactory threw (doctor reports it; the server fails open). */
  factoryLoadError?: unknown;
  /** Whether a validate() probe could actually run (factory loaded and callable). */
  probeable: boolean;
  /** The validate() outcome, when the probe ran and settled successfully. */
  validation?: FactoryValidationResult;
  /** The validate() rejection, when the probe ran and threw (modes fail open). */
  validationError?: unknown;
  modes: LanguageModes;
}

const KNOWN_ATTACH: readonly AttachMechanism[] = ['none', 'direct-connect', 'spawn'];

/**
 * Third-party factories are plain JS — an unknown attach string would fall
 * through computeModeAvailability's switch and leave modes.attach undefined.
 */
function normalizeAttach(value: unknown, fallback: AttachMechanism): AttachMechanism {
  return KNOWN_ATTACH.includes(value as AttachMechanism) ? (value as AttachMechanism) : fallback;
}

/**
 * The one per-entry availability probe shared by list_supported_languages and
 * `mcp-debugger doctor` (issue #435): disabled gate → installed gate →
 * factory load (fail-open on error) → metadata-over-entry attach preference →
 * computeModeAvailability. Keeping both consumers on this function is what
 * makes "doctor can never disagree with the server" structural rather than a
 * mirroring convention.
 */
export async function probeLanguageEntry(
  entry: LanguageAdapterEntry,
  options: AvailabilityProbeOptions
): Promise<LanguageAvailabilityProbe> {
  const disabled = options.disabledSet.has(entry.language);
  const entryAttach = normalizeAttach(entry.attach, 'none');

  let factory: ProbeableAdapterFactory | undefined;
  let factoryLoadError: unknown;
  if (!disabled && entry.installed && typeof options.registry?.getFactory === 'function') {
    try {
      factory = await options.registry.getFactory(entry.language);
    } catch (error) {
      factoryLoadError = error;
    }
  }

  // A malformed factory's getMetadata must not take the probe down — fall
  // back to the registry entry's attach declaration, but leave a breadcrumb.
  let attach = entryAttach;
  if (factory) {
    try {
      attach = normalizeAttach(factory.getMetadata().modes?.attach, entryAttach);
    } catch (error) {
      attach = entryAttach;
      options.logger?.warn?.(
        `[language-availability] getMetadata() threw for '${entry.language}'; using the registry attach declaration. ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const runValidate =
    options.runValidate ?? ((_language, validate) => validate());
  const probeable = factory !== undefined && typeof factory.validate === 'function';
  if (factory && !probeable) {
    options.logger?.warn?.(
      `[language-availability] factory for '${entry.language}' has no validate() function; assuming available.`
    );
  }

  let validation: FactoryValidationResult | undefined;
  let validationError: unknown;
  const modes = await computeModeAvailability({
    language: entry.language,
    packageName: entry.packageName,
    installed: entry.installed,
    disabled,
    attach,
    validate: probeable
      ? async () => {
          try {
            validation = await runValidate(entry.language, () => factory!.validate());
            return validation;
          } catch (error) {
            validationError = error;
            throw error; // computeModeAvailability fails open and logs
          }
        }
      : undefined,
    logger: options.logger
  });

  return {
    disabled,
    factory,
    factoryLoadError,
    probeable,
    validation,
    validationError,
    modes
  };
}

export async function computeModeAvailability(input: ModeAvailabilityInput): Promise<LanguageModes> {
  const { language, packageName, installed, disabled, attach } = input;

  const attachSupported = attach !== 'none';

  if (disabled) {
    const reason = ErrorMessages.modeUnavailableReason.disabled(language);
    return {
      launch: { supported: true, available: false, reason },
      attach: { supported: attachSupported, available: false, reason }
    };
  }

  if (!installed) {
    const reason = ErrorMessages.modeUnavailableReason.notInstalled(packageName);
    return {
      launch: { supported: true, available: false, reason },
      attach: { supported: attachSupported, available: false, reason }
    };
  }

  // Installed and enabled: probe the toolchain (advisory; fail open on probe errors)
  let validation: FactoryValidationResult | undefined;
  if (input.validate) {
    try {
      validation = await input.validate();
    } catch (error) {
      input.logger?.warn?.(
        `[language-availability] validate() threw for '${language}'; reporting available. ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
      validation = undefined;
    }
  }

  const toolchainOk = validation ? validation.valid : true;
  const toolchainReason = validation && !validation.valid ? validation.errors.join('; ') : undefined;

  const launch: ModeAvailability = toolchainOk
    ? { supported: true, available: true }
    : { supported: true, available: false, reason: toolchainReason };

  let attachAvailability: ModeAvailability;
  switch (attach) {
    case 'none':
      attachAvailability = {
        supported: false,
        available: false,
        reason: ErrorMessages.modeUnavailableReason.attachNotImplemented(language)
      };
      break;
    case 'direct-connect':
      // The debug engine runs inside the debuggee; only a socket is needed locally
      attachAvailability = { supported: true, available: true };
      break;
    case 'spawn':
      // Attach spawns the same local adapter the launch path uses
      attachAvailability = toolchainOk
        ? { supported: true, available: true }
        : { supported: true, available: false, reason: toolchainReason };
      break;
  }

  return { launch, attach: attachAvailability };
}
