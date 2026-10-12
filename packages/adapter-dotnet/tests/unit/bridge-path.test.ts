/**
 * Where the built bridge lives in each distribution layout (issue #743): the package's own
 * dist, that dist reached from the package's src, the npx bundle, the project root from a
 * node_modules copy, the cwd, and the Docker image. Fixture paths go through path.resolve so
 * the same test holds on Windows and POSIX.
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { bridgePathCandidates } from '../../src/utils/bridge-path.js';

const pkg = path.resolve('/repo/packages/adapter-dotnet');
const dist = path.join(pkg, 'dist');
const src = path.join(pkg, 'src');
const work = path.resolve('/work');
const REL = path.join('utils', 'netcoredbg-bridge.js');

describe('bridgePathCandidates (issue #743)', () => {
  it('starts with the package dist, then the npx bundle, the monorepo, the cwd, then /app', () => {
    const c = bridgePathCandidates(dist, work);
    expect(c[0]).toBe(path.join(dist, REL));
    expect(c[1]).toBe(path.join(dist, 'packages', 'adapter-dotnet', 'dist', REL));
    expect(c).toContain(path.join(work, 'packages', 'adapter-dotnet', 'dist', REL));
    expect(c.filter((p) => p.startsWith('/app/'))).toHaveLength(2);
    expect(new Set(c).size).toBe(c.length);
  });

  it('reaches the package dist from its src ahead of the cwd, whatever the cwd', () => {
    const elsewhere = path.resolve('/elsewhere');
    const c = bridgePathCandidates(src, elsewhere);
    expect(c[0]).toBe(path.join(src, REL));
    expect(c[1]).toBe(path.join(dist, REL));
    expect(c.indexOf(path.join(elsewhere, 'packages', 'adapter-dotnet', 'dist', REL))).toBeGreaterThan(1);
  });

  it('reaches the project root from node_modules/@debugmcp/adapter-dotnet/dist', () => {
    const project = path.resolve('/proj');
    const fromNodeModules = path.join(project, 'node_modules', '@debugmcp', 'adapter-dotnet', 'dist');
    expect(bridgePathCandidates(fromNodeModules, work)).toContain(path.join(project, 'packages', 'adapter-dotnet', 'dist', REL));
  });
});
