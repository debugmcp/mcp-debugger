export function sanitizeBreakpointMessage(message: string | undefined, verified: boolean): string | undefined {
  if (!message) {
    return undefined;
  }

  // If the breakpoint is verified, it should not have an "unbound" message
  if (verified && message === 'breakpoint.provisionalBreakpoint') {
    return undefined;
  }

  // Fallback map for known l10n keys from js-debug
  if (message === 'breakpoint.provisionalBreakpoint') {
    return 'Unbound breakpoint';
  }

  return message;
}
