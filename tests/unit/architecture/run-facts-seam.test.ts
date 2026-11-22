/**
 * How a tree's program was started is read through the run-facts view
 * (issue #1214).
 *
 * Launch or attach, where an attach's target lives, the transformed launch
 * and the launch request are written on the session the tool was called on:
 * the tree's root. An adopted child has none of them, and a reader that asks
 * the session it was handed gets "nothing was launched" for a child (a false
 * stale-build note under vitest was one result). So outside the modules that
 * write those fields, the session and server layers read them through
 * `runFactsOf` (`src/session/run-facts.ts`), which reads the root.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function sources(relative: string): string[] {
  const full = path.join(ROOT, relative);
  if (fs.statSync(full).isFile()) {
    return [relative];
  }
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = `${relative}/${entry.name}`;
    return entry.isDirectory() ? sources(child) : entry.name.endsWith('.ts') ? [child] : [];
  });
}

/** Property reads of the run fields, comments aside. */
const RUN_FIELD_READ = /\.(attachMode|attachLocality|transformedLaunch|lastLaunch)\b/;
const readers = ['src/session', 'src/server', 'src/server.ts']
  .flatMap(sources)
  .filter((file) =>
    fs.readFileSync(path.join(ROOT, file), 'utf8')
      .split('\n')
      .some((line) => RUN_FIELD_READ.test(line) && !/^\s*(\/?\*|\/\/)/.test(line)))
  .sort();

describe('the run-facts seam of the session layer', () => {
  it('reads the run fields only where they are written, and in the view', () => {
    expect(readers).toEqual([
      // The launch-shaped tools refuse a child id: these work on roots.
      'src/session/launch/debug-launcher.ts',
      'src/session/launch/proxy-launcher.ts',
      // The view itself.
      'src/session/run-facts.ts',
      // The field declarations and `borrowsProgram`, which is asked about roots.
      'src/session/session-store.ts'
    ]);
  });
});
