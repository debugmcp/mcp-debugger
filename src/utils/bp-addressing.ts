/**
 * Breakpoint addressing mode configuration (issue #271).
 *
 * DEBUG_MCP_BP_ADDRESSING restricts which breakpoint addressing features the
 * server exposes — in runtime behavior AND in the set_breakpoint tool schema:
 *   - 'line':    line numbers only (pre-#271 behavior)
 *   - 'assert':  line + expectedContent assertion + loud snapping
 *   - 'content': assert + statement anchors (the default when unset)
 * Modes are cumulative: line ⊂ assert ⊂ content.
 */

export type BpAddressingMode = 'line' | 'assert' | 'content';

export const BP_ADDRESSING_ENV_KEY = 'DEBUG_MCP_BP_ADDRESSING';

export const DEFAULT_BP_ADDRESSING: BpAddressingMode = 'content';

const VALID_MODES: ReadonlySet<string> = new Set(['line', 'assert', 'content']);

/**
 * Read the addressing mode from the environment. Unset, empty, or invalid
 * values fall back to the shipped default ('content').
 */
export function getBpAddressingMode(environment: {
  get(key: string): string | undefined;
}): BpAddressingMode {
  const raw = environment.get(BP_ADDRESSING_ENV_KEY)?.trim().toLowerCase();
  if (raw && VALID_MODES.has(raw)) {
    return raw as BpAddressingMode;
  }
  return DEFAULT_BP_ADDRESSING;
}

export function supportsExpectedContent(mode: BpAddressingMode): boolean {
  return mode !== 'line';
}

export function supportsStatementAnchors(mode: BpAddressingMode): boolean {
  return mode === 'content';
}

export function supportsLoudSnapping(mode: BpAddressingMode): boolean {
  return mode !== 'line';
}
