/**
 * Per-mode language availability computation for list_supported_languages.
 *
 * Availability is advisory for launch (enforcement stays with the natural
 * failure at executable resolution) and authoritative for attach 'none'
 * (enforced in SessionManagerOperations.attachToProcess).
 */
import type { AttachMechanism, FactoryValidationResult } from '@debugmcp/shared';
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
