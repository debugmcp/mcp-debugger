/**
 * `variables` for the shim's own references: a data-division section, a group,
 * a table, or one table element — rendered from the manifest and the bytes
 * the memory reader fetched.
 *
 * Conventions the client can rely on:
 *   - a level-88 condition is listed as a sibling right after its parent, its
 *     value `'true'`/`'false'`, its type `88-level of <PARENT>`;
 *   - a REDEFINES item is a sibling at the same offset, its type suffixed
 *     ` REDEFINES <X>`;
 *   - a table (OCCURS, or any item with an unsubscripted ancestor dimension)
 *     reports `indexedVariables` = the live count (OCCURS DEPENDING ON decoded
 *     and clamped to `[min, max]`) and pages its `NAME(i)` elements by
 *     `start`/`count`, 200 per page by default;
 *   - one item's failure is that item's `<unavailable: reason>`, never the list's.
 */
import type { DebugProtocol } from '@vscode/debugprotocol';
import { decodeItem, describeType, evaluateCondition, type DecodedValue } from '../../decoder/index.js';
import { COB_TYPE } from '../../manifest/attr-constants.js';
import type { CobolDataItem } from '../../manifest/schema.js';
import type { ShimLogger } from '../logger.js';
import type { ProgramEntry } from '../manifest-registry.js';
import { hexAddress, type MemoryReader } from '../memory-reader.js';
import type { SessionState, ShimRef } from '../session-state.js';

export const DEFAULT_ELEMENT_PAGE = 200;

/** A rendered item plus what the evaluate handler needs beyond the DAP shape. */
export interface RenderedItem {
  variable: DebugProtocol.Variable;
  decoded?: DecodedValue;
  bytes?: Uint8Array;
  address?: bigint;
  error?: string;
  /** True when the item was rendered as a table (one or more dimensions left unsubscripted). */
  isTable: boolean;
  count?: number;
}

export function isGroupItem(item: CobolDataItem): boolean {
  return item.attr === undefined || item.attr.type === COB_TYPE.GROUP || item.usage === 'GROUP';
}

export function unavailable(reason: string): string {
  return `<unavailable: ${reason}>`;
}

function subscriptSuffix(indices: readonly number[]): string {
  return indices.length > 0 ? `(${indices.map((i) => i + 1).join(', ')})` : '';
}

export class VariablesHandler {
  constructor(
    private readonly state: SessionState,
    private readonly memory: MemoryReader,
    private readonly logger: ShimLogger
  ) {}

  async listRef(ref: ShimRef, args: DebugProtocol.VariablesArguments): Promise<DebugProtocol.Variable[]> {
    if (ref.kind === 'section') {
      const out: DebugProtocol.Variable[] = [];
      for (const root of this.state.registry.rootsOf(ref.program, ref.section)) {
        out.push(...(await this.renderWithConditions(ref.frameId, ref.program, root, [])));
      }
      return out;
    }
    const item = this.state.registry.item(ref.program, ref.itemId);
    if (!item) {
      return [];
    }
    if (ref.indices.length < item.occursDims.length) {
      return this.listElements(ref.frameId, ref.program, item, ref.indices, args);
    }
    return this.listChildren(ref.frameId, ref.program, item, ref.indices);
  }

  /** Subordinates of a group (or group element) in declaration order, each followed by its own 88s. */
  private async listChildren(frameId: number, entry: ProgramEntry, group: CobolDataItem, indices: number[]): Promise<DebugProtocol.Variable[]> {
    const out: DebugProtocol.Variable[] = [];
    for (const childId of group.children) {
      const child = this.state.registry.item(entry, childId);
      if (!child || child.level === 88) {
        continue; // the group's own 88s were listed beside the group
      }
      out.push(...(await this.renderWithConditions(frameId, entry, child, indices)));
    }
    return out;
  }

  private async listElements(
    frameId: number,
    entry: ProgramEntry,
    item: CobolDataItem,
    indices: number[],
    args: DebugProtocol.VariablesArguments
  ): Promise<DebugProtocol.Variable[]> {
    const total = await this.effectiveCount(frameId, entry, item, indices.length);
    const start = Math.max(0, args.start ?? 0);
    const count = Math.min(total - start, args.count && args.count > 0 ? args.count : DEFAULT_ELEMENT_PAGE);
    const out: DebugProtocol.Variable[] = [];
    for (let i = start; i < start + count; i++) {
      const elementIndices = [...indices, i];
      out.push(...(await this.renderWithConditions(frameId, entry, item, elementIndices, `${item.name}${subscriptSuffix(elementIndices)}`)));
    }
    return out;
  }

  private async renderWithConditions(
    frameId: number,
    entry: ProgramEntry,
    item: CobolDataItem,
    indices: number[],
    name?: string
  ): Promise<DebugProtocol.Variable[]> {
    const rendered = await this.render(frameId, entry, item, indices, name);
    const out = [rendered.variable];
    if (rendered.isTable) {
      return out; // conditions apply per element, listed when the elements are
    }
    for (const childId of item.children) {
      const child = this.state.registry.item(entry, childId);
      if (child?.level === 88 && child.condition) {
        out.push(this.renderCondition(child, item, rendered));
      }
    }
    return out;
  }

