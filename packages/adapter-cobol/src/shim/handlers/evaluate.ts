/**
 * `evaluate` in COBOL terms: a data reference (qualified, subscripted,
 * reference-modified), `LENGTH OF` / `ADDRESS OF`, and the shim's own
 * `/hex` `/raw` `/addr` `/len` views of the bytes.
 *
 * The handler answers only what it can decide from the manifest: a name that
 * resolves to exactly one item is served, an ambiguous one is an error that
 * lists the candidates, and a name that resolves to nothing is handed back as
 * `forward` so the engine gets its turn (it may be a C symbol after all).
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import { decodeItem, evaluateCondition } from '../../decoder/index.js';
import { isNumericType } from '../../manifest/attr-constants.js';
import type { CobolDataItem } from '../../manifest/schema.js';
import { parseCobolExpression, type RefmodOperand, type SubscriptOperand } from '../cobol-expression.js';
import type { ShimLogger } from '../logger.js';
import type { ProgramEntry } from '../manifest-registry.js';
import { hexAddress, type MemoryReader } from '../memory-reader.js';
import { resolveDataName } from '../name-resolver.js';
import { engineFrameId, type CachedFrame, type SessionState } from '../session-state.js';
import type { VariablesHandler } from './variables.js';

export const HEX_VIEW_CAP_BYTES = 256;

export type EvaluateOutcome =
  | { kind: 'response'; body: DebugProtocol.EvaluateResponse['body'] }
  | { kind: 'error'; message: string }
  /** Not ours: `reason` is what the combined error says if the engine fails too. */
  | { kind: 'forward'; reason: string };

function hexOf(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += String.fromCharCode(b);
  }
  return out;
}

function quotedLatin1(bytes: Uint8Array): string {
  return JSON.stringify(latin1(bytes));
}

export class EvaluateHandler {
  constructor(
    private readonly state: SessionState,
    private readonly memory: MemoryReader,
    private readonly variables: VariablesHandler,
    private readonly logger: ShimLogger
  ) {}

  /** `anchor` is a COBOL frame (`isCobol`, `program` set); the caller chose it, possibly by walking up the stack. */
  async evaluate(expression: string, anchor: CachedFrame): Promise<EvaluateOutcome> {
    const entry = anchor.program;
    const parsed = parseCobolExpression(expression);
    if (!parsed || !entry) {
      return { kind: 'forward', reason: `'${expression}' is not a COBOL data reference` };
    }
    const written = parsed.ref.names.join(' OF ');
    const programId = entry.program.programId;
    const resolution = resolveDataName(this.state.registry, entry, parsed.ref.names);
    if (resolution.kind === 'none') {
      return { kind: 'forward', reason: `'${written}' is not a data item of program ${programId}` };
    }
    if (resolution.kind === 'ambiguous') {
      return {
        kind: 'error',
        message: `'${written}' is ambiguous in program ${programId}: ${resolution.candidates.join(', ')}. Qualify it (NAME OF GROUP).`
      };
    }
    const item = resolution.item;
    if (item.level === 88) {
      return this.evaluateCondition(anchor, entry, item);
    }

    const indices = await this.resolveSubscripts(anchor, entry, item, parsed.ref.subscripts);
    if ('error' in indices) {
      return { kind: 'error', message: indices.error };
    }
    const isTable = indices.value.length < item.occursDims.length;

    if (parsed.fn === 'LENGTH') {
      return { kind: 'response', body: { result: String(item.size), type: 'LENGTH OF', variablesReference: 0 } };
    }
    if (parsed.fn === 'ADDRESS' || parsed.prefix === '/addr') {
      const address = await this.memory.addressOf(engineFrameId(anchor), entry, item, indices.value);
      if (!address.ok) {
        return { kind: 'error', message: `address of ${item.qualifiedName} unavailable: ${address.error}` };
      }
      const rendered = parsed.fn === 'ADDRESS' ? hexAddress(address.address) : `${hexAddress(address.address)} (${item.size} bytes)`;
      return { kind: 'response', body: { result: rendered, type: 'POINTER', variablesReference: 0, memoryReference: hexAddress(address.address) } };
    }
    if (parsed.prefix === '/len') {
      return { kind: 'response', body: { result: String(item.size), type: 'LENGTH OF', variablesReference: 0 } };
    }

    if (parsed.ref.refmod) {
      if (isTable) {
        return { kind: 'error', message: `${item.qualifiedName} needs ${item.occursDims.length} subscript(s) before a reference modification` };
      }
      return this.evaluateRefmod(anchor, entry, item, indices.value, parsed.ref.refmod);
    }

    if (parsed.prefix === '/hex' || parsed.prefix === '/raw') {
      const length = isTable ? await this.tableByteLength(anchor, entry, item, indices.value) : item.size;
      const read = await this.memory.readItemBytes(engineFrameId(anchor), entry, item, indices.value, length);
      if (!read.ok) {
        return { kind: 'error', message: `${item.qualifiedName} unavailable: ${read.error}` };
      }
      const capped = read.bytes.length > HEX_VIEW_CAP_BYTES ? read.bytes.subarray(0, HEX_VIEW_CAP_BYTES) : read.bytes;
      const result =
        parsed.prefix === '/hex'
          ? `0x${hexOf(capped)}${capped.length < read.bytes.length ? '…' : ''}`
          : `${quotedLatin1(capped)}${capped.length < read.bytes.length ? ' …' : ''}`;
      return {
        kind: 'response',
        body: { result, type: `${read.bytes.length} bytes`, variablesReference: 0, memoryReference: hexAddress(read.address) }
      };
    }

    const rendered = await this.variables.render(engineFrameId(anchor), entry, item, indices.value);
    const v = rendered.variable;
    return {
      kind: 'response',
      body: {
        result: v.value,
        type: v.type,
        variablesReference: v.variablesReference,
        indexedVariables: v.indexedVariables,
        namedVariables: v.namedVariables,
        memoryReference: v.memoryReference
      }
    };
  }

