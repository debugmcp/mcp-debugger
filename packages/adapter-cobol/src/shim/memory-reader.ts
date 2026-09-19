/**
 * Bytes of a COBOL data item at a stop, fetched through CodeLLDB.
 *
 * The manifest addresses every item as `<symbol> + <offset>` in the C the
 * compiler generated (`b_24 + 24`, `cob_local_ptr + 16`, the `b_19` pointer
 * parameter of a LINKAGE item). One `evaluate` of that expression in the
 * program's own frame gives the address — it must be that frame, because file
 * statics resolve per compilation unit and `cob_local_ptr`/`b_19` are locals
 * of the body function — and one `readMemory` of the whole 01-level record
 * gives every subordinate at once. Both are memoised per generation; a record
 * over 1 MiB is read per item instead of as a whole.
 *
 * libcob helpers (`cob_get_numdisp`) are not callable from expressions, so
 * OCCURS DEPENDING ON counts are computed by the caller from decoded bytes.
 */
import type { CobolDataItem } from '../manifest/schema.js';
import { EngineTimeoutError, type EngineRequester } from './engine-client.js';
import type { ShimLogger } from './logger.js';
import type { ProgramEntry } from './manifest-registry.js';
import type { SessionState } from './session-state.js';

export const MAX_RECORD_READ_BYTES = 1 << 20;

export type AddressResult = { ok: true; address: bigint } | { ok: false; error: string };
export type ReadResult = { ok: true; bytes: Uint8Array; address: bigint } | { ok: false; error: string };

interface ReadMemoryBody {
  address?: string;
  data?: string;
  unreadableBytes?: number;
}

/** The C expression whose value is the record's address; `&b_N` for special registers (a scalar, not an array). */
export function addressExpression(root: CobolDataItem): string {
  const { symbol, kind } = root.storage;
  const offset = root.offset > 0 ? ` + ${root.offset}` : '';
  if (kind === 'register') {
    // `&b_N + 24` would scale by sizeof(b_N); add after the integer cast instead.
    return `/nat (unsigned long long)(&${symbol})${offset}`;
  }
  return `/nat (unsigned long long)(${symbol}${offset})`;
}

/** CodeLLDB answers `(unsigned long long)` with a decimal string; a hex form is tolerated. */
export function parseAddress(result: string | undefined): bigint | undefined {
  const text = (result ?? '').trim();
  if (/^\d+$/.test(text)) {
    return BigInt(text);
  }
  const hex = /^0x([0-9a-f]+)$/i.exec(text);
  return hex ? BigInt(`0x${hex[1]}`) : undefined;
}

export function hexAddress(address: bigint): string {
  return `0x${address.toString(16)}`;
}

function requestFailure(error: unknown): string {
  if (error instanceof EngineTimeoutError) {
    return 'timeout';
  }
  return error instanceof Error ? error.message : String(error);
}

export class MemoryReader {
  constructor(
    private readonly engine: EngineRequester,
    private readonly state: SessionState,
    private readonly logger: ShimLogger
  ) {}

  /** The 01/77-level record an item lives in (an item with no parent is its own root). */
  rootOf(entry: ProgramEntry, item: CobolDataItem): CobolDataItem {
    let current = item;
    const seen = new Set<number>();
    while (current.parentId !== undefined && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = this.state.registry.item(entry, current.parentId);
      if (!parent) {
        break;
      }
      current = parent;
    }
    return current;
  }

  /** Byte offset of the element selected by `indices` (outermost dimension first) from element 0. */
  elementOffset(item: CobolDataItem, indices: readonly number[]): number {
    let offset = 0;
    item.occursDims.forEach((dim, k) => {
      if (k < indices.length) {
        offset += indices[k] * dim.elemSize;
      }
    });
    return offset;
  }

  /**
   * Bytes to read for a whole record. A record with an OCCURS DEPENDING ON table has a
   * `sizeExpr` instead of a fixed size in the generated C; its extent is bounded by the
   * table's maximum, which is what we read (the live count only trims what is shown).
   */
  recordExtent(entry: ProgramEntry, root: CobolDataItem): number {
    let extent = root.size;
    const visit = (item: CobolDataItem): void => {
      const own = item.offset - root.offset + (item.occurs ? item.occurs.max * item.occurs.elemSize : item.size);
      extent = Math.max(extent, own);
      for (const childId of item.children) {
        const child = this.state.registry.item(entry, childId);
        if (child && child.level !== 88) {
          visit(child);
        }
      }
    };
    if (root.sizeExpr !== undefined || root.occurs) {
      visit(root);
    }
    return extent;
  }

