import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const directory = process.env.DEV_PROXY_BUILD_FIXTURE_DIR;
const events = process.env.DEV_PROXY_FIXTURE_EVENTS;
const record = (event) => appendFileSync(events, JSON.stringify({ ...event, pid: process.pid }) + '\n');

// Even a failing test cannot strand these fixtures indefinitely.
setTimeout(() => process.exit(3), 30_000).unref();
if (process.env.DEV_PROXY_BUILD_IGNORE_TERM === '1') process.on('SIGTERM', () => {});

if (process.argv.includes('--child')) {
  record({ kind: 'build-child' });
  await delay(30_000);
} else {
  const previous = existsSync(events) ? readFileSync(events, 'utf8').trim().split('\n').map(JSON.parse) : [];
  const index = previous.filter(event => event.kind === 'build-start').length + 1;
  record({ kind: 'build-start', index, tool: process.env.DEV_PROXY_FIXTURE_TOOL });
  console.log(`build ${index} started`);
  let child;
  if (process.env.DEV_PROXY_BUILD_CHILD === '1') {
    child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--child'], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  }
  const release = path.join(directory, `release-${index}`);
  while (!existsSync(release)) await delay(20);
  const code = Number(readFileSync(release, 'utf8'));
  if (child) {
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
  }
  record({ kind: 'build-end', index, code });
  process.exit(code);
}