  private async evaluateCondition(anchor: CachedFrame, entry: ProgramEntry, condition: CobolDataItem): Promise<EvaluateOutcome> {
    const parent = condition.parentId !== undefined ? this.state.registry.item(entry, condition.parentId) : undefined;
    if (!parent) {
      return { kind: 'error', message: `${condition.name} has no parent item to evaluate against` };
    }
    if (parent.occursDims.length > 0) {
      return { kind: 'error', message: `${condition.name} conditions a table element; expand ${parent.qualifiedName} to see it per element` };
    }
    if (!condition.condition) {
      return { kind: 'error', message: `${condition.name}: condition values unknown` };
    }
    const rendered = await this.variables.render(engineFrameId(anchor), entry, parent, []);
    const value = rendered.decoded
      ? evaluateCondition(condition.condition, rendered.decoded, parent)
      : `<unavailable: ${rendered.error ?? 'parent unavailable'}>`;
    return { kind: 'response', body: { result: value, type: `88-level of ${parent.name}`, variablesReference: 0 } };
  }

  private async evaluateRefmod(
    anchor: CachedFrame,
    entry: ProgramEntry,
    item: CobolDataItem,
    indices: number[],
    refmod: { start: RefmodOperand; length?: RefmodOperand }
  ): Promise<EvaluateOutcome> {
    const start = await this.resolveOperand(anchor, entry, refmod.start);
    if ('error' in start) {
      return { kind: 'error', message: start.error };
    }
    const length = refmod.length ? await this.resolveOperand(anchor, entry, refmod.length) : { value: item.size - start.value + 1 };
    if ('error' in length) {
      return { kind: 'error', message: length.error };
    }
    if (start.value < 1 || start.value > item.size) {
      return { kind: 'error', message: `reference modification start ${start.value} is outside ${item.qualifiedName} (1..${item.size})` };
    }
    if (length.value < 1 || start.value - 1 + length.value > item.size) {
      return { kind: 'error', message: `reference modification length ${length.value} exceeds ${item.qualifiedName} from position ${start.value}` };
    }
    const read = await this.memory.readItemBytes(engineFrameId(anchor), entry, item, indices);
    if (!read.ok) {
      return { kind: 'error', message: `${item.qualifiedName} unavailable: ${read.error}` };
    }
    const slice = read.bytes.subarray(start.value - 1, start.value - 1 + length.value);
    const decoded = decodeItem(slice, { size: slice.length, usage: 'DISPLAY', level: item.level, flags: {}, attr: { type: 0x21, digits: 0, scale: 0, flags: 0 } });
    return {
      kind: 'response',
      body: {
        result: decoded.value,
        type: `PIC X(${length.value}) (${item.qualifiedName}(${start.value}:${length.value}))`,
        variablesReference: 0,
        memoryReference: hexAddress(read.address + BigInt(start.value - 1))
      }
    };
  }

