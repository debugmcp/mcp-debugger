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
