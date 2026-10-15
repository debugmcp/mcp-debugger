/** Test-only reproduction of a slow Windows build-tree sweep (issue #930). */
import { appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

// Patch only this process's promisified taskkill /T. Backend subprocesses do not
// inherit --import. All other commands retain the native implementation.
const nativeExecFile = childProcess.execFile;
const runFile = promisify(nativeExecFile);
const execFile = (...args) => nativeExecFile(...args);
const record = kind => appendFileSync(process.env.DEV_PROXY_FIXTURE_EVENTS,
  JSON.stringify({ kind, pid: process.pid, ppid: process.ppid, at: Date.now() }) + '\n');
Object.defineProperty(execFile, promisify.custom, {
  configurable: true,
  value: async (command, args, options) => {
    if (command.toLowerCase() === 'taskkill' && args.some(arg => arg.toUpperCase() === '/T')) {
      record('tree-kill-delayed');
      // Hold dispatch until the test releases it. In the SDK-close reproduction
      // the supervisor dies first, so this marker can never race a fixed delay
      // in another process. A failed test still cannot hold cleanup forever.
      const release = path.join(process.env.DEV_PROXY_BUILD_FIXTURE_DIR, 'release-tree-kill');
      const deadline = Date.now() + 8000;
      while (!existsSync(release)) {
        if (Date.now() >= deadline) {
          record('tree-kill-expired');
          throw new Error('Test tree kill was never released');
        }
        await delay(10);
      }
      record('tree-kill-dispatched');
    }
    return runFile(command, args, options);
  },
});

// The native function's promisifier is non-configurable; wrap the exported
// function and refresh its public ESM binding instead of redefining it.
childProcess.execFile = execFile;
syncBuiltinESMExports();