  private async tableByteLength(anchor: CachedFrame, entry: ProgramEntry, item: CobolDataItem, indices: number[]): Promise<number> {
    const dim = item.occursDims[indices.length];
    const count = await this.variables.effectiveCount(engineFrameId(anchor), entry, item, indices.length);
    return count * dim.elemSize;
  }

  private async resolveSubscripts(
    anchor: CachedFrame,
    entry: ProgramEntry,
    item: CobolDataItem,
    subscripts: SubscriptOperand[]
  ): Promise<{ value: number[] } | { error: string }> {
    const dims = item.occursDims;
    if (subscripts.length > dims.length) {
      return {
        error: dims.length === 0
          ? `${item.qualifiedName} is not a table; it takes no subscripts`
          : `${item.qualifiedName} has ${dims.length} dimension(s); ${subscripts.length} subscripts given`
      };
    }
    const indices: number[] = [];
    for (let k = 0; k < subscripts.length; k++) {
      const operand = subscripts[k];
      const resolved = await this.resolveOperand(anchor, entry, operand);
      if ('error' in resolved) {
        return resolved;
      }
      const value = resolved.value + (operand.kind === 'ident' ? operand.delta : 0);
      if (value < 1 || value > dims[k].max) {
        return { error: `subscript ${k + 1} of ${item.qualifiedName} is out of range 1..${dims[k].max}: ${value}` };
      }
      indices.push(value - 1);
    }
    return { value: indices };
  }

  /** An integer literal, or a numeric data item of the same program decoded live (unsubscripted). */
  private async resolveOperand(
    anchor: CachedFrame,
    entry: ProgramEntry,
    operand: { kind: 'int'; value: number } | { kind: 'ident'; name: string }
  ): Promise<{ value: number } | { error: string }> {
    if (operand.kind === 'int') {
      return { value: operand.value };
    }
    const resolution = resolveDataName(this.state.registry, entry, [operand.name]);
    if (resolution.kind === 'none') {
      return { error: `'${operand.name}' is not a data item of program ${entry.program.programId}` };
    }
    if (resolution.kind === 'ambiguous') {
      return { error: `'${operand.name}' is ambiguous in program ${entry.program.programId}: ${resolution.candidates.join(', ')}` };
    }
    const item = resolution.item;
    if (!item.attr || !isNumericType(item.attr.type)) {
      return { error: `'${operand.name}' is not numeric and cannot be a subscript` };
    }
    if (item.occursDims.length > 0) {
      return { error: `'${operand.name}' is a table element and needs its own subscripts; use a literal` };
    }
    const read = await this.memory.readItemBytes(engineFrameId(anchor), entry, item, []);
    if (!read.ok) {
      return { error: `'${operand.name}' unavailable: ${read.error}` };
    }
    const decoded = decodeItem(read.bytes, item);
    if (!decoded.numeric) {
      this.logger.debug(`subscript ${operand.name} did not decode as numeric: ${decoded.value}`);
      return { error: `'${operand.name}' holds ${decoded.value}, not a usable subscript` };
    }
    const { mantissa, scale } = decoded.numeric;
    const whole = scale > 0 ? mantissa / 10n ** BigInt(scale) : mantissa * 10n ** BigInt(-scale);
    return { value: Number(whole) };
  }
}
