export interface HostE2eReport {
  success?: boolean;
  testResults?: Array<{
    name?: string;
    status?: string;
    assertionResults?: Array<{ title?: string; status?: string }>;
  }>;
}
export function checkHostE2eReport(report: HostE2eReport, language: string): number;
