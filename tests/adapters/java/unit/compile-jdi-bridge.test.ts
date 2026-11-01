/**
 * The build script's staleness verdict and the record it leaves beside the class
 * (issue #1054). Real files in a temp dir; no javac involved — the compile itself is
 * the one thing this script does that these tests do not run.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { createHash } from 'crypto';
import {
  BUILD_RECORD,
  TARGET_RELEASE,
  needsCompilation,
  writeBuildRecord,
  ensureBuildRecord,
  sourceSha256
// Extensionless on purpose: the vitest alias rewrites a relative `.js` import to `.ts`, and this
// is a plain-JS build script (typed by the sibling .d.ts; tsconfig.spec.json resolves as Bundler).
} from '../../../../packages/adapter-java/scripts/compile-jdi-bridge';

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const SOURCE = 'public class JdiDapServer { /* shipped */ }';

describe('compile-jdi-bridge', () => {
  let javaDir: string;
  let sourceFile: string;
  let outDir: string;
  let classFile: string;

  const setMtimes = (sourceSeconds: number, classSeconds: number): void => {
    utimesSync(sourceFile, sourceSeconds, sourceSeconds);
    utimesSync(classFile, classSeconds, classSeconds);
  };

  beforeEach(() => {
    javaDir = mkdtempSync(path.join(tmpdir(), 'jdi-bridge-'));
    sourceFile = path.join(javaDir, 'JdiDapServer.java');
    outDir = path.join(javaDir, 'out');
    classFile = path.join(outDir, 'JdiDapServer.class');
    mkdirSync(outDir);
    writeFileSync(sourceFile, SOURCE);
    writeFileSync(classFile, Buffer.from([0xca, 0xfe, 0xba, 0xbe]));
  });

  afterEach(() => {
    rmSync(javaDir, { recursive: true, force: true });
  });

  it('names the record the adapter reads', () => {
    expect(BUILD_RECORD).toBe('jdi-bridge-build.json');
    expect(TARGET_RELEASE).toBe(21);
  });

  it('hashes the source bytes', () => {
    expect(sourceSha256(sourceFile)).toBe(sha256(SOURCE));
  });

  it('compiles when the class is missing', () => {
    rmSync(classFile);
    expect(needsCompilation({ sourceFile, classFile, outDir })).toBe(true);
  });

  it('with a matching record, a newer source mtime does not force a compile (npm extraction order)', () => {
    writeBuildRecord(outDir, sourceFile);
    setMtimes(3000, 2000);
    expect(needsCompilation({ sourceFile, classFile, outDir })).toBe(false);
  });

  it('with a record naming another source, a newer class mtime does not save the compile', () => {
    writeFileSync(path.join(outDir, BUILD_RECORD), JSON.stringify({ sourceSha256: sha256('older'), release: TARGET_RELEASE }));
    setMtimes(1000, 2000);
    expect(needsCompilation({ sourceFile, classFile, outDir })).toBe(true);
  });

  it('without a record, the mtime comparison stands', () => {
    setMtimes(3000, 2000);
    expect(needsCompilation({ sourceFile, classFile, outDir })).toBe(true);
    setMtimes(1000, 2000);
    expect(needsCompilation({ sourceFile, classFile, outDir })).toBe(false);
  });

  it('writes the record the adapter expects', () => {
    writeBuildRecord(outDir, sourceFile);
    const recordPath = path.join(outDir, BUILD_RECORD);
    expect(existsSync(recordPath)).toBe(true);
    expect(JSON.parse(readFileSync(recordPath, 'utf8'))).toEqual({ sourceSha256: sha256(SOURCE), release: TARGET_RELEASE });
  });

  it('an unreadable record falls back to the mtime comparison', () => {
    writeFileSync(path.join(outDir, BUILD_RECORD), '{ not json');
    setMtimes(1000, 2000);
    expect(needsCompilation({ sourceFile, classFile, outDir })).toBe(false);
  });

  it('a class that is current by mtime but has no record is adopted: the record is written for it', () => {
    // A dev box whose java/out predates the record: the build says "up to date" and would
    // otherwise ship a bundle with no record, which a fresh install then calls stale by mtime.
    setMtimes(1000, 2000);
    expect(ensureBuildRecord({ sourceFile, classFile, outDir })).toBe(true);
    expect(JSON.parse(readFileSync(path.join(outDir, BUILD_RECORD), 'utf8'))).toEqual({ sourceSha256: sha256(SOURCE), release: TARGET_RELEASE });
  });

  it('ensureBuildRecord leaves an existing record alone', () => {
    const foreign = JSON.stringify({ sourceSha256: sha256('other'), release: TARGET_RELEASE });
    writeFileSync(path.join(outDir, BUILD_RECORD), foreign);
    expect(ensureBuildRecord({ sourceFile, classFile, outDir })).toBe(false);
    expect(readFileSync(path.join(outDir, BUILD_RECORD), 'utf8')).toBe(foreign);
  });
});
