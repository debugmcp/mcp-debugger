export interface FlutterE2eReport {
  success?: boolean;
  testResults?: Array<{
    name?: string;
    assertionResults?: Array<{ title?: string; fullName?: string; status?: string }>;
  }>;
}
export function checkFlutterE2eReport(report: FlutterE2eReport): number;
