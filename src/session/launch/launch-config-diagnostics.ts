import type { IDebugAdapter, LanguageSpecificLaunchConfig } from '@debugmcp/shared';
import { didYouMean } from '../../utils/did-you-mean.js';

export interface CallerLaunchInput {
  source: 'dapLaunchArgs' | 'adapterLaunchConfig';
  value: unknown;
}

/** Caller-only provenance survives the generic/default configuration merge. */
export function callerLaunchInputs(
  dapLaunchArgs: object | undefined,
  adapterLaunchConfig: Record<string, unknown> | undefined
): Record<string, CallerLaunchInput> {
  return Object.fromEntries([
    ...Object.entries(dapLaunchArgs ?? {}).map(([key, value]) => [key, { source: 'dapLaunchArgs', value }]),
    ...Object.entries(adapterLaunchConfig ?? {}).map(([key, value]) => [key, { source: 'adapterLaunchConfig', value }])
  ]);
}

/** Drain even on transform failure, when only explicitly recorded diagnostics are knowable. */
export function collectLaunchConfigNotices(
  adapter: IDebugAdapter,
  inputs: Record<string, CallerLaunchInput>,
  transformed: LanguageSpecificLaunchConfig | undefined
): string[] {
  const diagnostics = adapter.consumeLaunchConfigDiagnostics?.() ?? [];
  const supported = adapter.supportedLaunchKeys;
  const notices: string[] = [];
  for (const [key, { source, value }] of Object.entries(inputs)) {
    if (value === undefined) continue;
    const name = `${source}.${key}`;
    if (source === 'adapterLaunchConfig' && (key === 'request' || key === '__attachMode')) {
      notices.push(`${name}: ignored; reserved for the launch/attach operation`);
      continue;
    }
    const messages = diagnostics.filter(diagnostic => diagnostic.key === key);
    if (messages.length) {
      for (const { message } of messages) notices.push(`${name}: ${message}`);
      continue;
    }
    // Other adapters retain their existing behavior until they declare launch support.
    if (!transformed || !supported) continue;
    const forwarded = Object.hasOwn(transformed, key);
    const consumed = adapter.consumedLaunchKeys?.includes(key);
    let message: string | undefined;
    if (!forwarded && !consumed) message = 'ignored by the launch transform';
    else if (forwarded && !supported.includes(key)) message = 'forwarded to the adapter but unrecognized';
    if (message) {
      const suggestion = didYouMean(key, supported);
      notices.push(`${name}: ${message}${suggestion && suggestion !== key ? ` (did you mean ${suggestion}?)` : ''}`);
    }
  }
  return [...new Set(notices)];
}