  private renderCondition(condition: CobolDataItem, parent: CobolDataItem, parentRendered: RenderedItem): DebugProtocol.Variable {
    const cond = condition.condition;
    let value: string;
    if (!cond) {
      value = unavailable('condition values unknown');
    } else if (!parentRendered.decoded) {
      value = unavailable(parentRendered.error ?? 'parent unavailable');
    } else {
      value = evaluateCondition(cond, parentRendered.decoded, parent);
    }
    return { name: condition.name, value, type: `88-level of ${parent.name}`, variablesReference: 0 };
  }

  /**
   * Live element count of the dimension at `dimIndex` of `item`: the OCCURS maximum, or the
   * DEPENDING ON item's decoded value clamped to `[min, max]`; the maximum when that cannot be read.
   */
  async effectiveCount(frameId: number, entry: ProgramEntry, item: CobolDataItem, dimIndex: number): Promise<number> {
    const dim = item.occursDims[dimIndex];
    const dimItem = dim ? this.state.registry.item(entry, dim.itemId) : undefined;
    const occurs = dimItem?.occurs ?? item.occurs;
    if (!occurs) {
      return dim?.max ?? 0;
    }
    if (occurs.dependingOnItemId === undefined) {
      return occurs.max;
    }
    const depending = this.state.registry.item(entry, occurs.dependingOnItemId);
    if (!depending) {
      return occurs.max;
    }
    const read = await this.memory.readItemBytes(frameId, entry, depending, []);
    if (!read.ok) {
      this.logger.debug(`ODO count of ${item.name} unavailable (${read.error}); using max ${occurs.max}`);
      return occurs.max;
    }
    const decoded = decodeItem(read.bytes, depending);
    if (!decoded.numeric) {
      return occurs.max;
    }
    const scaled = decoded.numeric.scale > 0 ? decoded.numeric.mantissa / 10n ** BigInt(decoded.numeric.scale) : decoded.numeric.mantissa;
    const live = Number(scaled);
    return Math.min(occurs.max, Math.max(occurs.min, Number.isFinite(live) ? live : occurs.min));
  }

  /** Render one item at fixed `indices`; fewer indices than dimensions renders the remaining dimension as a table. */
  async render(frameId: number, entry: ProgramEntry, item: CobolDataItem, indices: number[], name = item.name): Promise<RenderedItem> {
    let type = describeType(item);
    if (item.redefinesItemId !== undefined) {
      const redefined = this.state.registry.item(entry, item.redefinesItemId);
      type += ` REDEFINES ${redefined?.name ?? '?'}`;
    }
    const evaluateName = item.name === 'FILLER' ? undefined : `${item.qualifiedName}${subscriptSuffix(indices)}`;
    const addressResult = await this.memory.addressOf(frameId, entry, item, indices);
    const address = addressResult.ok ? addressResult.address : undefined;
    const memoryReference = address !== undefined ? hexAddress(address) : undefined;

    if (indices.length < item.occursDims.length) {
      const dim = item.occursDims[indices.length];
      const dimItem = this.state.registry.item(entry, dim.itemId);
      const count = await this.effectiveCount(frameId, entry, item, indices.length);
      let value = `OCCURS ${count}`;
      if (dimItem?.occurs?.dependingOnItemId !== undefined) {
        const depending = this.state.registry.item(entry, dimItem.occurs.dependingOnItemId);
        value += ` (1 TO ${dimItem.occurs.max} DEPENDING ON ${depending?.name ?? '?'})`;
      }
      const ref = this.state.allocRef({ kind: 'item', frameId, program: entry, itemId: item.id, indices });
      return {
        variable: { name, value, type, variablesReference: ref, indexedVariables: count, evaluateName, memoryReference },
        address,
        isTable: true,
        count
      };
    }

    const group = isGroupItem(item);
    const childCount = item.children.filter((id) => this.state.registry.item(entry, id)?.level !== 88).length;
    const ref =
      group && childCount > 0
        ? this.state.allocRef({ kind: item.occursDims.length > 0 ? 'element' : 'item', frameId, program: entry, itemId: item.id, indices })
        : 0;
    const read = await this.memory.readItemBytes(frameId, entry, item, indices);
    if (!read.ok) {
      return {
        variable: { name, value: unavailable(read.error), type, variablesReference: ref, namedVariables: ref ? childCount : undefined, evaluateName, memoryReference },
        error: read.error,
        isTable: false
      };
    }
    const decoded = decodeItem(read.bytes, item);
    return {
      variable: {
        name,
        value: decoded.value,
        type,
        variablesReference: ref,
        namedVariables: ref ? childCount : undefined,
        evaluateName,
        memoryReference
      },
      decoded,
      bytes: read.bytes,
      address: read.address,
      isTable: false
    };
  }
}
