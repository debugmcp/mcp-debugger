/**
 * Reproduce a plain fork inheriting its parent's fixed --inspect port (#1286).
 * The parent itself starts on port 0; give its resolved port to the child so
 * the child's arguments carry the parent's port even though it cannot bind it.
 */
import { fork } from 'node:child_process';
import { url } from 'node:inspector';
import { fileURLToPath } from 'node:url';

if (process.argv[2] === 'child') {
  let ticks = 0;
  setInterval(() => {
    console.log(`child tick ${++ticks}`);
    process.send?.('tick');
  }, 250);
  // Do not leave a child behind when the test kills its parent.
  process.on('disconnect', () => process.exit(0));
} else {
  const port = new URL(url()).port;
  const child = fork(fileURLToPath(import.meta.url), ['child'], {
    execArgv: [`--inspect=127.0.0.1:${port}`],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    windowsHide: true
  });
  let ticks = 0;
  setInterval(() => console.log(`parent tick ${++ticks}`), 500);
  child.once('message', () => console.log(`scan target ready child=${child.pid}`));
}
