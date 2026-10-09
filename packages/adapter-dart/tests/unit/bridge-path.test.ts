/**
 * Where the bundled bridge script lives in each distribution layout (the .NET and COBOL
 * adapters walk the same candidates): the package's own dist, the npx bundle, the monorepo,
 * the cwd, and the Docker image.
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { bridgePathCandidates, resolveBridgePath } from '../../src/utils/bridge-path.js';

const here = 'C:\\repo\\packages\\adapter-dart\\dist';

describe('bridgePathCandidates', () => {
  it('starts with the package dist, then the npx bundle, the monorepo, the cwd, then /app', () => {
    const c = bridgePathCandidates(here, 'C:\\work');
    expect(c[0]).toBe(path.join(here, 'bridge', 'dap-stdio-bridge.js'));
    expect(c[1]).toBe(path.join(here, 'packages', 'adapter-dart', 'dist', 'bridge', 'dap-stdio-bridge.js'));
    expect(c).toContain(path.join('C:\\work', 'packages', 'adapter-dart', 'dist', 'bridge', 'dap-stdio-bridge.js'));
    expect(c.some((p) => p.startsWith('/app/'))).toBe(true);
  });
});

describe('resolveBridgePath', () => {
  it('returns the first candidate that exists', () => {
    const want = path.join('C:\\work', 'packages', 'adapter-dart', 'dist', 'bridge', 'dap-stdio-bridge.js');
    expect(resolveBridgePath(here, 'C:\\work', (p) => p === want)).toBe(want);
  });

  it('throws naming the build command when none exists', () => {
    expect(() => resolveBridgePath(here, 'C:\\work', () => false)).toThrow(/adapter-dart.*build|dap-stdio-bridge/);
  });
});
