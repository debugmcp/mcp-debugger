/** Minimal structural PE fixtures; data bytes are deliberately not executable. */
export function peFixture(options: { dwarf?: boolean; pdb?: boolean; pe32?: boolean; nb10?: boolean; stringOffset?: number; debugName?: string } = {}): Buffer {
  const stringOffset = options.stringOffset ?? 0x800;
  const buffer = Buffer.alloc(stringOffset + 256);
  buffer.write('MZ');
  buffer.writeUInt32LE(0x80, 60);
  buffer.writeUInt32LE(0x4550, 0x80);
  const coff = 0x84;
  const hasExtra = options.dwarf || options.debugName;
  buffer.writeUInt16LE(hasExtra ? 2 : 1, coff + 2);
  buffer.writeUInt32LE(stringOffset - 18, coff + 8);
  buffer.writeUInt32LE(1, coff + 12);
  const optionalSize = options.pe32 ? 224 : 240;
  buffer.writeUInt16LE(optionalSize, coff + 16);
  const optional = coff + 20;
  buffer.writeUInt16LE(options.pe32 ? 0x10b : 0x20b, optional);
  const directories = optional + (options.pe32 ? 96 : 112);
  buffer.writeUInt32LE(16, directories - 4);
  const section = optional + optionalSize;
  buffer.write('.rdata', section);
  buffer.writeUInt32LE(0x1000, section + 12);
  buffer.writeUInt32LE(0x100, section + 16);
  buffer.writeUInt32LE(0x400, section + 20);
  if (options.pdb) {
    buffer.writeUInt32LE(0x1010, directories + 48);
    buffer.writeUInt32LE(28, directories + 52);
    buffer.writeUInt32LE(2, 0x410 + 12);
    buffer.writeUInt32LE(64, 0x410 + 16);
    buffer.writeUInt32LE(0x600, 0x410 + 24);
    buffer.write(options.nb10 ? 'NB10' : 'RSDS', 0x600);
    buffer.write('app.pdb\0', 0x600 + (options.nb10 ? 16 : 24));
  }
  if (hasExtra) {
    buffer.write('/4', section + 40);
    buffer.writeUInt32LE(0x2000, section + 52);
    buffer.writeUInt32LE(0x40, section + 56);
    buffer.writeUInt32LE(0x700, section + 60);
    const name = options.debugName ?? '.debug_info';
    buffer.writeUInt32LE(name.length + 5, stringOffset);
    buffer.write(`${name}\0`, stringOffset + 4);
  }
  return buffer;
}
