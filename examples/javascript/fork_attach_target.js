/**
 * Forking attach target for the JavaScript attach smoke tests (issue #501).
 *
 * Started as: node --inspect=127.0.0.1:<port> fork_attach_target.js
 *
 * The parent ticks forever and fork()s a child every 2s; each child announces
 * itself over the IPC channel and exits, and the parent logs
 * `child-handshake <n> pid=<pid>` on receipt — mirroring the fork + init-ACK
 * pattern of mcp-debugger's own ProxyManager. A child that never completes the
 * handshake (parked in waitForDebugger by a debugger's auto-attach bootloader)
 * is logged as `child-wedged pid=<pid>` and killed so wedges cannot pile up.
 */
import { fork } from 'child_process';
import { fileURLToPath } from 'url';

const selfPath = fileURLToPath(import.meta.url);

if (process.send) {
  // Child branch: announce over IPC, then exit once the parent acks (or after
  // a short grace so an unacked child never lingers)
  process.send({ type: 'child-ready', pid: process.pid });
  process.on('message', (msg) => {
    if (msg && msg.type === 'ack') {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(0), 2000);
} else {
  const FORK_INTERVAL_MS = 2000;
  const HANDSHAKE_TIMEOUT_MS = 5000;
  const MAX_CONCURRENT_CHILDREN = 5;

  let tickCounter = 0;
  let handshakeCounter = 0;
  const pendingChildren = new Set();

  function tick() {
    tickCounter += 1;
    if (tickCounter % 10 === 0) {
      console.log(`tick ${tickCounter}`);
    }
  }

  function spawnChild() {
    if (pendingChildren.size >= MAX_CONCURRENT_CHILDREN) {
      return;
    }
    // execArgv: [] so children don't inherit the parent's --inspect flag and
    // fight over its port. The #501 wedge mechanism is unaffected: js-debug's
    // auto-attach bootloader rides NODE_OPTIONS (env), which fork() inherits.
    const child = fork(selfPath, [], { execArgv: [], stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
    pendingChildren.add(child);

    const wedgeTimer = setTimeout(() => {
      console.log(`child-wedged pid=${child.pid}`);
      child.kill('SIGKILL');
    }, HANDSHAKE_TIMEOUT_MS);

    child.on('message', (msg) => {
      if (msg && msg.type === 'child-ready') {
        clearTimeout(wedgeTimer);
        handshakeCounter += 1;
        console.log(`child-handshake ${handshakeCounter} pid=${msg.pid}`);
        try {
          child.send({ type: 'ack' });
        } catch {
          // Child may already have exited on its own grace timer
        }
      }
    });
    child.on('exit', () => {
      clearTimeout(wedgeTimer);
      pendingChildren.delete(child);
    });
    child.on('error', () => {
      clearTimeout(wedgeTimer);
      pendingChildren.delete(child);
    });
  }

  setInterval(tick, 100);
  setInterval(spawnChild, FORK_INTERVAL_MS);
  spawnChild();
  console.log('fork attach target started');
}
