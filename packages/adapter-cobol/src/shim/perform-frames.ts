/**
 * libcob's PERFORM stack, read through the engine.
 *
 * cobc compiles an out-of-line PERFORM as a push on a per-program array of
 * frames and a `goto` to the paragraph: `frame_ptr++; frame_ptr->perform_through
 * = <label id of the THRU paragraph>; frame_ptr->return_address_ptr = &&l_N;
 * goto l_P;` and, at the end of the performed range, `goto
 * *frame_ptr->return_address_ptr` back to `l_N:` where `frame_ptr--` runs (both
 * GnuCOBOL 3.1.2 and 3.2, measured). `frame_stack` and `frame_ptr` are locals of
 * the program's body function, so in any frame of that function the depth is
 * `frame_ptr - frame_stack` and each entry's return address is a code address
 * inside the same function — an instruction breakpoint on it stops exactly when
 * the performed range returns. 3.2 also records the performing paragraph and
 * statement on the frame (`paragraph_name`, `module_stmt`); 3.1.2 does not, so
 * nothing here depends on them: a return address is turned into a source line
 * by the engine's own line table.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { EngineRequester } from './engine-client.js';

export const DEPTH_EXPRESSION = '/nat (long)(frame_ptr - frame_stack)';

export interface AddressLocation {
  path: string;
  line: number;
}

function resultOf(response: DebugProtocol.Response): string | undefined {
  const body = response.body as { result?: unknown } | undefined;
  return response.success && typeof body?.result === 'string' ? body.result : undefined;
}

/** `140698323261470`, `0x7ff6e194181e`, `(void *) 0x00007ff6e194181e` → BigInt. */
export function parseAddress(text: string): bigint | undefined {
  const hex = /0x([0-9a-f]+)/i.exec(text);
  if (hex) {
    return BigInt(`0x${hex[1]}`);
  }
  const dec = /(?:^|[^0-9])([0-9]{1,20})(?![0-9])/.exec(text.trim());
  return dec ? BigInt(dec[1]) : undefined;
}

export function hexAddress(address: bigint): string {
  return `0x${address.toString(16)}`;
}

/** PERFORM depth in a body-function frame: 0 outside any PERFORM. Undefined when the frame has no `frame_ptr` (not a cobc frame, no DWARF). */
export async function readPerformDepth(engine: EngineRequester, frameId: number): Promise<number | undefined> {
  const result = resultOf(await engine.request('evaluate', { expression: DEPTH_EXPRESSION, frameId, context: 'variables' }));
  if (result === undefined) {
    return undefined;
  }
  const value = Number.parseInt(result, 10);
  return Number.isFinite(value) && value >= 0 && value < 1024 ? value : undefined;
}

/** The code address the PERFORM at stack entry `depth` returns to. */
export async function readReturnAddress(engine: EngineRequester, frameId: number, depth: number): Promise<bigint | undefined> {
  const expression = `/nat (unsigned long long)frame_stack[${depth}].return_address_ptr`;
  const result = resultOf(await engine.request('evaluate', { expression, frameId, context: 'variables' }));
  const address = result !== undefined ? parseAddress(result) : undefined;
  return address !== undefined && address > 0n ? address : undefined;
}

/** The THRU-end label id recorded on stack entry `depth` (`perform_through`). */
export async function readPerformThrough(engine: EngineRequester, frameId: number, depth: number): Promise<number | undefined> {
  const expression = `/nat (int)frame_stack[${depth}].perform_through`;
  const result = resultOf(await engine.request('evaluate', { expression, frameId, context: 'variables' }));
  const value = result !== undefined ? Number.parseInt(result, 10) : Number.NaN;
  return Number.isFinite(value) ? value : undefined;
}

const LINE_ENTRY_RE = /\('((?:[^'\\]|\\.)*)',\s*(\d+)\)/;

/**
 * The source line the engine's line table attributes a code address to — for a PERFORM
 * return address, the generated-C line after the `goto` (or the COBOL line when cobc
 * attributed it directly). Undefined when the address has no line entry.
 */
export async function resolveAddressLocation(engine: EngineRequester, frameId: number, address: bigint): Promise<AddressLocation | undefined> {
  const expression =
    `/py (lambda le: (le.GetFileSpec().fullpath, le.GetLine()))(lldb.target.ResolveLoadAddress(${address.toString()}).GetLineEntry())`;
  const result = resultOf(await engine.request('evaluate', { expression, frameId, context: 'variables' }));
  const match = result !== undefined ? LINE_ENTRY_RE.exec(result) : null;
  if (!match) {
    return undefined;
  }
  const line = Number.parseInt(match[2], 10);
  const path = match[1].replace(/\\\\/g, '\\');
  return path.length > 0 && line > 0 ? { path, line } : undefined;
}
