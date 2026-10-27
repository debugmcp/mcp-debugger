export interface FlutterE2eReport {
  success?: boolean;
  testResults?: Array<{
    name?: string;
    assertionResults?: Array<{ title?: string; fullName?: string; status?: string }>;
  }>;
}
export interface FlutterE2eReportOptions {
  /** The cases that must pass; the widget tests by default. */
  require?: RegExp;
  /** How those cases are named in messages. */
  label?: string;
}
/** The CLI's `--require <text>` as a case-insensitive literal matcher. */
export function literalMatcher(text: string): RegExp;
export function checkFlutterE2eReport(report: FlutterE2eReport, options?: FlutterE2eReportOptions): number;
