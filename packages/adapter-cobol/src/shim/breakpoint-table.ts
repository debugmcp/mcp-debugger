/**
 * The shim's view of every source breakpoint the engine holds, per file.
 *
 * DAP `setBreakpoints` is replace-all per file, and the client (mcp-debugger's
 * core) only ever describes its own line breakpoints. The shim adds lines of its
 * own to the same files — a paragraph or section function breakpoint resolved
 * to its first statement (M3) — so every send to the engine is the union: the
 * client's lines first, in its order, then the shim's lines that no client entry
 * already covers. CodeLLDB keeps a line's breakpoint id stable across re-sends as
 * long as the line stays in the list (measured), so adding or removing the shim's
 * lines never renumbers the client's; sending one line twice is what it does not
 * tolerate (two ids, or one id for both, measured), hence one entry per line. Two
 * breakpoints on one line with different conditions therefore cannot both be
 * honoured: the line is sent unconditional and each affected entry says so in
 * its message. A file is always sent under the first spelling of its path the
 * shim saw (normalised), because the engine keys its own per-file table on the
 * raw string: a second spelling would be a second file to it and each side's
 * replace-all would delete the other's lines.
 *
 * Function breakpoints carry shim-assigned ids (from FUNCTION_BP_ID_BASE, far
 * above the engine's small sequential ids): a hit on their line reports the
 * client's own line breakpoint id when it has one there *and* the function ids,
 * and a `breakpoint` event for the line is mirrored under each function id.
 * Lines only the shim asked for never reach the client under the engine's id.
 */
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { normalisePath } from './manifest-registry.js';

export const FUNCTION_BP_ID_BASE = 1_000_000;

export interface FunctionBreakpointRecord {
  /** Shim-assigned, reported to the client as the breakpoint's id. */
  id: number;
  /** The name the client asked for, as written. */
  name: string;
  /** Resolved location. */
  path: string;
  line: number;
  /** What resolution produced, for the response: `1000-INIT (paragraph of HELLO)`. */
  description: string;
  /** The client's condition for it, if any. */
  condition?: string;
  /** Something about the line the response should say (a condition not applied). */
  note?: string;
  /** The engine's verdict on the line, once the file was sent. */
  verified?: boolean;
  message?: string;
  engineId?: number;
  /** Private one-shot entry stop, excluded from client ids and function replacement. */
  internal?: boolean;
}

/** One position of the list last sent to the engine for a file. */
export interface SentEntry {
  line: number;
  /** The client's own entry sits here. */
  user: boolean;
  /** Positions in the client's list that this line answers for (several when the client sent a line twice). */
  userIndices: number[];
  /** The client's entries on this line are all logpoints: a hit logs and resumes instead of pausing. */
  logpoint: boolean;
  /** The `logMessage`s of the client's entries on this line, in order. */
  logMessages: string[];
  fnIds: number[];
  /** The condition sent for the line, when every breakpoint on it agrees on one. */
  condition?: string;
  /** Some breakpoints on this line wanted a condition the line was not sent with. */
  conditionDropped: boolean;
  /** A client entry's `hitCondition` was not sent: the line carries more than that one breakpoint. */
  hitConditionDropped: boolean;
}

interface FileState {
  key: string;
  source: DebugProtocol.Source;
  user: DebugProtocol.SourceBreakpoint[];
  sent: SentEntry[];
  engineIdByLine: Map<number, number>;
}

/** The engine-side path of a file: `.`/`..` folded, separators native, so one file has one spelling. */
function canonicalPath(sourcePath: string): string {
  return path.normalize(sourcePath);
}

export interface EngineSend {
  key: string;
  args: DebugProtocol.SetBreakpointsArguments;
}

export class BreakpointTable {
  private readonly files = new Map<string, FileState>();
  private readonly functions = new Map<number, FunctionBreakpointRecord>();
  private nextFunctionId = FUNCTION_BP_ID_BASE;
  private readonly hiddenEngineIds = new Set<number>();

  private fileFor(source: DebugProtocol.Source | string): FileState {
    const sourcePath = canonicalPath(typeof source === 'string' ? source : (source.path ?? ''));
    const key = normalisePath(sourcePath);
    let file = this.files.get(key);
    if (!file) {
      // The first spelling is the file's spelling for the engine from now on.
      file = {
        key,
        source: { ...(typeof source === 'string' ? {} : source), name: path.basename(sourcePath), path: sourcePath },
        user: [],
        sent: [],
        engineIdByLine: new Map()
      };
      this.files.set(key, file);
    }
    return file;
  }

  /** The client replaced its breakpoints for a file: remember them, answer with the union to send. */
  setUserBreakpoints(source: DebugProtocol.Source, breakpoints: readonly DebugProtocol.SourceBreakpoint[]): EngineSend {
    const file = this.fileFor(source);
    file.user = breakpoints.map((bp) => ({ ...bp }));
    return this.engineSendFor(file);
  }

