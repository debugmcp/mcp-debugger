/**
 * Size guards for variable-inspection responses (issues #356/#359).
 *
 * A scope can close over something enormous (a JS internal frame's Local
 * scope reaching process/global produced a 225KB+ single response in #356),
 * turning get_variables / get_local_variables into a hard failure on any MCP
 * client with a per-tool-result size cap. These caps turn that into a normal,
 * explicitly-annotated partial response; the existing `names` filter is the
 * escape hatch to fetch a specific subset in full.
 *
 * Caps mirror the output-buffer precedent (OUTPUT_BUFFER_CAP /
 * MAX_OUTPUT_ENTRY_CHARS + per-entry `truncated` flag).
 */
import type { Variable } from '@debugmcp/shared';

const DEFAULT_MAX_VARIABLE_VALUE_CHARS = 1024;
const DEFAULT_MAX_VARIABLES_PER_CALL = 300;
const DEFAULT_MAX_VARIABLES_TOTAL_CHARS = 256 * 1024;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Per-variable value length cap (env: DEBUG_MCP_MAX_VARIABLE_VALUE_CHARS). */
export function maxVariableValueChars(): number {
  return envInt('DEBUG_MCP_MAX_VARIABLE_VALUE_CHARS', DEFAULT_MAX_VARIABLE_VALUE_CHARS);
}

/** Per-call variable count cap (env: DEBUG_MCP_MAX_VARIABLES). */
export function maxVariablesPerCall(): number {
  return envInt('DEBUG_MCP_MAX_VARIABLES', DEFAULT_MAX_VARIABLES_PER_CALL);
}

/** Per-call total serialized-value budget, a backstop against many mid-sized values. */
export function maxVariablesTotalChars(): number {
  return envInt('DEBUG_MCP_MAX_VARIABLES_TOTAL_CHARS', DEFAULT_MAX_VARIABLES_TOTAL_CHARS);
}

export interface VariableTruncationSummary {
  /** Variables dropped entirely by the count cap or the total-size budget */
  omittedCount: number;
  /** Variables whose value was cut at the per-variable cap */
  valueTruncatedCount: number;
  /**
   * Scope fetches skipped entirely after the budget was spent (only
   * get_local_variables' multi-scope fan-out sets this) — an unknown number
   * of additional variables were never requested.
   */
  scopesSkipped?: number;
}

export interface CappedVariables {
  variables: Variable[];
  /** Present only when something was omitted or cut */
  truncation?: VariableTruncationSummary;
}

/**
 * Apply the caps to an already-filtered, already-redacted variable list.
 * Order matters upstream: run AFTER the names filter (so an explicit request
 * is never starved by unrelated variables) and AFTER redaction (so a cut
 * value can never leak a secret prefix that redaction would have masked).
 */
export function applyVariableCaps(vars: Variable[]): CappedVariables {
  const valueCap = maxVariableValueChars();
  const countCap = maxVariablesPerCall();
  const totalCap = maxVariablesTotalChars();

  const kept: Variable[] = [];
  let valueTruncatedCount = 0;
  let totalChars = 0;
  let omittedCount = 0;

  for (const variable of vars) {
    if (kept.length >= countCap || totalChars >= totalCap) {
      omittedCount++;
      continue;
    }
    let next = variable;
    const value = variable.value ?? '';
    if (value.length > valueCap) {
      next = { ...variable, value: value.slice(0, valueCap), truncated: true };
      valueTruncatedCount++;
    }
    totalChars += next.value.length;
    kept.push(next);
  }

  if (omittedCount === 0 && valueTruncatedCount === 0) {
    return { variables: kept };
  }
  return { variables: kept, truncation: { omittedCount, valueTruncatedCount } };
}

/**
 * Merge truncation summaries from multiple capped fetches (used by the
 * get_local_variables multi-scope fan-out). Returns undefined when nothing
 * was truncated anywhere.
 */
export function mergeTruncationSummaries(
  summaries: Array<VariableTruncationSummary | undefined>
): VariableTruncationSummary | undefined {
  let omittedCount = 0;
  let valueTruncatedCount = 0;
  let scopesSkipped = 0;
  for (const summary of summaries) {
    if (!summary) continue;
    omittedCount += summary.omittedCount;
    valueTruncatedCount += summary.valueTruncatedCount;
    scopesSkipped += summary.scopesSkipped ?? 0;
  }
  if (omittedCount === 0 && valueTruncatedCount === 0 && scopesSkipped === 0) {
    return undefined;
  }
  return {
    omittedCount,
    valueTruncatedCount,
    ...(scopesSkipped > 0 ? { scopesSkipped } : {})
  };
}

/**
 * Human-readable advisory for a truncated response, pointing at the `names`
 * escape hatch (modeled on the redaction notice).
 *
 * The `names:` example is derived from the actually-returned variables
 * (truncated ones first — those are the ones worth re-fetching) rather than
 * a hardcoded placeholder: a static `["a","b"]` reads as real variable
 * names, or worse, leaked state from another session (issue #438).
 */
export function buildTruncationNotice(
  summary: VariableTruncationSummary,
  returnedVariables?: ReadonlyArray<Pick<Variable, 'name' | 'truncated'>>
): string {
  const parts: string[] = [];
  if (summary.omittedCount > 0) {
    parts.push(`${summary.omittedCount} variable(s) omitted`);
  }
  if (summary.valueTruncatedCount > 0) {
    parts.push(`${summary.valueTruncatedCount} value(s) cut at ${maxVariableValueChars()} chars (flagged truncated:true)`);
  }
  if ((summary.scopesSkipped ?? 0) > 0) {
    parts.push(`${summary.scopesSkipped} scope(s) not fetched after the ${maxVariablesPerCall()}-variable budget`);
  }
  const vars = returnedVariables ?? [];
  const examples = [
    ...vars.filter(v => v.truncated === true),
    ...vars.filter(v => v.truncated !== true)
  ].slice(0, 2).map(v => JSON.stringify(v.name));
  const namesHint = examples.length > 0
    ? `Pass names: [${examples.join(',')}] to fetch specific variables in full`
    : `Pass names: [...] (exact variable names) to fetch specific variables in full`;
  return (
    `Response size-guarded: ${parts.join('; ')}. ${namesHint}, ` +
    `or raise DEBUG_MCP_MAX_VARIABLES / DEBUG_MCP_MAX_VARIABLE_VALUE_CHARS.`
  );
}
