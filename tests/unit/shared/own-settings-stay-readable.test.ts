/**
 * This project's own settings stay readable where the environment is displayed
 * (issue #1129).
 *
 * `sanitizeEnvForLogging` masks a value by its variable's NAME, with broad
 * rules on purpose: a secret that is shown is worse than a number that is
 * hidden. The cost of a broad rule lands on names the rules were never meant
 * for — `MCP_DEBUG_SESSION_IDLE_MS` was displayed as `[REDACTED]` because
 * `SESSION_IDLE` contains `SESSION_ID`, and the operator could not read back
 * which idle window was in force from `dev_server_status`.
 *
 * So the names this project itself reads are checked against the rules: every
 * `MCP_*`, `DEBUG_MCP_*` and `DEV_PROXY_*` name in the sources must display
 * its value, unless it is listed below as masked on purpose. A new setting
 * whose value IS a secret (an auth token for the http mode, say) fails here
 * until it is added to that list — a decision someone makes, not an accident
 * of spelling.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sanitizeEnvForLogging } from '@debugmcp/shared';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Settings of this project whose value is a secret: masked on purpose. */
const MASKED_ON_PURPOSE: readonly string[] = [];

const OWN_SETTING = /\b(?:MCP|DEBUG_MCP|DEV_PROXY)_[A-Z0-9]+(?:_[A-Z0-9]+)*\b/g;

function sourceFiles(): string[] {
  const roots: Array<{ dir: string; accept: (file: string) => boolean }> = [
    { dir: path.join(REPO_ROOT, 'src'), accept: (file) => file.endsWith('.ts') },
    { dir: path.join(REPO_ROOT, 'tools', 'dev-proxy'), accept: (file) => file.endsWith('.mjs') }
  ];
  for (const pkg of fs.readdirSync(path.join(REPO_ROOT, 'packages'))) {
    const src = path.join(REPO_ROOT, 'packages', pkg, 'src');
    if (fs.existsSync(src)) {
      roots.push({ dir: src, accept: (file) => file.endsWith('.ts') });
    }
  }
  return roots.flatMap(({ dir, accept }) =>
    (fs.readdirSync(dir, { recursive: true }) as string[])
      .filter(accept)
      .map((file) => path.join(dir, file))
  );
}

function ownSettingNames(): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles()) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(OWN_SETTING)) {
      names.add(match[0]);
    }
  }
  return [...names].sort();
}

describe('this project\'s own settings where the environment is displayed (issue #1129)', () => {
  const names = ownSettingNames();

  it('finds the settings: the scan is not vacuous', () => {
    expect(names.length).toBeGreaterThan(30);
    expect(names).toEqual(expect.arrayContaining([
      'MCP_DEBUG_SESSION_IDLE_MS',
      'MCP_DEBUG_SESSION_IDLE_SWEEP_MS',
      'MCP_HTTP_STALE_SESSION_MS',
      'DEBUG_MCP_MAX_CHILD_SESSIONS',
      'DEV_PROXY_BACKEND_ERA'
    ]));
  });

  it('masks none of them except the ones listed as secrets', () => {
    const shown = sanitizeEnvForLogging(Object.fromEntries(names.map((name) => [name, 'value'])));
    const masked = names.filter((name) => shown[name] !== 'value');

    expect(masked).toEqual([...MASKED_ON_PURPOSE].sort());
  });

  it('lists as secrets only names that exist', () => {
    expect(MASKED_ON_PURPOSE.filter((name) => !names.includes(name))).toEqual([]);
  });
});
