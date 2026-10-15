/** Hold the restart's OS listener probe while real MCP status requests arrive (#799). */
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const nativeExecFile = childProcess.execFile;
const runFile = promisify(nativeExecFile);
const execFile = (...args) => nativeExecFile(...args);
const release = path.join(process.env.DEV_PROXY_BUILD_FIXTURE_DIR, 'release-port-probe');
const record = kind => appendFileSync(process.env.DEV_PROXY_FIXTURE_EVENTS,
  JSON.stringify({ kind, pid: process.pid, ppid: process.ppid, at: Date.now() }) + '\n');
let probes = 0;
Object.defineProperty(execFile, promisify.custom, {
  value: async (command, args, options) => {
    if (['netstat', 'lsof'].includes(command.toLowerCase()) && ++probes === 2) {
      record('port-probe-blocked');
      const deadline = Date.now() + 8000;
      while (!existsSync(release)) {
        if (Date.now() >= deadline) {
          record('port-probe-expired');
          throw new Error('Test port probe was never released');
        }
        await delay(10);
      }
      record('port-probe-released');
    }
    return runFile(command, args, options);
  },
});
childProcess.execFile = execFile;
syncBuiltinESMExports();
