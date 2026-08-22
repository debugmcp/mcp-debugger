/**
 * Unit tests for the doctor command's output formatting (issue #423).
 */
import { describe, it, expect } from 'vitest';
import { formatHumanReport, formatJsonReport } from '../../../../src/cli/commands/doctor/format.js';
import type { DoctorReport, LanguageDiagnosis } from '../../../../src/cli/commands/doctor/diagnose.js';

const language = (overrides: Partial<LanguageDiagnosis>): LanguageDiagnosis => ({
  language: 'python',
  package: '@debugmcp/adapter-python',
  installed: true,
  disabled: false,
  verdict: 'ok',
  errors: [],
  warnings: [],
  probe: { durationMs: 10, timedOut: false, failed: false },
  ...overrides
});

const report = (overrides: Partial<DoctorReport> = {}): DoctorReport => ({
  schemaVersion: 1,
  version: '0.1.0-test',
  platform: { os: 'win32', arch: 'x64', node: 'v22.0.0', containerMode: false },
  requested: [],
  unknownLanguages: [],
  languages: [
    language({
      language: 'python',
      runtime: { label: 'Python', path: 'C:\\Python313\\python.exe', version: '3.13.2' },
      backend: { label: 'debugpy', version: '1.8.14' }
    }),
    language({
      language: 'go',
      package: '@debugmcp/adapter-go',
      verdict: 'broken',
      errors: ['Delve not found. Run: go install github.com/go-delve/delve/cmd/dlv@latest'],
      runtime: { label: 'Go', version: '1.24.1' }
    })
  ],
  platformChecks: [
    { id: 'container-mode', label: 'container mode', status: 'ok', detail: 'not running in container mode' },
    { id: 'workspace-mount', label: 'workspace mount', status: 'skipped', detail: 'host mode' },
    { id: 'yama-ptrace-scope', label: 'yama ptrace_scope', status: 'skipped', detail: 'linux only' }
  ],
  exitCode: 0,
  ...overrides
});

describe('formatHumanReport', () => {
  it('renders a header line, a column header, and one row per adapter', () => {
    const output = formatHumanReport(report());
    const lines = output.split('\n');

    expect(lines[0]).toContain('mcp-debugger doctor 0.1.0-test');
    expect(lines[0]).toContain('win32-x64');
    const headerLine = lines.find((l) => l.includes('Adapter') && l.includes('Verdict'));
    expect(headerLine).toBeDefined();
    expect(headerLine).toContain('Runtime');
    expect(headerLine).toContain('Debug backend');
    expect(output).toContain('python');
    expect(output).toContain('3.13.2');
    expect(output).toContain('debugpy 1.8.14');
  });

  it('aligns the verdict column across all adapter rows', () => {
    const output = formatHumanReport(report());
    const lines = output.split('\n');
    const rows = lines.filter((l) => /^(python|go)\s/.test(l));

    expect(rows).toHaveLength(2);
    const verdictIndices = rows.map((row) => Math.max(row.indexOf('✅'), row.indexOf('❌')));
    expect(new Set(verdictIndices).size).toBe(1);
  });

  it('marks verdicts with the house emoji', () => {
    const output = formatHumanReport(report());

    expect(output).toContain('✅ ok');
    expect(output).toContain('❌ broken');
  });

  it('lists fixes only for adapters that need attention', () => {
    const output = formatHumanReport(report());

    expect(output).toContain('Fixes');
    expect(output).toContain('go install github.com/go-delve/delve/cmd/dlv@latest');
    const fixesBlock = output.slice(output.indexOf('Fixes'));
    expect(fixesBlock).not.toContain('python:');
  });

  it('omits the fixes section when everything is healthy', () => {
    const healthy = report({
      languages: [language({ runtime: { label: 'Python', version: '3.13.2' } })]
    });

    expect(formatHumanReport(healthy)).not.toContain('Fixes');
  });

  it('renders the platform checks with their details', () => {
    const output = formatHumanReport(report());

    expect(output).toContain('Platform checks');
    expect(output).toContain('container mode');
    expect(output).toContain('linux only');
  });

  it('renders platform check fix hints', () => {
    const withHint = report({
      platformChecks: [
        {
          id: 'yama-ptrace-scope',
          label: 'yama ptrace_scope',
          status: 'warn',
          detail: 'ptrace_scope=1 (attach limited to child processes)',
          fixHint: 'sudo sysctl kernel.yama.ptrace_scope=0'
        }
      ]
    });

    expect(formatHumanReport(withHint)).toContain('sudo sysctl kernel.yama.ptrace_scope=0');
  });

  it('calls out unknown requested languages', () => {
    const output = formatHumanReport(report({ unknownLanguages: ['nosuchlang'], exitCode: 1 }));

    expect(output).toContain('nosuchlang');
  });

  it('summarizes how many adapters need attention', () => {
    const output = formatHumanReport(report());

    expect(output).toContain('1 of 2 adapters need attention');
  });
});

describe('formatJsonReport', () => {
  it('round-trips the report object', () => {
    const input = report();

    expect(JSON.parse(formatJsonReport(input))).toEqual(JSON.parse(JSON.stringify(input)));
  });
});
