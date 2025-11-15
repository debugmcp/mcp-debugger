import path from 'path';
import { promises as fs } from 'fs';
import { detectBinaryFormat, type BinaryInfo } from '@debugmcp/adapter-rust';

export interface CheckRustBinaryOptions {
  json?: boolean;
}

function formatImports(imports: string[]): string {
  if (!imports.length) {
    return '  - None detected';
  }
  return imports.map((entry) => `  - ${entry}`).join('\n');
}

function formatSummary(info: BinaryInfo, targetPath: string): string {
  const lines = [
    '',
    `Binary Analysis: ${targetPath}`,
    '=========================================',
    '',
    `Toolchain:     ${info.format.toUpperCase()}`,
    `Debug Format:  ${(info.debugInfoType ?? 'none').toUpperCase()}`,
    `PDB Present:   ${info.hasPDB ? 'YES' : 'NO'}`,
    `RSDS Marker:   ${info.hasRSDS ? 'YES' : 'NO'}`,
    '',
    'Runtime Dependencies:',
    formatImports(
      info.imports.filter((entry) =>
        /msvcrt|vcruntime|ucrtbase|msvcp|libstdc\+\+|libgcc/i.test(entry)
      )
    ),
    '',
    'Debugging Compatibility:',
    info.format === 'gnu'
      ? '  - ✅ Full support with CodeLLDB'
      : info.format === 'msvc'
        ? '  - ⚠️  Limited support (control flow only)'
        : '  - ❓ Unknown format - debugging may not work',
    '',
  ];

  if (info.format === 'msvc') {
    lines.push(
      'Recommended: rebuild with GNU toolchain for complete debugger support:',
      '  rustup target add x86_64-pc-windows-gnu',
      '  cargo clean',
      '  cargo +stable-gnu build',
      ''
    );
  }

  return `${lines.join('\n')}`;
}

function writeOutput(text: string): void {
  process.stdout.write(text);
  if (!text.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

function writeError(text: string): void {
  process.stderr.write(`${text}\n`);
}

export async function handleCheckRustBinaryCommand(
  binaryPath: string,
  options: CheckRustBinaryOptions = {}
): Promise<void> {
  if (!binaryPath || typeof binaryPath !== 'string') {
    throw new Error('A path to the Rust executable is required.');
  }

  const resolvedPath = path.resolve(binaryPath);

  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Path does not point to a file: ${resolvedPath}`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to access the provided path';
    writeError(message);
    throw error;
  }

  const info = await detectBinaryFormat(resolvedPath);

  if (options.json) {
    writeOutput(JSON.stringify({ path: resolvedPath, ...info }, null, 2));
    return;
  }

  writeOutput(formatSummary(info, resolvedPath));
}
