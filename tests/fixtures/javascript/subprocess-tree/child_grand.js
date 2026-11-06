/**
 * A child that starts a grandchild (issue #1082).
 *
 * The grandchild chain of the session tree's suites: parent.js started with
 * this script's name as its argument forks it as the child; it ticks once on
 * its own breakpoint, then runs grandchild.js synchronously the way the spike
 * did (`spawnSync(process.execPath, …)`), and exits with its status. js-debug
 * reports the grandchild on this process's connection, so its session hangs
 * under this one.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
console.log('child start');
setTimeout(() => {
  const marker = 1; // BREAKPOINT
  console.log(`child step ${marker}`);
  const result = spawnSync(process.execPath, [join(here, 'grandchild.js')], { stdio: 'inherit', windowsHide: true });
  console.log(`child grandchild exit ${result.status}`);
  process.exit(result.status ?? 1);
}, 200);
