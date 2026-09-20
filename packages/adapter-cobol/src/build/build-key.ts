/**
 * Build key: a short content hash that names one artifact directory per
 * (compiler version, flags, source contents) combination. A fresh key
 * directory per change sidesteps in-place replacement of a running
 * executable (Windows locks it) and makes staleness a pure key comparison.
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

export interface BuildKeyInput {
  cobcVersion: string;
  /** cobc argv with output paths already removed (the key must not depend on where artifacts land). */
  argv: string[];
  /** Every input file: the sources given plus the copybooks the previous build recorded. */
  files: Array<{ path: string; contentHash: string }>;
}

export const BUILD_KEY_LENGTH = 12;

export function hashFileContents(filePath: string, read: (p: string) => Buffer = readFileSync): string {
  return createHash('sha256').update(read(filePath)).digest('hex');
}

export function computeBuildKey(input: BuildKeyInput): string {
  const hash = createHash('sha256');
  hash.update('control-flow-parser:1\n');
  hash.update(`cobc:${input.cobcVersion}\n`);
  hash.update(`argv:${JSON.stringify(input.argv)}\n`);
  const files = [...input.files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of files) {
    hash.update(`file:${file.path.toLowerCase()}:${file.contentHash}\n`);
  }
  return hash.digest('hex').slice(0, BUILD_KEY_LENGTH);
}
