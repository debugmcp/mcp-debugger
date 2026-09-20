/**
 * The shim's view of every source breakpoint the engine holds, per file.
 *
 * DAP `setBreakpoints` is replace-all per file, and the client (mcp-debugger's
 * core) only ever describes its own line breakpoints. The shim adds lines of its
 * own to the same files — a paragraph or section function breakpoint resolved
 * to its first statement (M3), a temporary stop a PERFORM-aware step arms — so
 * every send to the engine is the union: the client's entries first, in its
 * order, then the shim's lines that no client entry already covers. CodeLLDB
 * keeps a line's breakpoint id stable across re-sends as long as the line stays
 * in the list (measured), so adding or removing the shim's lines never renumbers
 * the client's; sending one line twice is what it does not tolerate (two ids or
 * a duplicated one, measured), hence the de-duplication.
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
  /** The engine's verdict on the line, once the file was sent. */
  verified?: boolean;
  message?: string;
  engineId?: number;
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
  temp: boolean;
}

/** A client entry as the engine may see it: CodeLLDB's own `{…}` interpolation would have to parse a COBOL name, and a syntax error there aborts the adapter (measured). */
function withoutLogMessage(bp: DebugProtocol.SourceBreakpoint): DebugProtocol.SourceBreakpoint {
  const copy = { ...bp };
  delete copy.logMessage;
  return copy;
}

interface FileState {
  key: string;
  source: DebugProtocol.Source;
  user: DebugProtocol.SourceBreakpoint[];
  temps: Set<number>;
  sent: SentEntry[];
  engineIdByLine: Map<number, number>;
}

export interface EngineSend {
  key: string;
  args: DebugProtocol.SetBreakpointsArguments;
}

export class BreakpointTable {
  private readonly files = new Map<string, FileState>();
  private readonly functions = new Map<number, FunctionBreakpointRecord>();
  private nextFunctionId = FUNCTION_BP_ID_BASE;

  private fileFor(source: DebugProtocol.Source | string): FileState {
    const sourcePath = typeof source === 'string' ? source : (source.path ?? '');
    const key = normalisePath(sourcePath);
    let file = this.files.get(key);
    if (!file) {
      file = {
        key,
        source: typeof source === 'string' ? { name: path.basename(source), path: source } : { ...source },
        user: [],
        temps: new Set(),
        sent: [],
        engineIdByLine: new Map()
      };
      this.files.set(key, file);
    } else if (typeof source !== 'string') {
      // The client's spelling of the path wins over the manifest's for the engine.
      file.source = { ...source };
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
    const userSent: DebugProtocol.SourceBreakpoint[] = [];
    file.user.forEach((bp, i) => {
      let entry = byLine.get(bp.line);
      if (!entry) {
        entry = { line: bp.line, user: true, userIndices: [], logpoint: true, logMessages: [], fnIds: [], temp: false };
        byLine.set(bp.line, entry);
        sent.push(entry);
        userSent.push(withoutLogMessage(bp));
      }
      entry.userIndices.push(i);
      if (typeof bp.logMessage === 'string' && bp.logMessage.length > 0) {
        entry.logMessages.push(bp.logMessage);
      } else {
        entry.logpoint = false;
      }
    });
    const extra = (line: number): SentEntry => {
      let entry = byLine.get(line);
      if (!entry) {
        entry = { line, user: false, userIndices: [], logpoint: false, logMessages: [], fnIds: [], temp: false };
        byLine.set(line, entry);
        sent.push(entry);
      }
      return entry;
    };
    for (const record of this.functions.values()) {
      if (normalisePath(record.path) === file.key) {
        extra(record.line).fnIds.push(record.id);
      }
    }
    for (const line of file.temps) {
      extra(line).temp = true;
    }
    file.sent = sent;
    const breakpoints: DebugProtocol.SourceBreakpoint[] = [
      ...userSent,
      ...sent.filter((entry) => !entry.user).map((entry) => ({ line: entry.line }))
    ];
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

  addFunctionBreakpoint(name: string, sourcePath: string, line: number, description: string): FunctionBreakpointRecord {
    const record: FunctionBreakpointRecord = { id: this.nextFunctionId++, name, path: sourcePath, line, description };
    this.functions.set(record.id, record);
    this.fileFor(sourcePath);
    return record;
  }

  /** Drop every function breakpoint; returns the file keys that carried one. */
  clearFunctionBreakpoints(): string[] {
    const keys = new Set<string>();
    for (const record of this.functions.values()) {
      keys.add(normalisePath(record.path));
    }
    this.functions.clear();
    return [...keys];
  }

  functionBreakpoints(): FunctionBreakpointRecord[] {
    return [...this.functions.values()];
  }

  /** Arm a temporary line (a PERFORM-aware step's stop); returns the file key to re-send. */
  addTemp(sourcePath: string, line: number): string {
    const file = this.fileFor(sourcePath);
    file.temps.add(line);
    return file.key;
  }

  /** Drop every temporary line; returns the file keys that carried one. */
  clearTemps(): string[] {
    const keys: string[] = [];
    for (const file of this.files.values()) {
      if (file.temps.size > 0) {
        file.temps.clear();
        keys.push(file.key);
      }
    }
    return keys;
  }

  hasTemps(): boolean {
    return [...this.files.values()].some((file) => file.temps.size > 0);
  }

  engineIdOf(sourcePath: string, line: number): number | undefined {
    return this.files.get(normalisePath(sourcePath))?.engineIdByLine.get(line);
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
   * function ids on the same lines are added, and lines only the shim asked for are
   * dropped (their engine id means nothing to the client). Unknown ids pass through.
   */
  translateHitIds(ids: readonly number[]): number[] {
    const out: number[] = [];
    for (const id of ids) {
      const roles = this.rolesOf(id);
      if (!roles) {
        out.push(id);
        continue;
      }
      if (roles.user) {
        out.push(id);
      }
      out.push(...roles.fnIds);
    }
    return out;
  }

  /** The logpoint messages on the lines these engine ids name (empty when none is a logpoint line). */
  logMessagesOf(ids: readonly number[]): string[] {
    const out: string[] = [];
    for (const id of ids) {
      const roles = this.rolesOf(id);
      if (roles?.logpoint) {
        out.push(...roles.logMessages);
      }
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
      return roles !== undefined && roles.user && roles.logpoint && roles.fnIds.length === 0 && !roles.temp;
    });
  }

  /** True when every id names a line only the shim's temps asked for. */
  isTempOnlyHit(ids: readonly number[]): boolean {
    if (ids.length === 0) {
      return false;
    }
    return ids.every((id) => {
      const roles = this.rolesOf(id);
      return roles !== undefined && roles.temp && !roles.user && roles.fnIds.length === 0;
    });
  }

  /**
   * A `breakpoint` event from the engine, as the client should see it: the original when the
   * line is the client's, a copy per function breakpoint on that line, nothing for a line
   * only a temp asked for.
   */
  translateBreakpointEvent(body: DebugProtocol.BreakpointEvent['body']): Array<DebugProtocol.BreakpointEvent['body']> {
    const id = body.breakpoint?.id;
    const roles = typeof id === 'number' ? this.rolesOf(id) : undefined;
    if (!roles) {
      return [body];
    }
    const out: Array<DebugProtocol.BreakpointEvent['body']> = [];
    if (roles.user) {
      out.push(body);
    }
    for (const fnId of roles.fnIds) {
      const record = this.functions.get(fnId);
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
