/**
 * Normalization for the free-text `message` an adapter attaches to a breakpoint.
 *
 * Two problems this solves (issue #471):
 *
 * 1. js-debug answers `setBreakpoints` from its pending-target stub with a
 *    *provisional* message meaning "Unbound breakpoint". Nothing clears it once
 *    the breakpoint actually binds, so `list_breakpoints` reports `verified: true`
 *    alongside a message asserting the opposite.
 * 2. That message arrives as a raw l10n bundle key rather than human text,
 *    because `L10N_FSPATH_TO_BUNDLE` is unset in the adapter spawn and
 *    `l10n.t(key, fallback)` then returns the key verbatim.
 */

/**
 * Known js-debug l10n keys mapped to the English fallback declared at the
 * `l10n.t(key, fallback)` call site, so a leaked key still reads as text.
 */
const L10N_FALLBACKS: Record<string, string> = {
  'breakpoint.provisionalBreakpoint': 'Unbound breakpoint',
};

/**
 * Messages whose meaning is "not bound yet", and so cannot survive
 * verification — in both raw-key and translated form, because the stamping
 * event may arrive while the breakpoint is still unverified (storing the
 * translated text) and the later bind event may carry no message at all.
 */
const PROVISIONAL_MESSAGES = new Set([
  'breakpoint.provisionalBreakpoint',
  'Unbound breakpoint',
]);

/**
 * Resolve an adapter-supplied breakpoint message for storage.
 *
 * @param message  the raw `message` from a DAP breakpoint object
 * @param verified the breakpoint's verified state as of the same update
 * @returns the message to store, or `undefined` to leave the field unset
 */
export function normalizeBreakpointMessage(
  message: string | undefined,
  verified: boolean
): string | undefined {
  if (message === undefined) {
    return undefined;
  }
  // A bound breakpoint cannot carry a "not bound yet" note.
  if (verified && PROVISIONAL_MESSAGES.has(message)) {
    return undefined;
  }
  return L10N_FALLBACKS[message] ?? message;
}
