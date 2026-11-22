/**
 * The session layer reads a connection's DAP client behaviour in one place
 * (issue #1211).
 *
 * An adopted child's connection runs the child-safe derivative of its
 * language's policy: no in-session adoption, no child routing, no breakpoint
 * mirroring. Code that asks the language's policy for those answers gets the
 * root connection's, and treats a child as if it were the launch root: a
 * child's breakpoints never received the adapter's ids that way. So the
 * session and server layers reach `getDapClientBehavior` only through
 * `connectionBehaviorOf(session, policy)` (`src/session/connection-behavior.ts`;
 * `SessionManagerCore.clientBehaviorOf` and `OperationsContext.clientBehaviorOf`
 * are its two callers), and never read the flags that drive in-session
 * adoption at all.
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

const LAYER = ['src/session', 'src/server', 'src/server.ts'].flatMap(sources);
const seam = (): string => 'src/session/connection-behavior.ts';
const mentions = (token: RegExp): string[] =>
  LAYER.filter((file) => token.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));

describe('the connection-behaviour seam of the session layer', () => {
  it('finds the layer', () => {
    expect(LAYER.length).toBeGreaterThan(40);
    expect(LAYER).toContain('src/session/session-manager-core.ts');
  });

  it('reads getDapClientBehavior only in connectionBehaviorOf', () => {
    const seam = 'src/session/connection-behavior.ts';
    expect(mentions(/getDapClientBehavior/)).toEqual([seam]);
    const calls = fs.readFileSync(path.join(ROOT, seam), 'utf8')
      .split('\n')
      .filter((line) => /getDapClientBehavior\??\.?\(/.test(line) && !/^\s*(\/?\*|\/\/)/.test(line));
    expect(calls).toHaveLength(1);
  });

  it('resolves connectionBehaviorOf in two places: the core and the operations facade', () => {
    expect(mentions(/connectionBehaviorOf\(/).sort()).toEqual([
      seam(),
      'src/session/session-manager-core.ts',
      'src/session/session-manager-operations.ts'
    ].sort());
  });

  it('never reads the flags that drive in-session adoption', () => {
    expect(mentions(/supportsReverseStartDebugging|childSessionStrategy|childRoutedCommands|childRequiredCommands|stackTraceRequiresChild/)).toEqual([]);
  });
});
