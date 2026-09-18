import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { verifyPackageContents } from '../../e2e/npx/npx-test-utils.js';

const execFileAsync = promisify(execFile);

describe('package contents verification (issue #752)', () => {
  let tempDir: string;
  let tarballPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'npx package contents '));
    const entries = [
      'package/dist/cli.mjs',
      'package/dist/vendor/js-debug/vsDebugServer.cjs',
      'package/dist/vendor/debugpy/__init__.py',
      'package/dist/mock.js',
      'package/skills/debugging/SKILL.md',
      'package/pi.mcp.json',
    ];
    for (const entry of entries) {
      const filePath = path.join(tempDir, entry);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, 'fixture\n');
    }

    // Spaces and a literal dollar sign must survive without shell expansion.
    const tarballName = 'package $contents.tgz';
    tarballPath = path.join(tempDir, tarballName);
    await execFileAsync('tar', ['-czf', `./${tarballName}`, 'package'], { cwd: tempDir });
  });

  afterAll(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it.each(['absolute', 'relative'] as const)('reads a real archive using a path that is %s', async (kind) => {
    const archivePath = kind === 'absolute'
      ? tarballPath
      : path.relative(process.cwd(), tarballPath);

    expect(await verifyPackageContents(archivePath)).toEqual({
      hasJavaScript: true,
      hasPython: true,
      hasMock: true,
      hasSkill: true,
      hasPiManifest: true,
      tarballSize: (await stat(tarballPath)).size,
    });
  });

  it('rejects a missing archive', async () => {
    await expect(verifyPackageContents(path.join(tempDir, 'missing.tgz'))).rejects.toThrow();
  });
});
