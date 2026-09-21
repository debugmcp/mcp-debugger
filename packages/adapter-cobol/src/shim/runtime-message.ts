/** Read-only libcob printf messages: integer/pointer ABIs, bounded strings and formatting. */
import type { EngineRequester } from './engine-client.js';
import { parseAddress } from './memory-reader.js';

export const TARGET_ABI_EXPRESSION = '/py "%s|%d|%d" % (lldb.target.GetTriple(), lldb.target.GetAddressByteSize(), int(lldb.target.GetByteOrder() == lldb.eByteOrderLittle))';
export const MAX_RUNTIME_TEXT = 4096;
const MAX_STRING = 1024;
const MAX_ARGUMENTS = 32;

export interface PrintfReader {
  word(index: number): Promise<bigint>;
  string(address: bigint, precision?: number): Promise<string>;
  longBits: number;
}

/** Integer/string subset used by libcob checks; unsupported conversions fail explicitly. */
export async function formatRuntimeMessage(format: string, reader: PrintfReader): Promise<string> {
  if (format.length > MAX_STRING) throw new Error('format exceeds limit');
  let index = 1; // argument zero is the format pointer
  const word = () => {
    if (index > MAX_ARGUMENTS) throw new Error('argument limit');
    return reader.word(index++);
  };
  let output = '';
  for (let at = 0; at < format.length;) {
    if (format[at] !== '%') { output += format[at++]; continue; }
    if (format[at + 1] === '%') { output += '%'; at += 2; continue; }
    const spec = /^%([-+ #0]*)(\*|\d+)?(?:\.(\*|\d*))?(hh|ll|h|l|j|z|t)?([sdiuxXopc])/.exec(format.slice(at));
    if (!spec) throw new Error('unsupported printf conversion');
    at += spec[0].length;
    let flags = spec[1];
    let width = spec[2] === '*' ? Number(BigInt.asIntN(32, await word())) : Number(spec[2] ?? 0);
    if (width < 0) { flags += '-'; width = -width; }
    let precision = spec[3] === '*' ? Number(BigInt.asIntN(32, await word())) : spec[3] !== undefined ? Number(spec[3]) : undefined;
    if (precision !== undefined && precision < 0) precision = undefined;
    if (width > MAX_STRING || (precision ?? 0) > MAX_STRING) throw new Error('field width/precision exceeds limit');
    const length = spec[4];
    const conversion = spec[5];
    if ((conversion === 's' || conversion === 'c') && length) throw new Error('wide characters unsupported');
    const value = await word();
    let text: string;
    let prefix = '';
    if (conversion === 's') text = await reader.string(value, precision);
    else if (conversion === 'c') text = String.fromCharCode(Number(value & 255n));
    else {
      const bits = length === 'hh' ? 8 : length === 'h' ? 16 : length === 'l' ? reader.longBits : length || conversion === 'p' ? 64 : 32;
      const signed = conversion === 'd' || conversion === 'i';
      const number = signed ? BigInt.asIntN(bits, value) : BigInt.asUintN(bits, value);
      const magnitude = number < 0n ? -number : number;
      const radix = conversion === 'o' ? 8 : /[xXp]/.test(conversion) ? 16 : 10;
      text = magnitude.toString(radix);
      if (precision === 0 && magnitude === 0n) text = '';
      if (precision !== undefined) text = text.padStart(precision, '0');
      if (signed) prefix = number < 0n ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '';
      if (conversion === 'p' || (flags.includes('#') && magnitude !== 0n && /[xX]/.test(conversion))) prefix += '0x';
      if (flags.includes('#') && conversion === 'o' && !text.startsWith('0')) prefix += '0';
      if (conversion === 'X') { prefix = prefix.toUpperCase(); text = text.toUpperCase(); }
    }
    const pad = Math.max(0, width - prefix.length - text.length);
    const zero = !flags.includes('-') && flags.includes('0') && precision === undefined && !/[sc]/.test(conversion);
    output += flags.includes('-') ? prefix + text + ' '.repeat(pad)
      : zero ? prefix + '0'.repeat(pad) + text : ' '.repeat(pad) + prefix + text;
    if (output.length > MAX_RUNTIME_TEXT) throw new Error('message exceeds limit');
  }
  if (output.length > MAX_RUNTIME_TEXT) throw new Error('message exceeds limit');
  return output;
}

function unquote(value: string): string {
  return /^(['"]).*\1$/s.test(value) ? value.slice(1, -1) : value;
}

/**
 * The target triple selects the ABI, including Darwin arm64's stack-only varargs.
 * CFA is the caller's stack pointer, so prologue stack adjustments do not change offsets.
 * No expression invokes a function in the debuggee.
 */
export async function readRuntimeMessage(engine: EngineRequester, frameId: number): Promise<{ message?: string; format?: string; unavailable?: string }> {
  let format: string | undefined;
  const deadline = Date.now() + 2000;
  try {
    const request = async (command: string, args: unknown) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('message read timed out');
      const response = await engine.request(command, args, remaining);
      if (!response.success) throw new Error(`${command} unavailable`);
      return response.body as { result?: string; data?: string } | undefined;
    };
    const evaluate = async (expression: string) => {
      const result = (await request('evaluate', { expression, frameId, context: 'variables' }))?.result;
      if (result === undefined) throw new Error('expression unavailable');
      return unquote(result.trim());
    };
    const [triple, pointerSize, littleEndian] = (await evaluate(TARGET_ABI_EXPRESSION)).split('|');
    if (pointerSize !== '8' || littleEndian !== '1') throw new Error('unsupported target ABI');
    const windows = /windows|mingw|msvc/i.test(triple);
    const darwin = /darwin|apple/i.test(triple);
    const x64 = /^x86_64|^amd64/i.test(triple);
    const arm64 = /^aarch64|^arm64/i.test(triple);
    if ((!x64 && !arm64) || (arm64 && windows)) throw new Error('unsupported target ABI');
    const registers = x64 ? (windows ? ['rcx', 'rdx', 'r8', 'r9'] : ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'])
      : Array.from({ length: darwin ? 1 : 8 }, (_, i) => `x${i}`);
    let cfa: bigint | undefined;
    const memory = async (address: bigint, count: number) => {
      const body = await request('readMemory', { memoryReference: `0x${address.toString(16)}`, count });
      if (!body?.data) throw new Error('memory unavailable');
      return Buffer.from(body.data, 'base64').subarray(0, count);
    };
    const word = async (index: number): Promise<bigint> => {
      if (index < registers.length) {
        const address = parseAddress(await evaluate(`/nat (unsigned long long)$${registers[index]}`));
        if (address === undefined) throw new Error('register unavailable');
        return address;
      }
      cfa ??= parseAddress(await evaluate('/py lldb.frame.GetCFA()'));
      if (!cfa) throw new Error('caller stack unavailable');
      const slot = windows ? index : index - registers.length;
      const bytes = await memory(cfa + BigInt(slot * 8), 8);
      if (bytes.length !== 8) throw new Error('argument stack unreadable');
      return bytes.readBigUInt64LE();
    };
    const string = async (address: bigint, precision?: number): Promise<string> => {
      if (address === 0n) return '(null)'.slice(0, precision);
      const limit = precision ?? MAX_STRING;
      const chunks: Buffer[] = [];
      for (let used = 0; used < limit;) {
        const count = Math.min(128, limit - used);
        const bytes = await memory(address + BigInt(used), count);
        const end = bytes.indexOf(0);
        chunks.push(end < 0 ? bytes : bytes.subarray(0, end));
        if (end >= 0) return Buffer.concat(chunks).toString('utf8');
        if (bytes.length !== count) throw new Error('string unreadable');
        used += count;
      }
      if (precision !== undefined) return Buffer.concat(chunks).toString('utf8');
      throw new Error('unterminated string or string exceeds limit');
    };
    format = await string(await word(0));
    const message = await formatRuntimeMessage(format, { word, string, longBits: windows ? 32 : 64 });
    return { message, format };
  } catch (error) {
    return { format, unavailable: error instanceof Error ? error.message : String(error) };
  }
}
