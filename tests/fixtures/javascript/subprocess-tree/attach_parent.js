/**
 * The attach-mode parent of the session tree's attach fixture (issue #1082).
 *
 * Run as `node --inspect=127.0.0.1:<port> attach_parent.js`: the inspector is
 * up before the script runs (`Debugger listening on` on stderr), so a client
 * can attach at once. js-debug injects its auto-attach bootloader into this
 * process at attach time, so only a child started AFTER the attach is reported;
 * this script therefore waits for one line on stdin before it forks child.js
 * the way parent.js does, waits for the child and exits with its code, so a
 * tree that was released or closed can be seen running to its end on the
 * harness's own pipes.
 */
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
console.log('ATTACH_PARENT_READY');
process.stdin.setEncoding('utf8');
process.stdin.once('data', () => {
  console.log('parent go');
  // execArgv: [] so the child does not inherit this process's --inspect flag:
  // it would fight over the port, and js-debug's process-tree scan attaches to
  // any child whose arguments carry an inspector port as a nameless
  // "Child Process" target (seen on a slow CI runner) instead of the
  // bootloader's own report, which is what the session tree is built on.
  const child = fork(join(here, 'child.js'), [], { execArgv: [], stdio: 'inherit', windowsHide: true });
  child.on('exit', (code) => {
    console.log(`parent child exit ${code}`);
    process.exit(code ?? 1);
  });
});
