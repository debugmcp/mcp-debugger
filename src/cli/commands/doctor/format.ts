/**
 * Output formatting for `mcp-debugger doctor` (issue #423).
 *
 * Human output is a hand-padded table (no table library in this repo — the
 * house style is check-rust-binary's assembled lines with ✅/⚠️/❌ markers)
 * followed by platform checks and a Fixes block. JSON output is the
 * DoctorReport verbatim.
 */
import type { DoctorReport, DoctorVerdict, LanguageDiagnosis } from './diagnose.js';
import type { PlatformCheckResult } from './platform-checks.js';

const VERDICT_MARKS: Record<DoctorVerdict, string> = {
  ok: '✅ ok',
  warn: '⚠️ warn',
  missing: '❌ missing',
  disabled: '🚫 disabled',
  broken: '❌ broken'
};

const STATUS_MARKS: Record<PlatformCheckResult['status'], string> = {
  ok: '✅',
  warn: '⚠️',
  broken: '❌',
  skipped: '—'
};

function cellFor(info: { path?: string; version?: string; label?: string; source?: string } | undefined): string {
  if (!info) {
    return '—';
  }
  const parts: string[] = [];
  if (info.label && info.label.startsWith('(')) {
    // "(built-in)" style labels stand alone
    return info.label;
  }
  if (info.label) parts.push(info.label);
  if (info.version) parts.push(info.version);
  if (info.source) parts.push(`(${info.source})`);
  if (info.path) parts.push(info.path);
  return parts.length > 0 ? parts.join(' ') : '—';
}

function padColumns(rows: string[][]): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  return rows.map((row) =>
    row
      .map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index] + 2)))
      .join('')
      .trimEnd()
  );
}

function needsAttention(diagnosis: LanguageDiagnosis): boolean {
  return diagnosis.verdict !== 'ok';
}

export function formatHumanReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push(
    `mcp-debugger doctor ${report.version} (${report.platform.os}-${report.platform.arch}, node ${report.platform.node})`
  );
  lines.push('');

  const tableRows: string[][] = [
    ['Adapter', 'Runtime', 'Debug backend', 'Verdict'],
    ...report.languages.map((diagnosis) => [
      diagnosis.language,
      cellFor(diagnosis.runtime),
      cellFor(diagnosis.backend),
      VERDICT_MARKS[diagnosis.verdict]
    ])
  ];
  lines.push(...padColumns(tableRows));
  lines.push('');

  lines.push('Platform checks');
  for (const check of report.platformChecks) {
    lines.push(`  ${STATUS_MARKS[check.status]} ${check.label}: ${check.detail}`);
    if (check.fixHint) {
      lines.push(`      fix: ${check.fixHint}`);
    }
  }
  lines.push('');

  if (report.unknownLanguages.length > 0) {
    lines.push(`Unknown languages requested: ${report.unknownLanguages.join(', ')}`);
    lines.push('');
  }

  const attention = report.languages.filter(needsAttention);
  const fixLines: string[] = [];
  for (const diagnosis of attention) {
    const reasons = [
      ...diagnosis.errors,
      ...diagnosis.warnings,
      ...(diagnosis.modes?.launch.available === false && diagnosis.errors.length === 0
        ? [diagnosis.modes.launch.reason ?? '']
        : [])
    ].filter((reason) => reason.length > 0);
    for (const reason of reasons) {
      fixLines.push(`  ${diagnosis.language}: ${reason}`);
    }
  }
  if (fixLines.length > 0) {
    lines.push('Fixes');
    lines.push(...fixLines);
    lines.push('');
  }

  if (attention.length === 0) {
    lines.push(`All ${report.languages.length} adapters healthy.`);
  } else {
    lines.push(
      `${attention.length} of ${report.languages.length} adapters need attention.` +
        (report.requested.length === 0
          ? " Run 'mcp-debugger doctor <language>' to gate the exit code on a specific language."
          : '')
    );
  }

  return lines.join('\n');
}

export function formatJsonReport(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}
