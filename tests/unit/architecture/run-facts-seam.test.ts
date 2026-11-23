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

/**
 * The shapes a read of a run field takes: a property (`session.attachMode`,
 * `session?.attachMode`), an indexed access (`session['attachMode']`), and a
 * destructuring (`const { attachMode } = session`, over several lines too).
 * An object literal that names a field (`{ attachMode: true }`) writes it.
 */
const RUN_FIELD_READS = [
  /\.(attachMode|attachLocality|transformedLaunch|lastLaunch)\b/,
  /\[\s*(['"`])(attachMode|attachLocality|transformedLaunch|lastLaunch)\1\s*\]/,
  /\{[^{}]*\b(attachMode|attachLocality|transformedLaunch|lastLaunch)\b[^{}]*\}\s*=(?![=>])/
];

/** Whether source text reads a run field, comment lines aside. */
function readsRunField(source: string): boolean {
  const code = source
    .split('\n')
    .filter((line) => !/^\s*(\/?\*|\/\/)/.test(line))
    .join('\n');
  return RUN_FIELD_READS.some((shape) => shape.test(code));
}

const readers = ['src/session', 'src/server', 'src/server.ts']
  .flatMap(sources)
  .filter((file) => readsRunField(fs.readFileSync(path.join(ROOT, file), 'utf8')))
  .sort();

describe('what the run-facts seam guard reads as a read of a run field', () => {
  it.each([
    ['a property', 'const attached = session.attachMode === true;'],
    ['an optional property', 'const where = session?.attachLocality;'],
    ['an indexed access', "const launch = session['transformedLaunch'];"],
    ['an indexed access in double quotes', 'const request = session["lastLaunch"];'],
    ['an indexed access in backquotes', 'const attached = session[`attachMode`];'],
    ['a destructuring', 'const { attachMode } = session;'],
    ['a renaming destructuring among other fields', 'const { id, lastLaunch: request } = root;'],
    ['a destructuring over several lines', 'const {\n  id,\n  transformedLaunch,\n} = session;'],
    ['a destructuring assignment', '({ attachLocality: where } = session);']
  ])('catches %s', (_shape, source) => {
    expect(readsRunField(source)).toBe(true);
  });

  it.each([
    ['a line comment', "// session.attachMode is the root's"],
    ['a doc comment line', ' * reads session.lastLaunch off the root'],
    ['an object literal that writes the fields', 'this.ctx.updateSession(sessionId, { attachMode: true, attachLocality });'],
    ['a literal property built from the view', '  attachMode: run.attached,'],
    ["an arrow's return type", 'const none = (): { attachMode: boolean } => ({ attachMode: false });'],
    ['a comparison', 'const same = { attachMode } === expected;']
  ])('leaves alone %s', (_shape, source) => {
    expect(readsRunField(source)).toBe(false);
  });
});

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
