/**
 * A parent with two children at once (issue #1082): two forks of child.js,
 * both reported on this program's connection and adopted as siblings; the
 * parent waits for both and exits with the worse of their codes.
 */
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
console.log('parent start');
const children = [0, 1].map(() => fork(join(here, 'child.js'), [], { stdio: 'inherit', windowsHide: true }));
let worst = 0;
let exited = 0;
for (const child of children) {
  child.on('exit', (code) => {
    worst = Math.max(worst, code ?? 1);
    exited += 1;
    console.log(`parent child exit ${code}`);
    if (exited === children.length) {
      console.log(`parent done ${worst}`);
      process.exit(worst);
    }
  });
}
