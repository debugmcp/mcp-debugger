import { promises as fs } from 'fs';
import path from 'path';

export interface BinaryInfo {
  format: 'msvc' | 'gnu' | 'unknown';
  hasPDB: boolean;
  hasRSDS: boolean;
  imports: string[];
  debugInfoType?: 'pdb' | 'dwarf' | 'none';
}

const MAX_SCAN_BYTES = 1024 * 1024; // 1MB should be enough for headers/import tables
const RSDS_SIGNATURE = Buffer.from('RSDS', 'ascii');
const DWARF_HINTS = ['.debug_info', 'dwarf'];
const MSVC_IMPORTS = ['vcruntime140.dll', 'ucrtbase.dll', 'msvcp140.dll'];
const GNU_IMPORTS = ['msvcrt.dll', 'libstdc++', 'libgcc'];

function bufferContains(haystack: Buffer, needle: Buffer): boolean {
  return haystack.indexOf(needle) !== -1;
}

function collectImports(buffer: Buffer): string[] {
  const ascii = buffer.toString('ascii').toLowerCase();
  const imports = new Set<string>();

  for (const dll of [...MSVC_IMPORTS, ...GNU_IMPORTS]) {
    if (ascii.includes(dll.toLowerCase())) {
      imports.add(dll);
    }
  }

  return Array.from(imports);
}

function detectDebugInfo(buffer: Buffer, hasPDB: boolean, hasRSDS: boolean): BinaryInfo['debugInfoType'] {
  if (hasPDB || hasRSDS) {
    return 'pdb';
  }

  const ascii = buffer.toString('ascii').toLowerCase();
  if (DWARF_HINTS.some(hint => ascii.includes(hint))) {
    return 'dwarf';
  }

  return 'none';
}

function classifyFormat(imports: string[], debugInfoType: BinaryInfo['debugInfoType']): BinaryInfo['format'] {
  const loweredImports = imports.map(i => i.toLowerCase());
  const hasMSVCImport = loweredImports.some(i => MSVC_IMPORTS.includes(i));
  const hasGNUImport = loweredImports.some(i => GNU_IMPORTS.some(g => i.includes(g)));

  if (hasMSVCImport) {
    return 'msvc';
  }

  if (hasGNUImport || debugInfoType === 'dwarf') {
    return 'gnu';
  }

  return 'unknown';
}

export async function detectBinaryFormat(exePath: string): Promise<BinaryInfo> {
  const info: BinaryInfo = {
    format: 'unknown',
    hasPDB: false,
    hasRSDS: false,
    imports: [],
    debugInfoType: 'none'
  };

  try {
    const stats = await fs.stat(exePath);
    if (!stats.isFile()) {
      return info;
    }

    const dir = path.dirname(exePath);
    const baseName = path.basename(exePath, path.extname(exePath));
    const pdbPath = path.join(dir, `${baseName}.pdb`);

    try {
      const pdbStats = await fs.stat(pdbPath);
      if (pdbStats.isFile()) {
        info.hasPDB = true;
      }
    } catch {
      info.hasPDB = false;
    }

    const readLength = Math.min(stats.size, MAX_SCAN_BYTES);
    const buffer = Buffer.alloc(readLength);
    const fileHandle = await fs.open(exePath, 'r');
    try {
      await fileHandle.read(buffer, 0, readLength, 0);
    } finally {
      await fileHandle.close();
    }

    info.hasRSDS = bufferContains(buffer, RSDS_SIGNATURE);
    info.imports = collectImports(buffer);
    info.debugInfoType = detectDebugInfo(buffer, info.hasPDB, info.hasRSDS);
    info.format = classifyFormat(info.imports, info.debugInfoType);

    return info;
  } catch {
    return info;
  }
}
