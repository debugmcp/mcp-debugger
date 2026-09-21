/**
 * Conservative PE inspection for prebuilt COBOL binaries. Read section names and
 * actual CodeView records, never arbitrary strings or an unrelated sibling PDB.
 * Layout: https://learn.microsoft.com/en-us/windows/win32/debug/pe-format
 */
import { open } from 'node:fs/promises';

export type PeDebugInfo = 'dwarf' | 'pdb-only' | 'unknown';

export async function inspectPeDebugInfo(filename: string): Promise<PeDebugInfo> {
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(filename, 'r');
    const size = (await file.stat()).size;
    const read = async (offset: number, count: number): Promise<Buffer> => {
      if (offset < 0 || count < 0 || count > 1 << 20 || offset + count > size) throw new Error('PE bounds');
      const buffer = Buffer.alloc(count);
      let used = 0;
      while (used < count) {
        const { bytesRead } = await file!.read(buffer, used, count - used, offset + used);
        if (!bytesRead) throw new Error('PE truncated');
        used += bytesRead;
      }
      return buffer;
    };
    const dos = await read(0, 64);
    if (dos.toString('ascii', 0, 2) !== 'MZ') return 'unknown';
    const peOffset = dos.readUInt32LE(60);
    const coff = await read(peOffset, 24);
    if (coff.readUInt32LE(0) !== 0x4550) return 'unknown';
    const sectionsCount = coff.readUInt16LE(6);
    if (!sectionsCount || sectionsCount > 4096) return 'unknown';
    const optionalSize = coff.readUInt16LE(20);
    const optional = await read(peOffset + 24, optionalSize);
    const magic = optional.readUInt16LE(0);
    const directories = magic === 0x20b ? 112 : magic === 0x10b ? 96 : 0;
    if (!directories || optionalSize < directories) return 'unknown';
    const sectionTable = await read(peOffset + 24 + optionalSize, sectionsCount * 40);
    const stringTable = coff.readUInt32LE(12) + coff.readUInt32LE(16) * 18;
    const sections: Array<{ rva: number; raw: number; size: number }> = [];
    let otherDebug = false;
    for (let i = 0; i < sectionsCount; i++) {
      const row = sectionTable.subarray(i * 40, i * 40 + 40);
      let name = row.toString('ascii', 0, 8).replace(/\0.*$/, '');
      if (/^\/\d+$/.test(name)) {
        if (!coff.readUInt32LE(12)) return 'unknown';
        const length = (await read(stringTable, 4)).readUInt32LE(0);
        const offset = Number(name.slice(1));
        if (offset < 4 || offset >= length || stringTable + length > size) return 'unknown';
        const text = await read(stringTable + offset, Math.min(256, length - offset));
        const end = text.indexOf(0);
        if (end < 0) return 'unknown';
        name = text.toString('ascii', 0, end);
      }
      const section = { rva: row.readUInt32LE(12), raw: row.readUInt32LE(20), size: row.readUInt32LE(16) };
      if (section.size && (!section.raw || section.raw + section.size > size)) return 'unknown';
      sections.push(section);
      if (section.size && (name === '.debug_info' || name === '.zdebug_info')) return 'dwarf';
      // Split/external or incomplete DWARF cannot be positively called PDB-only.
      if (/^\.(?:z?debug_|gnu_debug)/.test(name)) otherDebug = true;
    }
    if (otherDebug || optional.readUInt32LE(directories - 4) <= 6 || optionalSize < directories + 56) return 'unknown';
    const debugRva = optional.readUInt32LE(directories + 48);
    const debugSize = optional.readUInt32LE(directories + 52);
    if (!debugRva || !debugSize || debugSize % 28 !== 0 || debugSize > 64 * 1024) return 'unknown';
    const owner = sections.find(section => debugRva >= section.rva && debugRva - section.rva + debugSize <= section.size);
    if (!owner) return 'unknown';
    const debug = await read(owner.raw + debugRva - owner.rva, debugSize);
    for (let offset = 0; offset < debugSize; offset += 28) {
      if (debug.readUInt32LE(offset + 12) !== 2) continue;
      const length = debug.readUInt32LE(offset + 16);
      const pointer = debug.readUInt32LE(offset + 24);
      if (length < 17 || !pointer || pointer + length > size) continue;
      const cv = await read(pointer, Math.min(length, 4096));
      const signature = cv.toString('ascii', 0, 4);
      const pathOffset = signature === 'RSDS' ? 24 : signature === 'NB10' ? 16 : 0;
      const end = cv.indexOf(0, pathOffset);
      if (pathOffset && end > pathOffset && /\.pdb$/i.test(cv.toString('utf8', pathOffset, end))) return 'pdb-only';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  } finally {
    await file?.close();
  }
}
