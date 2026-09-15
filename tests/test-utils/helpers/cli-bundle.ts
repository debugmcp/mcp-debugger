/**
 * Locate the bundled CLI (`packages/mcp-debugger/dist/cli.mjs`) for the tests
 * that execute it.
 *
 * It is a build artifact and no test project has a pretest build hook, so a
 * missing or stale bundle otherwise surfaces as an opaque spawn ENOENT — or,
 * worse, as "the code under test is broken". Fail by name instead, naming the
 * command that fixes it.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param root repository root (e.g. `fileURLToPath(new URL('../../', import.meta.url))`)
 * @returns the absolute path to the CLI bundle
 * @throws {Error} when it has not been built
 */
export function requireCliBundle(root: string): string {
  const cli = path.join(root, 'packages', 'mcp-debugger', 'dist', 'cli.mjs');
  if (!fs.existsSync(cli)) {
    throw new Error(
      `mcp-debugger CLI bundle missing at ${cli}. Run "pnpm --filter @debugmcp/mcp-debugger build" before executing this test.`
    );
  }
  return cli;
}