  rootAddress(frameId: number, entry: ProgramEntry, root: CobolDataItem): Promise<AddressResult> {
    const key = `addr:${frameId}:${entry.program.programId}:${root.storage.symbol}:${root.offset}`;
    return this.state.memoise(key, () => this.evaluateAddress(frameId, root));
  }

  async addressOf(frameId: number, entry: ProgramEntry, item: CobolDataItem, indices: readonly number[]): Promise<AddressResult> {
    const root = this.rootOf(entry, item);
    const base = await this.rootAddress(frameId, entry, root);
    if (!base.ok) {
      return base;
    }
    return { ok: true, address: base.address + BigInt(item.offset - root.offset + this.elementOffset(item, indices)) };
  }

  /** The item's bytes at `indices`; `length` overrides `item.size` (a table view reads count × elemSize). */
  async readItemBytes(
    frameId: number,
    entry: ProgramEntry,
    item: CobolDataItem,
    indices: readonly number[],
    length = item.size
  ): Promise<ReadResult> {
    if (item.level === 88) {
      return { ok: false, error: 'a level-88 condition has no storage' };
    }
    if (length <= 0) {
      return { ok: false, error: 'size unknown' };
    }
    const root = this.rootOf(entry, item);
    const relative = item.offset - root.offset + this.elementOffset(item, indices);
    const extent = this.recordExtent(entry, root);
    if (extent <= MAX_RECORD_READ_BYTES && relative + length <= extent) {
      const record = await this.readRecord(frameId, entry, root, extent);
      if (!record.ok) {
        return record;
      }
      return { ok: true, bytes: record.bytes.subarray(relative, relative + length), address: record.address + BigInt(relative) };
    }
    const base = await this.rootAddress(frameId, entry, root);
    if (!base.ok) {
      return base;
    }
    return this.readMemory(base.address + BigInt(relative), length);
  }

  private readRecord(frameId: number, entry: ProgramEntry, root: CobolDataItem, extent: number): Promise<ReadResult> {
    const key = `rec:${frameId}:${entry.program.programId}:${root.storage.symbol}:${root.offset}:${extent}`;
    return this.state.memoise(key, async () => {
      const base = await this.rootAddress(frameId, entry, root);
      if (!base.ok) {
        return base;
      }
      return this.readMemory(base.address, extent);
    });
  }

  private async evaluateAddress(frameId: number, root: CobolDataItem): Promise<AddressResult> {
    const expression = addressExpression(root);
    let response;
    try {
      response = await this.engine.request('evaluate', { expression, frameId, context: 'variables' });
    } catch (error) {
      return { ok: false, error: requestFailure(error) };
    }
    if (!response.success) {
      return { ok: false, error: `address of ${root.storage.symbol} not evaluable: ${response.message ?? 'engine error'}` };
    }
    const body = response.body as { result?: string } | undefined;
    const address = parseAddress(body?.result);
    if (address === undefined) {
      return { ok: false, error: `unparseable address '${body?.result ?? ''}' for ${root.storage.symbol}` };
    }
    if (address === 0n) {
      return { ok: false, error: root.storage.kind === 'linkage' ? 'not passed (NULL)' : 'address is NULL' };
    }
    return { ok: true, address };
  }

  private async readMemory(address: bigint, count: number): Promise<ReadResult> {
    let response;
    try {
      response = await this.engine.request('readMemory', { memoryReference: hexAddress(address), count });
    } catch (error) {
      return { ok: false, error: requestFailure(error) };
    }
    if (!response.success) {
      return { ok: false, error: `readMemory failed: ${response.message ?? 'engine error'}` };
    }
    const body = response.body as ReadMemoryBody | undefined;
    if (!body?.data) {
      return { ok: false, error: `memory at ${hexAddress(address)} unreadable` };
    }
    const bytes = new Uint8Array(Buffer.from(body.data, 'base64'));
    if (bytes.length < count) {
      this.logger.debug(`short read at ${hexAddress(address)}: ${bytes.length} of ${count} bytes`);
    }
    return { ok: true, bytes, address };
  }
}
