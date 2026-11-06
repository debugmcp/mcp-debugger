/**
 * A parent that exits with its child still running (issue #1082).
 *
 * The session tree's lifecycle row 2 for js-debug: the spike measured that
 * the program's exit kills its UNREPORTED children within 300 ms; what the
 * suite measures with this fixture is an already adopted child, paused on a
 * breakpoint when this parent exits (measured 2026-11-05: js-debug ends it
 * at the parent's exit — the launch owns the tree). The child is unref'd and
 * inherits stdio, the spike's shape; the parent waits long enough for the
 * child's first tick to stop and be observed before it exits.
 */
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
console.log('parent start');
const child = fork(join(here, 'child.js'), [], { stdio: 'inherit' });
child.unref();
child.disconnect();
setTimeout(() => {
  console.log('parent exiting');
  process.exit(0);
}, 4000);
