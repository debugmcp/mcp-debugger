export interface CobolE2eReport {
  success?: boolean;
  testResults?: Array<{
    name?: string;
    assertionResults?: Array<{ title?: string; fullName?: string; status?: string }>;
  }>;
}
export function checkCobolE2eReport(report: CobolE2eReport): number;
