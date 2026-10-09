export interface DartE2eReport {
  success?: boolean;
  testResults?: Array<{
    name?: string;
    assertionResults?: Array<{ title?: string; fullName?: string; status?: string }>;
  }>;
}
export function checkDartE2eReport(report: DartE2eReport): number;
