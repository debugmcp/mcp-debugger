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

// The 2026-07-28 requirements lane (issue #1025, step 2): judged by the suite itself.
export const CONFORMANCE_CLI_2026: string;
export const REQUIREMENTS_2026: string;
/** The suite's verdict on a `--requirements … --expected-failures` run. */
export interface BaselineVerdict {
  ok: boolean;
  /** Node's Windows exit abort hid the exit code; the suite's closing line was read instead. */
  abortedAtExit: boolean;
  /** What the suite said was wrong, colour stripped; empty on a pass. */
  report: string;
}
export function requirementsArgs(revision: string, port: number): string[];
export function baselineReport(output: string): string;
export function judgeBaselineRun(run: { code: number | null; output: string }): BaselineVerdict;
export function runRequirements(options?: {
  root?: string;
  revision?: string;
  verbose?: boolean;
  log?: (line: string) => void;
}): Promise<BaselineVerdict & { output: string }>;
