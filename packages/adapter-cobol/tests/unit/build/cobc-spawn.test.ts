import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnCobc } from '../../../src/build/cobc-spawn.js';
import { findCobc, probeCobcVersion } from '../../../src/build/cobc-locator.js';
import { GnuCobolBuilder } from '../../../src/build/gnucobol-builder.js';

describe('compiler command spawning', () => {
  let dir: string | undefined;
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('preserves native argv and environment without shell interpretation', async () => {
    const args = ['space here', '& (literal)', '"quoted"', '%PATH%', 'trailing\\'];
    const child = spawnCobc(process.execPath, ['-e', 'console.log(JSON.stringify([process.env.COBC_TEST, process.argv.slice(1)]))', ...args], {
      env: { ...process.env, COBC_TEST: 'configured' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout!.on('data', chunk => { output += String(chunk); });
    const code = await new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    expect(code).toBe(0);
    expect(JSON.parse(output)).toEqual(['configured', args]);
  });

  it.skipIf(process.platform !== 'win32').each(['cmd', 'bat'])('discovers and builds through a real .%s wrapper with spaces and metacharacters', async extension => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'cobc wrapper & test '));
    const cli = path.join(dir, 'compiler.cjs');
    const log = path.join(dir, 'argv.json');
    const fixtures = fileURLToPath(new URL('../../fixtures/cobc/3.2-linux/hello-dw4/', import.meta.url));
    writeFileSync(cli, `
      const fs = require('node:fs');
      const path = require('node:path');
      const args = process.argv.slice(2);
      if (args.includes('--version')) { console.log('cobc (GnuCOBOL) 3.2.0'); process.exit(0); }
      fs.writeFileSync(process.env.COBC_WRAPPER_LOG, JSON.stringify(args));
      if (args.includes('--fail')) { console.error('wrapper compile failed'); process.exit(7); }
      for (const file of ['hello.c', 'hello.c.h', 'hello.c.l.h']) fs.copyFileSync(path.join(process.env.COBC_WRAPPER_FIXTURES, file), file);
      fs.copyFileSync(path.join(process.env.COBC_WRAPPER_FIXTURES, 'hello-dw4.lst'), args[args.indexOf('-t') + 1]);
      if (args.includes('-o')) fs.writeFileSync(args[args.indexOf('-o') + 1], 'test binary');
    `);
    const wrapper = path.join(dir, `cobc.${extension}`);
    writeFileSync(wrapper, `@echo off\r\n"${process.execPath}" "${cli}" %*\r\nexit /b %errorlevel%\r\n`);
    const env = { ...process.env, COBC_PATH: wrapper, COBC_WRAPPER_LOG: log, COBC_WRAPPER_FIXTURES: fixtures };
    const cobc = await findCobc({ env });
    expect(cobc?.path).toBe(wrapper);
    expect(cobc?.version).toBe('3.2.0');
    const sourceDir = path.join(dir, 'source (space) & data');
    mkdirSync(sourceDir);
    const source = path.join(sourceDir, 'hello.cob');
    writeFileSync(source, '       PROGRAM-ID. HELLO.\n');
    const flags = ['-DVALUE=hello & (world)', '-DQUOTED="quoted value"'];
    const builder = new GnuCobolBuilder({ cobc: cobc!, env });
    const result = await builder.build({ program: source, mode: 'executable', cobcFlags: flags, copybookDirs: [sourceDir] });
    expect(result.success, result.error).toBe(true);
    const received = JSON.parse(readFileSync(log, 'utf8'));
    expect(received).toEqual(result.argv);
    expect(received).toContain(source);
    expect(received).toEqual(expect.arrayContaining(flags));
    const failed = await builder.build({ program: source, mode: 'executable', cobcFlags: ['--fail'] });
    expect(failed.success).toBe(false);
    expect(failed.error).toMatch(/code 7.*wrapper compile failed/s);
    writeFileSync(wrapper, '@exit /b 9\r\n');
    expect(await probeCobcVersion(wrapper)).toBeNull();
  });
});