  /** The union for a file as it stands, to re-send after the shim's own lines changed. */
  engineSendFor(fileOrKey: FileState | string): EngineSend {
    const file = typeof fileOrKey === 'string' ? this.files.get(fileOrKey) : fileOrKey;
    if (!file) {
      throw new Error(`no breakpoint file state for ${String(fileOrKey)}`);
    }
    // One engine entry per line: the client's first entry on a line stands for every later
    // one there (two entries on one line get one id or a duplicated one from CodeLLDB).
    const sent: SentEntry[] = [];
    const byLine = new Map<number, SentEntry>();
    const wanted = new Map<number, string[]>();
    const want = (line: number, condition: string | undefined): void => {
      const list = wanted.get(line) ?? [];
      list.push((condition ?? '').trim());
      wanted.set(line, list);
    };
    file.user.forEach((bp, i) => {
      let entry = byLine.get(bp.line);
      if (!entry) {
        entry = { line: bp.line, user: true, userIndices: [], logpoint: true, logMessages: [], fnIds: [], conditionDropped: false, hitConditionDropped: false };
        byLine.set(bp.line, entry);
        sent.push(entry);
      }
      entry.userIndices.push(i);
      want(bp.line, bp.condition);
      if (typeof bp.logMessage === 'string' && bp.logMessage.length > 0) {
        entry.logMessages.push(bp.logMessage);
      } else {
        entry.logpoint = false;
      }
    });
    for (const record of this.functions.values()) {
      if (normalisePath(record.path) !== file.key) {
        continue;
      }
      let entry = byLine.get(record.line);
      if (!entry) {
        entry = { line: record.line, user: false, userIndices: [], logpoint: false, logMessages: [], fnIds: [], conditionDropped: false, hitConditionDropped: false };
        byLine.set(record.line, entry);
        sent.push(entry);
      }
      entry.fnIds.push(record.id);
      want(record.line, record.condition);
    }
    // The line's condition: the one every breakpoint on it asked for, else none — a
    // condition never leaks onto a breakpoint that did not ask for it, and a line with
    // disagreeing conditions pauses unconditionally, which each entry's message says.
    for (const entry of sent) {
      const conditions = wanted.get(entry.line) ?? [];
      const distinct = [...new Set(conditions)];
      if (distinct.length === 1 && distinct[0].length > 0) {
        entry.condition = distinct[0];
      } else if (conditions.some((c) => c.length > 0)) {
        entry.conditionDropped = true;
      }
    }
    file.sent = sent;
    // The client's entries in its order, then the shim's; a logMessage never reaches the
    // engine (CodeLLDB's own `{…}` interpolation aborts the adapter on a COBOL name, measured).
    const breakpoints: DebugProtocol.SourceBreakpoint[] = sent.map((entry) => {
      const bp: DebugProtocol.SourceBreakpoint = { line: entry.line };
      if (entry.condition !== undefined) {
        bp.condition = entry.condition;
      }
      const only = entry.userIndices.length === 1 && entry.fnIds.length === 0 ? file.user[entry.userIndices[0]] : undefined;
      if (only?.hitCondition) {
        bp.hitCondition = only.hitCondition;
      } else if (entry.userIndices.some((i) => file.user[i].hitCondition)) {
        entry.hitConditionDropped = true;
      }
      return bp;
    });
    return { key: file.key, args: { source: { ...file.source }, breakpoints } };
  }

  /**
   * The engine answered a send: record ids per line, refresh the function records on those
   * lines, and return what the client may see — its own entries, positionally, and nothing
   * of the shim's.
   */
  recordResponse(key: string, breakpoints: readonly DebugProtocol.Breakpoint[]): DebugProtocol.Breakpoint[] {
    const file = this.files.get(key);
    if (!file) {
      return [...breakpoints];
    }
    file.engineIdByLine.clear();
    const clientView: DebugProtocol.Breakpoint[] = file.user.map(() => ({ verified: false, message: 'no answer from the engine' }));
    file.sent.forEach((entry, i) => {
      const answer = breakpoints[i];
      if (!answer) {
        return;
      }
      for (const index of entry.userIndices) {
        clientView[index] = { ...answer };
        const notes: string[] = [];
        if (entry.conditionDropped && (file.user[index].condition ?? '').trim().length > 0) {
          notes.push(`condition not applied: line ${entry.line} is shared by breakpoints with different conditions`);
        }
        if (entry.hitConditionDropped && file.user[index].hitCondition) {
          notes.push(`hitCondition not applied: line ${entry.line} carries more than this breakpoint`);
        }
        if (notes.length > 0) {
          clientView[index].message = [answer.message, ...notes].filter((part) => part).join('; ');
        }
      }
      if (typeof answer.id === 'number') {
        file.engineIdByLine.set(entry.line, answer.id);
      }
      for (const fnId of entry.fnIds) {
        const record = this.functions.get(fnId);
        if (record) {
          record.verified = answer.verified;
          record.message = answer.message;
          record.engineId = answer.id;
          if (record.internal && !entry.user && entry.fnIds.every(id => this.functions.get(id)?.internal) && answer.id !== undefined) this.hiddenEngineIds.add(answer.id);
          record.note = entry.conditionDropped && record.condition
            ? `condition not applied: line ${entry.line} is shared by breakpoints with different conditions`
            : undefined;
          if (typeof answer.line === 'number') {
            record.line = answer.line;
          }
        }
      }
    });
    return clientView;
  }

