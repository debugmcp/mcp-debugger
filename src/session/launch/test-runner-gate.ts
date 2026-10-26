/**
 * The test-runner preset gate (issue #985).
 *
 * `start_debugging { testRunner, testTarget }` asks the adapter to run the
 * test file under a test runner it knows how to launch (pytest first). Which
 * runners a language takes is declared once, on its factory metadata
 * (`AdapterModes.testRunners`), the way `attachBy` declares the attach
 * forms (#903). This module turns a request plus that declaration into one
 * verdict, taken by the launcher before any session state changes: an
 * undeclared runner is refused by name, with the runners the language does
 * take, and the session stays usable. The adapter's launch transform expands
 * a declared runner into its launch config.
 */
import type { AdapterModes } from '@debugmcp/shared';
import { ErrorMessages } from '../../utils/error-messages.js';

export type TestRunnerVerdict =
  | { ok: true; runner: string | undefined }
  | { ok: false; error: string };

/** The runner key, as the handler folds it into `adapterLaunchConfig`; the launcher keys its cwd rule on it too. */
export const TEST_RUNNER_KEY = 'testRunner';
/** Both preset keys as the handler folds them into `adapterLaunchConfig`. */
export const TEST_RUNNER_KEYS = [TEST_RUNNER_KEY, 'testTarget'] as const;

export function classifyTestRunner(
  language: string,
  adapterLaunchConfig: Record<string, unknown> | undefined,
  modes: AdapterModes | undefined
): TestRunnerVerdict {
  const runner = adapterLaunchConfig?.[TEST_RUNNER_KEY];
  const target = adapterLaunchConfig?.testTarget;
  if (runner === undefined) {
    if (target !== undefined && target !== null && target !== '') {
      return { ok: false, error: ErrorMessages.testTargetWithoutRunner() };
    }
    return { ok: true, runner: undefined };
  }
  const available = modes?.testRunners ?? [];
  // `null` is a value the caller sent, not an absence: refused like any other
  // non-string, so the adapter's transform never sees it after the state change.
  if (typeof runner !== 'string' || runner.length === 0) {
    return { ok: false, error: ErrorMessages.testRunnerNotAccepted(language, String(runner), available) };
  }
  if (!available.includes(runner)) {
    return { ok: false, error: ErrorMessages.testRunnerNotAccepted(language, runner, available) };
  }
  if (target !== undefined && target !== null && typeof target !== 'string') {
    return { ok: false, error: ErrorMessages.testTargetNotAString(typeof target) };
  }
  return { ok: true, runner };
}
