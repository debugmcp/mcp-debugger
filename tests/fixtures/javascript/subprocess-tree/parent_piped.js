/**
 * Debuggee that forks a child and reads its stdout as a protocol (issue #1212).
 *
 * The fork's stdio is piped (`silent: true`), the way a program talks to a
 * worker it parses: every line the child writes must be one JSON object.
 * Anything else on that pipe is corruption, and this program says so and
 * exits 3. A logpoint in the child used to print there (the compiled
 * logpoint fell back to the child's `console.log`), so the parent read a
 * corrupted protocol under the debugger and a clean one without it.
 */
import { fork } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
console.log('parent start');
const child = fork(join(here, process.argv[2] ?? 'child_piped.js'), [], { silent: true, windowsHide: true });
let buffered = '';
let good = 0;
const bad = [];
child.stdout.on('data', (chunk) => {
  buffered += chunk;
  let newline;
  while ((newline = buffered.indexOf('\n')) >= 0) {
    const line = buffered.slice(0, newline);
    buffered = buffered.slice(newline + 1);
    try {
      JSON.parse(line);
      good += 1;
    } catch {
      bad.push(line);
    }
  }
});
child.stderr.on('data', () => {});
child.on('exit', (code) => {
  console.log(bad.length ? `protocol corrupted: ${JSON.stringify(bad)}` : `protocol ok ${good}`);
  process.exit(bad.length ? 3 : code ?? 1);
});