  /** A send the engine refused: the shim's records on that file say so. */
  recordRefusal(key: string, message: string | undefined): void {
    const file = this.files.get(key);
    if (!file) {
      return;
    }
    for (const entry of file.sent) {
      for (const fnId of entry.fnIds) {
        const record = this.functions.get(fnId);
        if (record) {
          record.verified = false;
          record.message = message;
        }
      }
    }
  }

  addFunctionBreakpoint(name: string, sourcePath: string, line: number, description: string, condition?: string): FunctionBreakpointRecord {
    const record: FunctionBreakpointRecord = { id: this.nextFunctionId++, name, path: canonicalPath(sourcePath), line, description };
    if (condition !== undefined && condition.trim().length > 0) {
      record.condition = condition.trim();
    }
    this.functions.set(record.id, record);
    this.fileFor(sourcePath);
    return record;
  }

  /** Drop every function breakpoint; returns the file keys that carried one. */
  clearFunctionBreakpoints(): string[] {
    const keys = new Set<string>();
    for (const record of this.functions.values()) {
      if (record.internal) continue;
      keys.add(normalisePath(record.path));
      this.functions.delete(record.id);
    }
    return [...keys];
  }

  functionBreakpoints(): FunctionBreakpointRecord[] {
    return [...this.functions.values()].filter(record => !record.internal);
  }

  removeInternal(record: FunctionBreakpointRecord): void {
    if (record.internal) this.functions.delete(record.id);
  }

  engineIdOf(sourcePath: string, line: number): number | undefined {
    return this.files.get(normalisePath(canonicalPath(sourcePath)))?.engineIdByLine.get(line);
  }

  /** The roles of the line an engine breakpoint id stands for, when the shim sent it. */
  rolesOf(engineId: number): SentEntry | undefined {
    for (const file of this.files.values()) {
      for (const [line, id] of file.engineIdByLine) {
        if (id === engineId) {
          return file.sent.find((entry) => entry.line === line);
        }
      }
    }
    return undefined;
  }

  /**
   * The client's view of a stop's `hitBreakpointIds`: engine ids the client knows stay,
   * function ids on the same lines are added, and a line only a function breakpoint
   * asked for is reported under its function ids alone (its engine id means nothing to
   * the client). Unknown ids pass through.
   */
  translateHitIds(ids: readonly number[]): number[] {
    const out: number[] = [];
    for (const id of ids) {
      const roles = this.rolesOf(id);
      if (!roles) {
        if (!this.hiddenEngineIds.has(id)) out.push(id);
        continue;
      }
      if (roles.user) {
        out.push(id);
      }
      out.push(...roles.fnIds.filter(id => !this.functions.get(id)?.internal));
    }
    return out;
  }

  /** Every logpoint message on the lines these engine ids name — a line that also pauses included. */
  logMessagesOf(ids: readonly number[]): string[] {
    const out: string[] = [];
    for (const id of ids) {
      out.push(...(this.rolesOf(id)?.logMessages ?? []));
    }
    return out;
  }

  /** True when every id names a line the client asked only to log at: nothing there pauses. */
  isLogpointOnlyHit(ids: readonly number[]): boolean {
    if (ids.length === 0) {
      return false;
    }
    return ids.every((id) => {
      const roles = this.rolesOf(id);
      return roles !== undefined && roles.user && roles.logpoint && roles.fnIds.length === 0;
    });
  }

  /**
   * A `breakpoint` event from the engine, as the client should see it: the original when the
   * line is the client's, a copy per function breakpoint on that line.
   */
  translateBreakpointEvent(body: DebugProtocol.BreakpointEvent['body']): Array<DebugProtocol.BreakpointEvent['body']> {
    const id = body.breakpoint?.id;
    const roles = typeof id === 'number' ? this.rolesOf(id) : undefined;
    if (!roles) {
      return typeof id === 'number' && this.hiddenEngineIds.has(id) ? [] : [body];
    }
    const out: Array<DebugProtocol.BreakpointEvent['body']> = [];
    if (roles.user) {
      out.push(body);
    }
    for (const fnId of roles.fnIds) {
      const record = this.functions.get(fnId);
      if (record?.internal) continue;
      if (record) {
        record.verified = body.breakpoint.verified;
        record.message = body.breakpoint.message;
        if (typeof body.breakpoint.line === 'number') {
          record.line = body.breakpoint.line;
        }
      }
      out.push({ ...body, breakpoint: { ...body.breakpoint, id: fnId } });
    }
    return out;
  }
}
