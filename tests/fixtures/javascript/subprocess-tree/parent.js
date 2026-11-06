/**
 * Debuggee that forks a Node child js-debug can report (issue #1082).
 *
 * The session tree's M2 fixture. With `autoAttachChildProcesses` on, js-debug
 * parks the child this program forks and reports it on this program's own
 * connection; the server adopts the report as a child debug session
 * (`parentSessionId` = this session's id) that stops on the breakpoints set
 * on this session before launch. The parent pauses on its own breakpoint
 * while that happens, then waits for the child's exit code and exits with
 * it, so the whole tree's end is one number.
 */
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
console.log('parent start');
const childScript = join(here, process.argv[2] ?? 'child.js'); // argv names another child (child_grand.js)
const child = fork(childScript, [], { stdio: 'inherit', windowsHide: true });
const marker = child.pid; // BREAKPOINT: the parent pauses here while the child is reported and adopted
child.on('exit', (code) => {
  console.log(`parent child exit ${code} (${marker})`);
  process.exit(code ?? 1);
});
