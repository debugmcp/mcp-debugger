import path from 'node:path';
import type { CobolControlFlow } from '../manifest/schema.js';
import type { EngineRequester } from './engine-client.js';
import type { ProgramEntry } from './manifest-registry.js';
import { readPerformThrough, readReturnAddress } from './perform-frames.js';

type Perform = CobolControlFlow['performs'][number];
interface ActiveRange { address: bigint; calls: Perform[]; start: number; end: number; entered: boolean }

/**
 * Find the generated-C row beside this exact PC's COBOL line-table row. An exact
 * address lookup distinguishes repeated COPY lines. LLDB's FindLineEntryIndex
 * matches the first file/line even with exact=True, so match the line entry's
 * address instead (at most 200,000 rows, then 16 neighboring rows). The generated-C reset follows cobc's source-attribution code.
 * https://lldb.llvm.org/python_api/lldb.SBCompileUnit.html
 */
export async function generatedLineAt(engine: EngineRequester, entry: ProgramEntry, frameId: number, address?: bigint): Promise<number | undefined> {
  const addr = address === undefined ? 'lldb.frame.GetPCAddress()' : `lldb.target.ResolveLoadAddress(${address})`;
  const name = JSON.stringify(path.basename(entry.program.generated.c).toLowerCase());
  const expression = `/py (lambda a: (lambda cu, pc: (lambda ix: next((le.GetLine() for le in (cu.GetLineEntryAtIndex(i) for i in range(ix, min(ix + 16, cu.GetNumLineEntries()))) if le.GetFileSpec().GetFilename().lower() == ${name}), 0))(next((i for i in range(min(cu.GetNumLineEntries(), 200000)) if cu.GetLineEntryAtIndex(i).GetStartAddress().GetLoadAddress(lldb.target) == pc), cu.GetNumLineEntries())))(a.GetCompileUnit(), a.GetLineEntry().GetStartAddress().GetLoadAddress(lldb.target)))(${addr})`;

  try {
    const response = await engine.request('evaluate', { expression, frameId, context: 'variables' });
    const value = Number((response.body as { result?: string } | undefined)?.result);
    return response.success && Number.isInteger(value) && value > 0 ? value : undefined;
  } catch { return undefined; }
}

/** A statement walk in a program containing GO TO, tracking the innermost active PERFORM. */
export class PerformEscapeWatch {
  private readonly active = new Map<number, ActiveRange>();
  constructor(private readonly engine: EngineRequester, private readonly entry: ProgramEntry) {}

  observeDepth(depth: number): void {
    for (const key of this.active.keys()) if (key > depth) this.active.delete(key);
  }

  /** The unique caller's generated-C line, even when GCC shares its return block. */
  async callLine(frameId: number, depth: number): Promise<number | undefined> {
    try {
      const current = await this.activeRange(frameId, depth);
      if (current?.calls.length !== 1) return undefined;
      const call = current.calls[0];
      // callCLine is the compiler's statement comment; its #line directive follows it.
      return this.entry.program.lineMap.find(row => row.cLine >= call.callCLine && row.cLine < call.returnCLine)?.cLine;
    } catch { return undefined; }
  }

  async inspect(frameId: number, depth: number, generatedLine?: number): Promise<'inside' | 'escaped' | 'unavailable'> {
    try { return await this.inspectRange(frameId, depth, generatedLine); }
    catch { return 'unavailable'; }
  }

  private async activeRange(frameId: number, depth: number): Promise<ActiveRange | undefined> {
    const flow = this.entry.program.controlFlow;
    if (!flow) return undefined;
    const [address, through] = await Promise.all([readReturnAddress(this.engine, frameId, depth), readPerformThrough(this.engine, frameId, depth)]);
    if (address === undefined || through === undefined) return undefined;
    let current = this.active.get(depth);
    if (current?.address !== address || current.calls[0].endLabel !== through) {
      const returning = await generatedLineAt(this.engine, this.entry, frameId, address);
      // GCC may share/reorder identical return blocks. Cross-check the live THRU
      // label, and use its unique bounds when the DWARF row names another block.
      const candidates = flow.performs.filter(candidate => candidate.endLabel === through);
      const exact = returning === undefined ? [] : candidates.filter(candidate => returning >= candidate.callCLine && returning <= candidate.endCLine);
      const calls = exact.length === 1 ? exact : candidates;
      const call = calls[0];
      if (!call || calls.some(candidate => candidate.startLabel !== call.startLabel)) return undefined;
      const start = call && flow.ranges.find(range => range.labelId === call.startLabel);
      const end = call && flow.ranges.find(range => range.labelId === call.endLabel);
      if (!call || !start || !end || end.endCLine < start.startCLine) return undefined;
      current = { address, calls, start: start.startCLine, end: end.endCLine, entered: false };
      this.active.set(depth, current);
    }
    this.observeDepth(depth);
    return current;
  }

  private async inspectRange(frameId: number, depth: number, generatedLine?: number): Promise<'inside' | 'escaped' | 'unavailable'> {
    const current = await this.activeRange(frameId, depth);
    if (!current) return 'unavailable';
    const line = generatedLine ?? await generatedLineAt(this.engine, this.entry, frameId);
    if (line === undefined) return 'unavailable';
    // The goto to the normal return precedes frame_ptr--: its old depth is still visible.
    if (current.calls.some(call => line >= call.returnCLine && line <= call.endCLine)) {
      current.entered = false;
      return 'inside';
    }
    if (line >= current.start && line <= current.end) {
      current.entered = true;
      return 'inside';
    }
    // A newly pushed frame can still be stopped on its PERFORM before the goto executes.
    if (!current.entered && current.calls.some(call => line >= call.callCLine && line < call.returnCLine)) return 'inside';
    return 'escaped';
  }
}
