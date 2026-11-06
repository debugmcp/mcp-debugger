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
 *
 * The injection is a moment later than the attach's answer: js-debug sets
 * `NODE_OPTIONS` and `VSCODE_INSPECTOR_OPTIONS` in this process's environment
 * over the inspector, with retries, after the attach request has been
 * answered (measured on a slow CI runner: a child forked right after the
 * answer ran unreported). The `go` line therefore waits for the injection (at
 * most 5 s) before forking; a `now` line forks at once, for an attach that
 * opted out, where nothing is ever injected.
 */
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const injected = () => typeof process.env.VSCODE_INSPECTOR_OPTIONS === 'string';
console.log('ATTACH_PARENT_READY');
process.stdin.setEncoding('utf8');
process.stdin.once('data', (line) => {
  const waitForInjection = String(line).trim() !== 'now';
  const deadline = Date.now() + 5000;
  const start = () => {
    if (waitForInjection && !injected() && Date.now() < deadline) {
      setTimeout(start, 25);
      return;
    }
    console.log(`parent go (${injected() ? 'bootloader injected' : 'no bootloader'})`);
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
  };
  start();
});
