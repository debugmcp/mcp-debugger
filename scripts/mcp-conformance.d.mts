export const CONFORMANCE_CLI: string;
export const APPLICABLE_SCENARIOS: string[];
export interface ScenarioSummary {
  passed: number;
  total: number;
  failed: number;
}
export interface ScenarioVerdict {
  name: string;
  ok: boolean;
  reason?: string;
  summary?: ScenarioSummary;
}
export function parseSummary(output: string): ScenarioSummary | undefined;
export function judgeScenario(name: string, output: string): ScenarioVerdict;
export function runConformance(options?: {
  root?: string;
  scenarios?: string[];
  verbose?: boolean;
  log?: (line: string) => void;
}): Promise<ScenarioVerdict[]>;

// The 2026-07-28 requirements lane (issue #1025, step 2).
export const CONFORMANCE_CLI_2026: string;
export const REQUIREMENTS_2026: string;
export interface RequirementsScenario {
  name: string;
  passed: number;
  failed: number;
}
export interface RequirementsSummary {
  scenarios: RequirementsScenario[];
  /** Scenarios the revision lists as not scored (extensions and pending ones). */
  notScored: Set<string>;
}
/** A whole scenario expected to fail (`'all'`), or the names of its checks that are. */
export type ExpectedFailures = Map<string, 'all' | Set<string>>;
export function parseRequirementsSummary(output: string): RequirementsSummary | undefined;
export function parseBaseline(text: string): ExpectedFailures;
export function failingChecks(checksJson: unknown): string[];
export function judgeRequirements(
  summary: RequirementsSummary,
  baseline: ExpectedFailures,
  failingChecksOf: (scenario: string) => string[]
): string[];
export function collectChecks(dir: string): Map<string, string[]>;
export function runRequirements(options?: {
  root?: string;
  revision?: string;
  baselinePath?: string;
  verbose?: boolean;
  log?: (line: string) => void;
}): Promise<{ problems: string[]; summary: RequirementsSummary }>;
