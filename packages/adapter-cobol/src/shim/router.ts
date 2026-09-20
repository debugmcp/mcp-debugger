/**
 * The dispatch table of the shim: which client requests are forwarded to
 * CodeLLDB untouched, which are forwarded and their responses rewritten, and
 * which the shim answers itself from the manifest and the debuggee's memory.
 *
 * Two ordering rules shape every branch here:
 *   - a request the shim answers itself reserves its output slot when the
 *     request arrives, so a `stopped` that lands while the answer is being
 *     computed can never overtake it;
 *   - a request forwarded to the engine reserves its slot only when the
 *     engine's response arrives, because CodeLLDB emits `initialized` before
 *     the `launch` response and holds that response until the client has
 *     sent `configurationDone` — a slot reserved earlier would deadlock the
 *     handshake.
 */
import path from 'node:path';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { CobolSection } from '../manifest/schema.js';
import { COBOL_PRIVATE_KEY, type CobolShimSessionOptions } from '../shim-protocol.js';
import type { ClientConnection, ClientInbound, OutputSlot } from './client-connection.js';
import { parseCobolExpression } from './cobol-expression.js';
import type { EngineClient, EngineInbound } from './engine-client.js';
import { EvaluateHandler } from './handlers/evaluate.js';
import { annotateStackFrames, isCobolProgramFrame, isLandedCobolFrame } from './handlers/stack-trace.js';
import { VariablesHandler } from './handlers/variables.js';
import type { ShimLogger } from './logger.js';
import type { FunctionBreakpointRecord } from './breakpoint-table.js';
import { normalisePath, type ProgramEntry } from './manifest-registry.js';
import { MemoryReader } from './memory-reader.js';
import { hexAddress, readPerformDepth, readReturnAddress, resolveAddressLocation } from './perform-frames.js';
import { nextStatementAfter, resolveProcedureName, statementAt } from './procedure-names.js';
import { errorMessage, errorResponse, okResponse } from './protocol.js';
import type { CachedFrame, SessionState } from './session-state.js';

export const COBOL_RUNTIME_ERROR_FILTER = 'cobol_runtime_error';
export const RUNTIME_ERROR_FUNCTION = 'cob_runtime_error';
export const MAX_STEP_ITERATIONS = 400;
export const STEP_BOUND_DESCRIPTION = `stepped ${MAX_STEP_ITERATIONS} generated lines without reaching a COBOL statement`;
export const PERFORM_BOUND_DESCRIPTION = `the performed range was re-entered ${MAX_STEP_ITERATIONS} times without reaching the statement after the PERFORM; set a breakpoint after it`;

const NATIVE_EVALUATE_PREFIX = /^\/(nat|py|se|cmd)\b/;
const COBOL_SECTIONS: readonly CobolSection[] = ['WORKING-STORAGE', 'LOCAL-STORAGE', 'LINKAGE', 'FILE'];

type MaybePromise<T> = T | Promise<T>;

/** What travels with a forwarded client request and comes back with its response. */
export interface ForwardMeta {
  /** A slot reserved when the request arrived (shim-decided requests); otherwise one is reserved on arrival. */
  slot?: OutputSlot;
  transform?: (response: DebugProtocol.Response) => MaybePromise<DebugProtocol.ProtocolMessage | null>;
}

export interface RouterHooks {
  /** The client asked to disconnect/terminate: the core arms its wait-then-kill. */
  onDisconnectRequested(): void;
  /** Something the shim must not paper over (a reference-band collision under `--ref-check strict`). */
  onFatal(message: string): void;
}

export interface RouterEnv {
  platform: NodeJS.Platform;
  arch: string;
}

type StepSignal = { kind: 'stopped'; event: DebugProtocol.Event; slot: OutputSlot } | { kind: 'aborted' };

/**
 * A PERFORM-aware step: the program runs to temporary stops instead of being stepped
 * statement by statement through the performed range (M3). `over` from a PERFORM
 * statement arms the statement after it; `out` from inside a performed range arms the
 * statement after the PERFORM that entered it; both also arm the current range's own
 * return address when inside one, so a PERFORM that is the last statement of a performed
 * paragraph steps out to the performer. A return stop is followed by the ordinary `next`
 * walk to the next COBOL statement; a landing that is still inside the range (a PERFORM
 * … TIMES / UNTIL loop re-entering it) continues to the armed statement.
 */
interface PerformPlan {
  kind: 'over' | 'out';
  /** PERFORM depth where the step started. */
  depth: number;
  origin: CachedFrame;
  /** Engine ids of the plan's own stops: the temporary source line(s) and the instruction breakpoint. */
  ownIds: Set<number>;
  instructionId?: number;
  /** After the return-address stop, the loop walks `next` to the next COBOL statement. */
  returning: boolean;
  finished: boolean;
}

interface StepLoop {
  threadId: number;
  /** The client's request: `stepIn` continues with `stepIn` (into a CALLed program), the rest with `next`. */
  command: string;
  /** Where the step started; a landing on the very same statement is not a completed step. */
  origin?: { path?: string; line: number; name: string };
  queued: StepSignal[];
  waiter?: (signal: StepSignal) => void;
  /** Wakes the loop while it still waits for the initial step's response. */
  abort?: () => void;
  plan?: PerformPlan;
}

type StoppedBody = DebugProtocol.StoppedEvent['body'];

/** The register that carries libcob's first argument (the format string) at a `cob_runtime_error` stop. */
export function formatStringRegister(env: RouterEnv): string {
  if (env.arch === 'arm64') {
    return '$x0';
  }
  return env.platform === 'win32' ? '$rcx' : '$rdi';
}

/** How deep the shim looks for the nearest COBOL frame above a libcob/C frame. */
const WALK_UP_STACK_LEVELS = 64;
/** How many other threads a re-anchor unwinds looking for the COBOL program. */
const RETARGET_MAX_THREADS = 8;

/** Stop descriptions a debugger-initiated stop carries: the break an attach or a pause injects (Windows), the signal a pause sends (POSIX). */
const NEUTRAL_STOP_DESCRIPTION = /0x80000003|breakpoint|SIGSTOP|SIGTRAP|SIGINT|EXC_BREAKPOINT/i;

/** What the shim knows about why a stop happened, beyond the event's own body. */
interface StopContext {
  /** The first stop after an `attach`: the handshake's, not the program's. */
  attachHandshake: boolean;
  /** A client `pause` was forwarded and this is the stop that answers it. */
  pausePending: boolean;
}

/**
 * True for a stop the debugger caused, not the program (see retargetToCobolThread). An
 * `exception` stop counts only when the shim knows a debugger stop was due — the attach
 * handshake, or a pause it forwarded (the gate the shared LLDB policy applies too): a
 * genuine __debugbreak()/int3/SIGTRAP in a CALLed C routine or a helper thread with
 * no pause in flight stays where it happened.
 */
function isProgramNeutralStop(body: StoppedBody, context: StopContext): boolean {
  if ((body.hitBreakpointIds ?? []).length > 0) {
    return false;
  }
  switch (body.reason) {
    case 'pause':
      // Not 'entry': a launch's entry stop precedes the program (no COBOL frame anywhere
      // yet), so the walk would only cost a threads request and a stack per thread.
      return true;
    case 'exception':
      return (context.attachHandshake || context.pausePending) && NEUTRAL_STOP_DESCRIPTION.test(`${body.description ?? ''} ${body.text ?? ''}`);
    default:
      return false;
  }
}

export class Router {
  private readonly memory: MemoryReader;
  private readonly variables: VariablesHandler;
  private readonly evaluator: EvaluateHandler;
  private stepLoop?: StepLoop;

  constructor(
    private readonly state: SessionState,
    private readonly engine: EngineClient<ForwardMeta>,
    private readonly client: ClientConnection,
    private readonly logger: ShimLogger,
    private readonly hooks: RouterHooks,
    private readonly env: RouterEnv
  ) {
    this.memory = new MemoryReader(engine, state, logger);
    this.variables = new VariablesHandler(state, this.memory, logger);
    this.evaluator = new EvaluateHandler(state, this.memory, this.variables, logger);
  }

  // ---------------------------------------------------------------- inbound

  onClientMessage(message: ClientInbound): void {
    switch (message.kind) {
      case 'request':
        this.onClientRequest(message.request);
        return;
      case 'response':
        if (message.engineSeq === undefined) {
          this.logger.warn(`client response to unknown reverse request ${message.response.request_seq}`);
          return;
        }
        this.engine.sendResponse({ ...message.response, request_seq: message.engineSeq });
        return;
      case 'event':
        this.logger.warn(`client sent an event (${message.event.event}); dropped`);
    }
  }

  onEngineMessage(message: EngineInbound<ForwardMeta>): void {
    if (message.kind === 'response') {
      const slot = message.meta.slot ?? this.client.reserve();
      const transform = message.meta.transform;
      this.settle(slot, transform ? () => transform(message.response) : () => message.response, message.response);
      return;
    }
    const slot = this.client.reserve();
    if (message.kind === 'request') {
      slot.resolve(message.request);
      return;
    }
    this.onEngineEvent(message.event, slot);
  }

  /** The engine socket went away: nothing else will arrive, so a waiting step loop must let go. */
  onEngineClosed(): void {
    this.abortStepLoop();
  }

  // ---------------------------------------------------------------- plumbing

  private settle(
    slot: OutputSlot,
    produce: () => MaybePromise<DebugProtocol.ProtocolMessage | null>,
    fallback: DebugProtocol.ProtocolMessage | null
  ): void {
    let value: MaybePromise<DebugProtocol.ProtocolMessage | null>;
    try {
      value = produce();
    } catch (error) {
      this.logger.error('transform threw; forwarding the engine message as is', error);
      slot.resolve(fallback);
      return;
    }
    Promise.resolve(value)
      .then((message) => slot.resolve(message))
      .catch((error: unknown) => {
        this.logger.error('transform failed; forwarding the engine message as is', error);
        slot.resolve(fallback);
      });
  }

  private forward(request: DebugProtocol.Request, meta: ForwardMeta = {}): void {
    if (!this.engine.forward(request, meta)) {
      const failure = errorResponse(request, 'engine connection closed');
      if (meta.slot) {
        meta.slot.resolve(failure);
      } else {
        this.client.send(failure);
      }
    }
  }

  /**
   * A request the shim decides: the slot is reserved now. `decide` either returns a
   * complete response or asks for the (possibly rewritten) request to be forwarded
   * into that same slot.
   */
  private serve(
    request: DebugProtocol.Request,
    decide: () => Promise<DebugProtocol.Response | { forward: DebugProtocol.Request; transform?: ForwardMeta['transform'] }>
  ): void {
    const slot = this.client.reserve();
    decide()
      .then((outcome) => {
        if ('forward' in outcome) {
          this.forward(outcome.forward, { slot, transform: outcome.transform });
        } else {
          slot.resolve(outcome);
        }
      })
      .catch((error: unknown) => {
        this.logger.error(`${request.command} failed in the shim`, error);
        slot.resolve(errorResponse(request, `COBOL shim: ${errorMessage(error)}`));
      });
  }

  private argsOf<T>(request: DebugProtocol.Request): T {
    return (request.arguments ?? {}) as T;
  }

  // ---------------------------------------------------------------- requests

  private onClientRequest(request: DebugProtocol.Request): void {
    this.logger.debug(`client request ${request.command} (seq ${request.seq})`);
    switch (request.command) {
      case 'initialize':
        this.forward(request, { transform: (response) => this.patchInitialize(response) });
        return;
      case 'launch':
      case 'attach':
        this.onLaunchOrAttach(request);
        return;
      case 'continue':
        this.resumeAfterDroppingTemporaryStops(request);
        return;
      case 'pause':
        // Remembered so the stop that answers it is known to be the debugger's doing; a
        // refused pause (already stopped, not interruptible) has no stop to answer it.
        this.state.pausePending = true;
        this.forward(request, {
          transform: (response) => {
            if (!response.success) {
              this.state.pausePending = false;
            }
            return response;
          }
        });
        return;
      case 'setBreakpoints':
        this.onSetBreakpoints(request);
        return;
      case 'setExceptionBreakpoints':
        this.onSetExceptionBreakpoints(request);
        return;
      case 'setFunctionBreakpoints':
        this.onSetFunctionBreakpoints(request);
        return;
      case 'stackTrace':
        this.forward(request, { transform: (response) => this.onStackTraceResponse(request, response) });
        return;
      case 'scopes':
        this.serve(request, () => this.onScopes(request));
        return;
      case 'variables':
        this.onVariables(request);
        return;
      case 'evaluate':
        this.onEvaluate(request);
        return;
      case 'exceptionInfo':
        this.onExceptionInfo(request);
        return;
      case 'next':
      case 'stepIn':
      case 'stepOut':
        this.onStep(request);
        return;
      case 'setVariable':
      case 'setExpression':
      case 'dataBreakpointInfo':
        this.onDataOperation(request);
        return;
      case 'disconnect':
      case 'terminate':
        this.hooks.onDisconnectRequested();
        this.forward(request);
        return;
      default:
        this.forward(request);
    }
  }

  private patchInitialize(response: DebugProtocol.Response): DebugProtocol.Response {
    if (!response.success) {
      return response;
    }
    const body = (response.body ?? {}) as DebugProtocol.Capabilities;
    this.state.engineCapabilities = { ...body };
    body.exceptionBreakpointFilters = [
      {
        filter: COBOL_RUNTIME_ERROR_FILTER,
        label: 'COBOL: runtime error (libcob cob_runtime_error)',
        default: true
      }
    ];
    body.supportsExceptionInfoRequest = true;
    // Paragraph, section and PROGRAM-ID names are resolved by the shim to source
    // breakpoints; a C symbol still goes to the engine. Either way the request is served.
    body.supportsFunctionBreakpoints = true;
    // `{WS-NAME}` is interpolated by the shim at the stop, which then resumes; the engine
    // never sees a logMessage (its own parser aborts the adapter on a COBOL name).
    body.supportsLogPoints = true;
    body.supportsSetVariable = false;
    response.body = body;
    return response;
  }

  private onLaunchOrAttach(request: DebugProtocol.Request): void {
    this.state.mode = request.command === 'attach' ? 'attach' : 'launch';
    const args = request.arguments as Record<string, unknown> | undefined;
    // CodeLLDB stops the target after an attach only with stopOnEntry (it resumes otherwise),
    // so only then is the session's first stop the handshake's rather than the program's.
    this.state.attachStopExpected = request.command === 'attach' && args?.stopOnEntry !== false;
    if (args && typeof args === 'object') {
      const block = args[COBOL_PRIVATE_KEY];
      delete args[COBOL_PRIVATE_KEY];
      if (block && typeof block === 'object') {
        this.state.applySessionOptions(block as Partial<CobolShimSessionOptions>);
      }
    }
    this.state.ensureManifests();
    this.logger.info(`${request.command}: ${this.state.registry.programCount} program(s) from ${this.state.options.manifestDirs.length} manifest dir(s)`);
    this.forward(request);
  }

  private onSetExceptionBreakpoints(request: DebugProtocol.Request): void {
    const args = this.argsOf<DebugProtocol.SetExceptionBreakpointsArguments>(request);
    const filters = args.filters ?? [];
    const index = filters.indexOf(COBOL_RUNTIME_ERROR_FILTER);
    const options = args.filterOptions;
    const armedByOption = options?.some((o) => o.filterId === COBOL_RUNTIME_ERROR_FILTER) ?? false;
    this.state.runtimeErrorArmed = index >= 0 || armedByOption;
    const forwardedArgs: DebugProtocol.SetExceptionBreakpointsArguments = {
      ...args,
      filters: filters.filter((f) => f !== COBOL_RUNTIME_ERROR_FILTER)
    };
    if (options) {
      forwardedArgs.filterOptions = options.filter((o) => o.filterId !== COBOL_RUNTIME_ERROR_FILTER);
    }
    this.forward(
      { ...request, arguments: forwardedArgs },
      {
        transform: async (response) => {
          const union = await this.sendFunctionBreakpointUnion();
          const body = response.body as DebugProtocol.SetExceptionBreakpointsResponse['body'] | undefined;
          if (index >= 0 && body && Array.isArray(body.breakpoints)) {
            body.breakpoints.splice(index, 0, { verified: union.verified, message: union.message });
          }
          return response;
        }
      }
    );
  }

  /** Re-send the engine-bound function breakpoints plus the runtime-error hook; a refusal (noDebug) is logged, never surfaced. */
  private async sendFunctionBreakpointUnion(): Promise<{ verified: boolean; message?: string }> {
    return (await this.sendEngineFunctionBreakpoints(this.state.userFunctionBps)).hook;
  }

  /**
   * One `setFunctionBreakpoints` to the engine: the C-symbol names the client asked for plus
   * the runtime-error hook when armed. Answers with the engine's entry per name (none when the
   * engine refused) and the hook's own state.
   */
  private async sendEngineFunctionBreakpoints(
    names: readonly DebugProtocol.FunctionBreakpoint[]
  ): Promise<{ entries: DebugProtocol.Breakpoint[]; refused?: string; hook: { verified: boolean; message?: string } }> {
    const breakpoints: DebugProtocol.FunctionBreakpoint[] = [...names];
    if (this.state.runtimeErrorArmed) {
      breakpoints.push({ name: RUNTIME_ERROR_FUNCTION });
    }
    let response: DebugProtocol.Response;
    try {
      response = await this.engine.request('setFunctionBreakpoints', { breakpoints });
    } catch (error) {
      this.logger.warn('function breakpoint union not answered', error);
      return { entries: [], refused: errorMessage(error), hook: { verified: false, message: errorMessage(error) } };
    }
    if (!response.success) {
      this.logger.warn(`function breakpoint union refused by the engine: ${response.message ?? 'no message'}`);
      this.state.runtimeErrorBpId = undefined;
      return { entries: [], refused: response.message ?? 'setFunctionBreakpoints refused', hook: { verified: false, message: response.message } };
    }
    // A real engine answers with one entry per breakpoint; a body without them (measured under noDebug
    // refusals, possible from any engine) must not throw its way out of the client's response.
    const body = response.body as Partial<DebugProtocol.SetFunctionBreakpointsResponse['body']> | undefined;
    const answered = body?.breakpoints ?? [];
    const ours = this.state.runtimeErrorArmed ? answered[breakpoints.length - 1] : undefined;
    this.state.runtimeErrorBpId = ours?.id;
    this.logger.info(`runtime-error hook ${this.state.runtimeErrorArmed ? `armed (id ${ours?.id ?? 'unknown'}, verified ${ours?.verified ?? false})` : 'disarmed'}`);
    return { entries: answered.slice(0, names.length), hook: { verified: ours?.verified ?? false, message: ours?.message } };
  }

  /**
   * Function breakpoints, COBOL-shaped: a paragraph, section or PROGRAM-ID name becomes a
   * source breakpoint on its first statement, sent in the union with the client's own line
   * breakpoints of that file (see BreakpointTable) and reported under a shim id; a C symbol
   * (`HELLO_`, `cob_runtime_error`) still goes to the engine as a function breakpoint. The
   * response keeps the client's order.
   */
  private onSetFunctionBreakpoints(request: DebugProtocol.Request): void {
    const args = this.argsOf<DebugProtocol.SetFunctionBreakpointsArguments>(request);
    const user = args.breakpoints ?? [];
    this.serve(request, async () => {
      this.state.ensureManifests();
      const table = this.state.breakpoints;
      const affected = new Set(table.clearFunctionBreakpoints());
      type Slot =
        | { kind: 'cobol'; record: FunctionBreakpointRecord }
        | { kind: 'engine'; index: number }
        | { kind: 'failed'; message: string };
      const layout: Slot[] = [];
      const engineNames: DebugProtocol.FunctionBreakpoint[] = [];
      for (const bp of user) {
        const resolved = resolveProcedureName(this.state.registry, bp.name);
        if (resolved.ok) {
          const record = table.addFunctionBreakpoint(bp.name, resolved.path, resolved.line, resolved.description);
          affected.add(normalisePath(resolved.path));
          layout.push({ kind: 'cobol', record });
          this.logger.info(`function breakpoint ${bp.name} -> ${resolved.description} at ${resolved.path}:${resolved.line}`);
        } else if (resolved.reason === 'not-cobol') {
          layout.push({ kind: 'engine', index: engineNames.length });
          engineNames.push(bp);
        } else {
          layout.push({ kind: 'failed', message: resolved.message });
          this.logger.warn(`function breakpoint ${bp.name}: ${resolved.message}`);
        }
      }
      this.state.userFunctionBps = engineNames;
      for (const key of affected) {
        await this.resendFile(key);
      }
      const union = await this.sendEngineFunctionBreakpoints(engineNames);
      const breakpoints: DebugProtocol.Breakpoint[] = layout.map((slot) => {
        switch (slot.kind) {
          case 'cobol': {
            const { record } = slot;
            const bound = `${path.basename(record.path)}:${record.line}`;
            return {
              id: record.id,
              verified: record.verified ?? false,
              message: record.verified ? `${record.description} -> ${bound}` : `${record.description} -> ${bound}: ${record.message ?? 'not bound by the engine'}`,
              line: record.line,
              source: { name: path.basename(record.path), path: record.path }
            };
          }
          case 'engine':
            return union.entries[slot.index] ?? { verified: false, message: union.refused ?? 'no answer from the engine' };
          case 'failed':
            return { verified: false, message: slot.message };
        }
      });
      return okResponse(request, { breakpoints });
    });
  }

  /**
   * The client's line breakpoints for a file, sent as the union with the shim's own lines
   * there (function breakpoints, temporary stops); the client sees only its entries back.
   */
  private onSetBreakpoints(request: DebugProtocol.Request): void {
    const args = this.argsOf<DebugProtocol.SetBreakpointsArguments>(request);
    if (!args.source?.path) {
      this.forward(request);
      return;
    }
    const send = this.state.breakpoints.setUserBreakpoints(args.source, args.breakpoints ?? []);
    this.forward(
      { ...request, arguments: { ...args, breakpoints: send.args.breakpoints } },
      {
        transform: (response) => {
          const body = response.body as DebugProtocol.SetBreakpointsResponse['body'] | undefined;
          if (response.success && body && Array.isArray(body.breakpoints)) {
            body.breakpoints = this.state.breakpoints.recordResponse(send.key, body.breakpoints);
          } else if (!response.success) {
            this.state.breakpoints.recordRefusal(send.key, response.message);
          }
          return response;
        }
      }
    );
  }

  /** Re-send one file's union after the shim's own lines there changed. */
  private async resendFile(key: string): Promise<void> {
    const send = this.state.breakpoints.engineSendFor(key);
    try {
      const response = await this.engine.request('setBreakpoints', send.args);
      const body = response.body as DebugProtocol.SetBreakpointsResponse['body'] | undefined;
      if (response.success && body && Array.isArray(body.breakpoints)) {
        this.state.breakpoints.recordResponse(key, body.breakpoints);
      } else {
        this.state.breakpoints.recordRefusal(key, response.message ?? 'setBreakpoints refused');
        this.logger.warn(`setBreakpoints for ${send.args.source.path ?? key} refused: ${response.message ?? 'no message'}`);
      }
    } catch (error) {
      this.state.breakpoints.recordRefusal(key, errorMessage(error));
      this.logger.warn(`setBreakpoints for ${send.args.source.path ?? key} not answered`, error);
    }
  }

  private onStackTraceResponse(request: DebugProtocol.Request, response: DebugProtocol.Response): DebugProtocol.Response {
    const args = this.argsOf<DebugProtocol.StackTraceArguments>(request);
    const body = response.body as DebugProtocol.StackTraceResponse['body'] | undefined;
    if (response.success && body && Array.isArray(body.stackFrames)) {
      this.state.lastThreadId = args.threadId;
      annotateStackFrames(this.state, body.stackFrames, args.threadId, args.startFrame ?? 0);
    }
    return response;
  }

  /** The cached frame, refetching the stack once when this generation has not seen a `stackTrace` yet. */
  private async ensureFrame(frameId: number): Promise<CachedFrame | undefined> {
    const cached = this.state.frame(frameId);
    if (cached || this.state.lastThreadId === undefined) {
      return cached;
    }
    await this.fetchStack(this.state.lastThreadId, WALK_UP_STACK_LEVELS);
    return this.state.frame(frameId);
  }

  /** Internal `stackTrace`, annotated and cached; the raw frames are returned for callers that need the engine's view. */
  private async fetchStack(threadId: number, levels: number): Promise<DebugProtocol.StackFrame[] | undefined> {
    try {
      const response = await this.engine.request('stackTrace', { threadId, startFrame: 0, levels });
      const body = response.body as DebugProtocol.StackTraceResponse['body'] | undefined;
      if (!response.success || !body || !Array.isArray(body.stackFrames)) {
        return undefined;
      }
      const raw = body.stackFrames.map((frame) => ({ ...frame, source: frame.source ? { ...frame.source } : undefined }));
      annotateStackFrames(this.state, body.stackFrames, threadId, 0);
      if (levels >= WALK_UP_STACK_LEVELS) {
        this.state.deepFetched.add(threadId);
      }
      return raw;
    } catch (error) {
      this.logger.warn('internal stackTrace failed', error);
      return undefined;
    }
  }

  private async onScopes(request: DebugProtocol.Request): Promise<DebugProtocol.Response | { forward: DebugProtocol.Request; transform?: ForwardMeta['transform'] }> {
    const args = this.argsOf<DebugProtocol.ScopesArguments>(request);
    const frame = this.state.registry.programCount > 0 ? await this.ensureFrame(args.frameId) : undefined;
    if (!frame) {
      return { forward: request, transform: (response) => this.checkRefBand(response) };
    }
    // A frame outside COBOL — paused in libcob or C$SLEEP after an attach, in the
    // runtime-error hook, in a C helper — shows the data division of the nearest COBOL
    // program up the stack (the same walk `evaluate` does), under names that say whose
    // it is. Only a stack with no COBOL frame above falls through to the engine.
    const anchor = frame.isCobol && frame.program ? { frame } : await this.anchorFrame(args.frameId);
    const entry = anchor?.frame.program;
    if (!anchor || !entry) {
      return { forward: request, transform: (response) => this.checkRefBand(response) };
    }
    const cobolFrame = anchor.frame;
    // Named by paragraph and distance, not by index: the client's stack view hides
    // internal frames, so an absolute frame number would name a frame it never showed.
    const distance = cobolFrame.index - frame.index;
    const suffix = cobolFrame.id === frame.id
      ? ''
      : ` of ${entry.program.programId} (${cobolFrame.paragraph ?? cobolFrame.section ?? cobolFrame.label}, ${distance} frame${distance === 1 ? '' : 's'} up)`;
    const scopes: DebugProtocol.Scope[] = [];
    for (const section of COBOL_SECTIONS) {
      const roots = this.state.registry.rootsOf(entry, section);
      if (roots.length === 0 && section !== 'WORKING-STORAGE') {
        continue;
      }
      scopes.push({
        name: `${section}${suffix}`,
        // Addresses are evaluated in the COBOL frame: its compilation unit owns the statics.
        variablesReference: this.state.allocRef({ kind: 'section', frameId: cobolFrame.id, program: entry, section }),
        namedVariables: roots.length,
        expensive: false
      });
    }
    if (this.state.options.engineScopes) {
      try {
        const response = this.checkRefBand(await this.engine.request('scopes', args));
        const body = response.body as DebugProtocol.ScopesResponse['body'] | undefined;
        if (response.success && body && Array.isArray(body.scopes)) {
          scopes.push(...body.scopes);
        }
      } catch (error) {
        this.logger.warn('engine scopes unavailable', error);
      }
    }
    return okResponse(request, { scopes });
  }

  private onVariables(request: DebugProtocol.Request): void {
    const args = this.argsOf<DebugProtocol.VariablesArguments>(request);
    if (!this.state.isShimRef(args.variablesReference)) {
      this.forward(request, { transform: (response) => this.checkRefBand(response) });
      return;
    }
    this.serve(request, async () => {
      const lookup = this.state.lookupRef(args.variablesReference);
      if (!lookup.ok) {
        return errorResponse(request, 'Variables reference is stale (program has resumed)');
      }
      const variables = await this.variables.listRef(lookup.ref, args);
      return okResponse(request, { variables });
    });
  }

  private onEvaluate(request: DebugProtocol.Request): void {
    const args = this.argsOf<DebugProtocol.EvaluateArguments>(request);
    const expression = (args.expression ?? '').trim();
    if (NATIVE_EVALUATE_PREFIX.test(expression)) {
      this.forward(request, { transform: (response) => this.checkRefBand(response) });
      return;
    }
    this.serve(request, async () => {
      const anchor = await this.anchorFrame(args.frameId);
      const outcome = anchor
        ? await this.evaluator.evaluate(expression, anchor.frame)
        : ({ kind: 'forward', reason: `'${expression}' has no COBOL frame to resolve against` } as const);
      switch (outcome.kind) {
        case 'response':
          if (anchor?.note) {
            outcome.body.result += anchor.note;
          }
          return okResponse(request, outcome.body);
        case 'error':
          return errorResponse(request, outcome.message);
        case 'forward':
          return {
            forward: request,
            transform: (response: DebugProtocol.Response) => {
              if (response.success) {
                return this.checkRefBand(response);
              }
              return errorResponse(
                request,
                `${outcome.reason} and native evaluation failed: ${response.message ?? 'unknown engine error'}. Use /nat for C expressions.`
              );
            }
          };
      }
    });
  }

  /**
   * The COBOL frame an expression is resolved in: the requested frame itself, or — when the
   * stop is inside libcob or generated C — the nearest COBOL frame up the cached stack, in
   * which case the result says so.
   */
  private async anchorFrame(frameId: number | undefined): Promise<{ frame: CachedFrame; note: string } | undefined> {
    if (this.state.registry.programCount === 0) {
      // No manifest: no frame can be COBOL, so there is nothing to walk up to.
      return undefined;
    }
    let frame: CachedFrame | undefined;
    if (frameId !== undefined) {
      frame = await this.ensureFrame(frameId);
      if (!frame) {
        return undefined;
      }
      if (frame.isCobol) {
        return { frame, note: '' };
      }
    } else if (this.state.lastThreadId === undefined) {
      return undefined;
    } else if (this.state.framesOfThread(this.state.lastThreadId).length === 0) {
      await this.fetchStack(this.state.lastThreadId, WALK_UP_STACK_LEVELS);
    }
    const threadId = frame?.threadId ?? this.state.lastThreadId;
    if (threadId === undefined) {
      return undefined;
    }
    const startIndex = frame ? frame.index + 1 : 0;
    const nearestCobol = (): CachedFrame | undefined =>
      this.state.framesOfThread(threadId).find((f) => f.index >= startIndex && f.isCobol);
    let nearest = nearestCobol();
    if (!nearest && !this.state.deepFetched.has(threadId)) {
      // The client may have fetched only the top of the stack (get_local_variables asks for
      // one frame): the COBOL frame it is inside of is further down. Fetch deeper once per
      // thread and generation; a stack that has none stays known to have none.
      await this.fetchStack(threadId, WALK_UP_STACK_LEVELS);
      nearest = nearestCobol();
    }
    if (!nearest) {
      return undefined;
    }
    // Named like the walk-up scopes: by label and distance, not by an engine frame index the
    // client's filtered stack view never showed.
    const distance = nearest.index - (frame?.index ?? 0);
    return { frame: nearest, note: ` (evaluated in ${nearest.label}, ${distance} frame${distance === 1 ? '' : 's'} up)` };
  }

  private onExceptionInfo(request: DebugProtocol.Request): void {
    const last = this.state.lastRuntimeError;
    if (!last || last.gen !== this.state.generation) {
      this.forward(request);
      return;
    }
    const message = last.text ?? 'COBOL runtime error';
    this.client.send(
      okResponse(request, {
        exceptionId: COBOL_RUNTIME_ERROR_FILTER,
        description: message,
        breakMode: 'always',
        details: { message }
      })
    );
  }

  private onDataOperation(request: DebugProtocol.Request): void {
    const args = this.argsOf<{ variablesReference?: number; name?: string; expression?: string }>(request);
    const touchesShimRef = args.variablesReference !== undefined && this.state.isShimRef(args.variablesReference);
    const text = args.expression ?? (args.variablesReference === undefined ? args.name : undefined);
    const namesCobol = text !== undefined && parseCobolExpression(text) !== undefined;
    if (touchesShimRef || namesCobol) {
      this.client.send(errorResponse(request, 'Not supported for COBOL data items yet'));
      return;
    }
    this.forward(request);
  }

  /** Engine refs must stay below the shim band; one inside it would be misrouted to the manifest. */
  private checkRefBand(response: DebugProtocol.Response): DebugProtocol.Response {
    const body = response.body as
      | { variables?: Array<{ variablesReference?: number }>; scopes?: Array<{ variablesReference?: number }>; variablesReference?: number }
      | undefined;
    if (!response.success || !body) {
      return response;
    }
    const refs: number[] = [];
    for (const list of [body.variables, body.scopes]) {
      for (const entry of list ?? []) {
        if (typeof entry.variablesReference === 'number') {
          refs.push(entry.variablesReference);
        }
      }
    }
    if (typeof body.variablesReference === 'number') {
      refs.push(body.variablesReference);
    }
    const collision = refs.find((ref) => this.state.isShimRef(ref));
    if (collision !== undefined) {
      const message = `REF_BAND_COLLISION: engine variablesReference ${collision} (${response.command}) is inside the shim band`;
      this.logger.error(message);
      if (this.state.options.refCheck === 'strict') {
        this.hooks.onFatal(message);
      }
    }
    return response;
  }

  // ---------------------------------------------------------------- stepping

  /**
   * One client step = one engine step plus as many engine `next`s as it takes to land on a
   * COBOL statement: a raw `next` stops on every generated-C line between two statements,
   * and `stepIn` walks the callee's entry wrapper and its DATA DIVISION initialisation before
   * the first PROCEDURE DIVISION line. The client sees one response and one final `stopped`.
   */
  private onStep(request: DebugProtocol.Request): void {
    const args = this.argsOf<DebugProtocol.NextArguments>(request);
    if (this.stepLoop) {
      this.logger.warn(`${request.command} while a step loop is active; forwarding without a loop`);
      this.resumeAfterDroppingTemporaryStops(request);
      return;
    }
    const loop: StepLoop = { threadId: args.threadId, command: request.command, queued: [] };
    this.stepLoop = loop;
    void this.startStepLoop(loop, request);
  }

  private async startStepLoop(loop: StepLoop, request: DebugProtocol.Request): Promise<void> {
    const origin = (await this.fetchStack(loop.threadId, 1))?.[0];
    if (origin) {
      loop.origin = { path: origin.source?.path, line: origin.line, name: origin.name };
    }
    let plan: PerformPlan | undefined;
    if (origin) {
      try {
        plan = await this.planPerformStep(loop, origin.id);
      } catch (error) {
        this.logger.warn('PERFORM-aware step planning failed; stepping statement by statement', error);
        await this.disarmTemporaryStops();
      }
    }
    if (plan) {
      loop.plan = plan;
      // The client asked for a step; the engine gets a `continue` towards the plan's stops, and
      // the client's response is the shim's (a `next` answered with a `continue` response
      // would be a protocol error).
      const responded = new Promise<DebugProtocol.Response>((resolve) => {
        this.serve(request, async () => {
          let response: DebugProtocol.Response;
          try {
            response = await this.engine.request('continue', { threadId: loop.threadId });
          } catch (error) {
            response = errorResponse(request, errorMessage(error));
          }
          resolve(response);
          return response.success ? okResponse(request, {}) : errorResponse(request, response.message ?? 'continue refused');
        });
      });
      await this.runStepLoop(loop, responded);
      return;
    }
    const responded = new Promise<DebugProtocol.Response>((resolve) => {
      this.forward(request, {
        transform: (response) => {
          resolve(response);
          return response;
        }
      });
    });
    await this.runStepLoop(loop, responded);
  }

  /**
   * Whether this step is PERFORM-aware, and its temporary stops armed if so. `next` on a
   * PERFORM statement and `stepOut` inside a performed range qualify; `stepIn` on a PERFORM
   * enters the paragraph (the statement walk does that), and a frame without libcob's
   * `frame_ptr` (no DWARF, not a cobc frame) or without a manifest statement list falls
   * back to the statement walk.
   */
  private async planPerformStep(loop: StepLoop, frameId: number): Promise<PerformPlan | undefined> {
    if (loop.command === 'stepIn') {
      return undefined;
    }
    const origin = this.state.frame(frameId);
    const entry = origin?.program;
    if (!origin || !origin.isCobol || !entry || origin.sourcePath === undefined || origin.line === undefined) {
      return undefined;
    }
    const fileId = this.state.registry.sourceIdByPath(entry, origin.sourcePath);
    if (fileId === undefined || entry.program.procedure.statements.length === 0) {
      return undefined;
    }
    if (loop.command === 'next' && statementAt(entry, fileId, origin.line)?.verb !== 'PERFORM') {
      return undefined;
    }
    const depth = await readPerformDepth(this.engine, origin.id);
    if (depth === undefined || (loop.command === 'stepOut' && depth === 0)) {
      return undefined;
    }
    const plan: PerformPlan = { kind: loop.command === 'next' ? 'over' : 'out', depth, origin, ownIds: new Set(), returning: false, finished: false };
    // (a) The statement the step should end on: after this PERFORM, or after the one that
    // performed the range `stepOut` leaves.
    let after: { fileId: number; line: number } | undefined;
    if (plan.kind === 'over') {
      const next = nextStatementAfter(entry, fileId, origin.line);
      after = next ? { fileId: next.sourceFileId, line: next.line } : undefined;
    } else {
      after = await this.statementAfterPerformer(entry, origin.id, depth);
    }
    // (b) The current range's own return: a PERFORM that is its last statement, or the
    // range `stepOut` leaves, ends there.
    const returnAddress = depth > 0 ? await readReturnAddress(this.engine, origin.id, depth) : undefined;
    if (!after && returnAddress === undefined) {
      return undefined;
    }
    if (after) {
      const source = this.state.registry.sourceById(entry, after.fileId);
      if (source) {
        const key = this.state.breakpoints.addTemp(source.path, after.line);
        await this.resendFile(key);
        const id = this.state.breakpoints.engineIdOf(source.path, after.line);
        if (id !== undefined) {
          plan.ownIds.add(id);
        }
      }
    }
    if (returnAddress !== undefined) {
      const id = await this.armInstructionBreakpoint(returnAddress);
      if (id !== undefined) {
        plan.instructionId = id;
        plan.ownIds.add(id);
      }
    }
    if (plan.ownIds.size === 0) {
      await this.disarmTemporaryStops();
      return undefined;
    }
    this.logger.info(
      `${loop.command} at ${origin.label} ${path.basename(origin.sourcePath)}:${origin.line} (PERFORM depth ${depth}): ` +
        `running to ${after ? `line ${after.line}` : 'no statement'}${returnAddress !== undefined ? ` or the range's return ${hexAddress(returnAddress)}` : ''}`
    );
    return plan;
  }

  /** The statement after the PERFORM that entered the range at stack entry `depth`, via its return address and the engine's line table. */
  private async statementAfterPerformer(entry: ProgramEntry, frameId: number, depth: number): Promise<{ fileId: number; line: number } | undefined> {
    const address = await readReturnAddress(this.engine, frameId, depth);
    if (address === undefined) {
      return undefined;
    }
    const location = await resolveAddressLocation(this.engine, frameId, address);
    if (!location) {
      return undefined;
    }
    let cobol: { fileId: number; line: number } | undefined;
    const direct = this.state.registry.sourceIdByPath(entry, location.path);
    if (direct !== undefined) {
      cobol = { fileId: direct, line: location.line };
    } else if (this.state.registry.isGeneratedSource(entry, location.path)) {
      const mapped = this.state.registry.mapGeneratedLine(entry, location.line);
      if (mapped) {
        cobol = { fileId: mapped.source.id, line: mapped.line };
      }
    }
    if (!cobol) {
      return undefined;
    }
    const next = nextStatementAfter(entry, cobol.fileId, cobol.line);
    return next ? { fileId: next.sourceFileId, line: next.line } : undefined;
  }

  private instructionBreakpointArmed = false;

  private async armInstructionBreakpoint(address: bigint): Promise<number | undefined> {
    const response = await this.engine.request('setInstructionBreakpoints', { breakpoints: [{ instructionReference: hexAddress(address) }] });
    const body = response.body as DebugProtocol.SetInstructionBreakpointsResponse['body'] | undefined;
    const bp = response.success ? body?.breakpoints?.[0] : undefined;
    this.instructionBreakpointArmed = response.success;
    if (!bp || bp.verified === false || typeof bp.id !== 'number') {
      this.logger.warn(`instruction breakpoint at ${hexAddress(address)} not bound: ${bp?.message ?? response.message ?? 'no answer'}`);
      return undefined;
    }
    return bp.id;
  }

  /** Drop every temporary stop a PERFORM-aware step armed; safe to call when none is. */
  private async disarmTemporaryStops(): Promise<void> {
    for (const key of this.state.breakpoints.clearTemps()) {
      await this.resendFile(key);
    }
    if (this.instructionBreakpointArmed) {
      this.instructionBreakpointArmed = false;
      try {
        await this.engine.request('setInstructionBreakpoints', { breakpoints: [] });
      } catch (error) {
        this.logger.warn('instruction breakpoints not cleared', error);
      }
    }
  }

  /** A client resume/step while a PERFORM-aware step is in flight: its stops are dropped before the request goes out. */
  private resumeAfterDroppingTemporaryStops(request: DebugProtocol.Request): void {
    if (!this.stepLoop?.plan && !this.state.breakpoints.hasTemps() && !this.instructionBreakpointArmed) {
      this.forward(request);
      return;
    }
    this.logger.info(`${request.command} during a PERFORM-aware step: its temporary stops are dropped`);
    this.abortStepLoop();
    this.serve(request, async () => {
      await this.disarmTemporaryStops();
      return { forward: request };
    });
  }

  /** The plan reached its statement: temps dropped, the stop reported as the step's. */
  private async finishPlan(loop: StepLoop, body: StoppedBody, landing: DebugProtocol.StackFrame | undefined): Promise<void> {
    const plan = loop.plan;
    if (!plan) {
      return;
    }
    plan.finished = true;
    await this.disarmTemporaryStops();
    const origin = plan.origin;
    const performer = origin.paragraph ?? origin.section ?? origin.program?.program.programId ?? origin.label;
    const landed = landing ? this.state.frame(landing.id) : undefined;
    const where = landed?.paragraph ?? landed?.section ?? landed?.label ?? 'the performer';
    body.reason = 'step';
    delete body.hitBreakpointIds;
    body.description = plan.kind === 'over'
      ? `stepped over the PERFORM at ${origin.sourcePath ? path.basename(origin.sourcePath) : '?'}:${origin.line ?? '?'}`
      : `returned from ${performer} to ${where}`;
  }

  private swallowContinued = 0;

  /**
   * Logpoints (M3): a stop on lines the client asked only to log at emits the interpolated
   * messages as `output` events and resumes the program; the client never sees the stop.
   * Mixed hits (a pausing breakpoint on the same stop) log and pause. Returns true when
   * the stop was consumed.
   */
  private async logAndResume(body: StoppedBody): Promise<boolean> {
    const hits = body.hitBreakpointIds ?? [];
    if (hits.length === 0 || body.threadId === undefined || this.state.breakpoints.logMessagesOf(hits).length === 0) {
      return false;
    }
    await this.emitLogpoints(body.threadId, hits);
    if (!this.state.breakpoints.isLogpointOnlyHit(hits)) {
      return false;
    }
    let response: DebugProtocol.Response;
    try {
      this.swallowContinued += 1;
      response = await this.engine.request('continue', { threadId: body.threadId });
    } catch (error) {
      this.swallowContinued -= 1;
      this.logger.warn('resume after a logpoint failed; the stop is shown', error);
      return false;
    }
    if (!response.success) {
      this.swallowContinued -= 1;
      this.logger.warn(`resume after a logpoint refused (${response.message ?? 'no message'}); the stop is shown`);
      return false;
    }
    return true;
  }

  /** Emit every logpoint message the hit ids carry, `{…}` interpolated in the COBOL frame of the stop. */
  private async emitLogpoints(threadId: number, hits: readonly number[]): Promise<void> {
    const messages = this.state.breakpoints.logMessagesOf(hits);
    if (messages.length === 0) {
      return;
    }
    const top = (await this.fetchStack(threadId, 1))?.[0];
    for (const message of messages) {
      const text = await this.interpolateLogMessage(message, top);
      this.client.send({ seq: 0, type: 'event', event: 'output', body: { category: 'console', output: `${text}\n` } } as DebugProtocol.OutputEvent);
      this.logger.info(`logpoint: ${text}`);
    }
  }

  private async interpolateLogMessage(message: string, top: DebugProtocol.StackFrame | undefined): Promise<string> {
    const parts = message.split(/(\{[^{}]*\})/);
    let out = '';
    for (const part of parts) {
      if (!(part.startsWith('{') && part.endsWith('}') && part.length > 2)) {
        out += part;
        continue;
      }
      const expression = part.slice(1, -1).trim();
      out += await this.evaluateForLog(expression, top);
    }
    return out;
  }

  private async evaluateForLog(expression: string, top: DebugProtocol.StackFrame | undefined): Promise<string> {
    const native = async (text: string): Promise<string> => {
      try {
        const response = await this.engine.request('evaluate', { expression: text, frameId: top?.id, context: 'watch' });
        const result = (response.body as { result?: string } | undefined)?.result;
        return response.success && result !== undefined ? result : `<unavailable: ${response.message ?? 'no result'}>`;
      } catch (error) {
        return `<unavailable: ${errorMessage(error)}>`;
      }
    };
    if (NATIVE_EVALUATE_PREFIX.test(expression)) {
      return native(expression);
    }
    const anchor = top ? await this.anchorFrame(top.id) : undefined;
    if (!anchor) {
      return native(expression);
    }
    const outcome = await this.evaluator.evaluate(expression, anchor.frame);
    switch (outcome.kind) {
      case 'response':
        return outcome.body.result;
      case 'error':
        return `<${outcome.message}>`;
      case 'forward': {
        // Not a COBOL data reference: the engine may know it as C. When it does not either,
        // the COBOL reason is the useful one (`WS-NOPE is not a data item of program HELLO`).
        const result = await native(expression);
        return result.startsWith('<unavailable:') ? `<unavailable: ${outcome.reason}>` : result;
      }
    }
  }

  /** A stop as the client sees it: hit ids it knows, plus the function breakpoints on those lines. */
  private presentHits(body: StoppedBody): void {
    if (body.hitBreakpointIds && body.hitBreakpointIds.length > 0) {
      const translated = this.state.breakpoints.translateHitIds(body.hitBreakpointIds);
      if (translated.length > 0) {
        body.hitBreakpointIds = translated;
      } else {
        delete body.hitBreakpointIds;
      }
    }
  }

  private async safeDepth(frameId: number): Promise<number | undefined> {
    try {
      return await readPerformDepth(this.engine, frameId);
    } catch (error) {
      this.logger.warn('PERFORM depth unavailable', error);
      return undefined;
    }
  }

  /**
   * Whether an intermediate stop completes the step. A COBOL statement does, unless it is
   * the statement the step started on: a paragraph header line carries two `#line` blocks
   * (Entry, then Paragraph) separated by generated code, so the first `next` from it would
   * otherwise "complete" on the same line. With manifests loaded, a stop in the generated
   * C `main` with no COBOL program frame above it (`step_out` of the outermost program)
   * has nothing left to reach and is forwarded as it is.
   */
  private stepLanded(loop: StepLoop, top: DebugProtocol.StackFrame, frames: DebugProtocol.StackFrame[]): boolean {
    if (isLandedCobolFrame(this.state, top)) {
      const origin = loop.origin;
      // A PERFORM-aware step walks from the range's return, in generated C: the first COBOL
      // statement it reaches is a landing even when it is the line the step started on (a
      // PERFORM … TIMES re-entering the paragraph at its first statement).
      const sameStatement =
        loop.plan === undefined &&
        origin !== undefined &&
        top.line === origin.line &&
        top.name === origin.name &&
        (top.source?.path ?? '') === (origin.path ?? '');
      return !sameStatement;
    }
    // `step_out` of the outermost program lands in the generated C `main`, which no step
    // can turn into a COBOL statement: forward that stop instead of stepping to exit.
    return this.state.registry.programCount > 0 && top.name === 'main' && !frames.some((frame) => isCobolProgramFrame(this.state, frame));
  }

  private nextStepSignal(loop: StepLoop): Promise<StepSignal> {
    const queued = loop.queued.shift();
    if (queued) {
      return Promise.resolve(queued);
    }
    return new Promise((resolve) => {
      loop.waiter = resolve;
    });
  }

  private deliverStepSignal(signal: StepSignal): void {
    const loop = this.stepLoop;
    if (!loop) {
      return;
    }
    if (signal.kind === 'aborted') {
      loop.abort?.();
    }
    const waiter = loop.waiter;
    if (waiter) {
      loop.waiter = undefined;
      waiter(signal);
    } else {
      loop.queued.push(signal);
    }
  }

  private abortStepLoop(): void {
    if (this.stepLoop) {
      this.deliverStepSignal({ kind: 'aborted' });
    }
  }

  private async runStepLoop(loop: StepLoop, responded: Promise<DebugProtocol.Response>): Promise<void> {
    const surface = async (event: DebugProtocol.Event, slot: OutputSlot, body: StoppedBody): Promise<void> => {
      if (loop.plan && !loop.plan.finished) {
        await this.disarmTemporaryStops();
      }
      this.presentHits(body);
      slot.resolve(event);
    };
    try {
      const aborted = new Promise<undefined>((resolve) => {
        loop.abort = () => resolve(undefined);
      });
      const response = await Promise.race([responded, aborted]);
      if (!response || !response.success) {
        return;
      }
      for (let iteration = 0; iteration < MAX_STEP_ITERATIONS; iteration++) {
        const signal = await this.nextStepSignal(loop);
        if (signal.kind !== 'stopped') {
          return;
        }
        const { event, slot } = signal;
        const body = event.body as StoppedBody;
        const hits = body.hitBreakpointIds ?? [];
        const plan = loop.plan;
        if (hits.length > 0 && this.state.breakpoints.isLogpointOnlyHit(hits) && (body.threadId === undefined || body.threadId === loop.threadId)) {
          // A logpoint on the way: log it and keep stepping (a plan keeps running).
          await this.emitLogpoints(loop.threadId, hits);
          const resume = plan && !plan.returning ? 'continue' : loop.command === 'stepIn' ? 'stepIn' : 'next';
          let resumed: DebugProtocol.Response;
          try {
            resumed = await this.engine.request(resume, { threadId: loop.threadId });
          } catch (error) {
            body.description = `step loop stopped early: ${errorMessage(error)}`;
            await surface(event, slot, body);
            return;
          }
          if (!resumed.success) {
            body.description = `step loop stopped early: ${resumed.message ?? `${resume} refused`}`;
            await surface(event, slot, body);
            return;
          }
          slot.resolve(null);
          continue;
        }
        const ownStop =
          plan !== undefined &&
          hits.length > 0 &&
          (body.threadId === undefined || body.threadId === loop.threadId) &&
          hits.every((id) => id === plan.instructionId || this.state.breakpoints.isTempOnlyHit([id]));
        let continuation: 'next' | 'stepIn' | 'continue' = loop.command === 'stepIn' ? 'stepIn' : 'next';
        if (ownStop && plan) {
          const raw = await this.fetchStack(loop.threadId, 4);
          const top = raw?.[0];
          if (plan.instructionId !== undefined && hits.includes(plan.instructionId)) {
            // The range returned: walk to the next COBOL statement from here.
            plan.returning = true;
          } else {
            const depthNow = top ? await this.safeDepth(top.id) : undefined;
            if (depthNow !== undefined && depthNow > plan.depth) {
              // The armed statement was reached deeper in the PERFORM stack (the range
              // performs the paragraph it sits in): not this step's landing.
              continuation = 'continue';
            } else {
              await this.finishPlan(loop, body, top);
              slot.resolve(event);
              return;
            }
          }
        } else {
          const foreign =
            body.reason !== 'step' ||
            hits.length > 0 ||
            (body.threadId !== undefined && body.threadId !== loop.threadId);
          if (foreign) {
            await surface(event, slot, body);
            return;
          }
          const raw = await this.fetchStack(loop.threadId, 4);
          const top = raw?.[0];
          if (!top || this.stepLanded(loop, top, raw)) {
            if (plan?.kind === 'out' && plan.returning && top) {
              const depthNow = await this.safeDepth(top.id);
              if (depthNow !== undefined && depthNow >= plan.depth) {
                // A PERFORM … TIMES / UNTIL re-entered the range: on to the armed statement.
                plan.returning = false;
                continuation = 'continue';
              }
            }
            if (continuation !== 'continue') {
              if (plan) {
                await this.finishPlan(loop, body, top);
              }
              await surface(event, slot, body);
              return;
            }
          }
        }
        if (iteration === MAX_STEP_ITERATIONS - 1) {
          body.description = plan ? PERFORM_BOUND_DESCRIPTION : STEP_BOUND_DESCRIPTION;
          if (plan) {
            plan.finished = true;
            await this.disarmTemporaryStops();
          }
          await surface(event, slot, body);
          return;
        }
        // `stepIn` must keep stepping in, or the CALL it started on is stepped over; LLDB
        // skips libcob (no debug info) by itself. `stepOut` continues with `next`.
        if (plan?.returning) {
          continuation = 'next';
        }
        let next: DebugProtocol.Response;
        try {
          next = await this.engine.request(continuation, { threadId: loop.threadId });
        } catch (error) {
          body.description = `step loop stopped early: ${errorMessage(error)}`;
          await surface(event, slot, body);
          return;
        }
        if (!next.success) {
          body.description = `step loop stopped early: ${next.message ?? `${continuation} refused`}`;
          await surface(event, slot, body);
          return;
        }
        slot.resolve(null);
      }
    } finally {
      // Anything still queued belongs to the client: a stop the loop did not get to judge.
      for (const signal of loop.queued) {
        if (signal.kind === 'stopped') {
          this.presentHits((signal.event.body ?? {}) as StoppedBody);
          signal.slot.resolve(signal.event);
        }
      }
      loop.queued.length = 0;
      this.stepLoop = undefined;
      if (loop.plan && !loop.plan.finished) {
        void this.disarmTemporaryStops();
      }
    }
  }

  // ---------------------------------------------------------------- events

  private onEngineEvent(event: DebugProtocol.Event, slot: OutputSlot): void {
    switch (event.event) {
      case 'stopped':
        void this.onStopped(event, slot);
        return;
      case 'continued':
        this.state.bumpGeneration('continued');
        this.state.pausePending = false;
        if (this.swallowContinued > 0) {
          this.swallowContinued -= 1;
          slot.resolve(null);
          return;
        }
        slot.resolve(this.stepLoop ? null : event);
        return;
      case 'breakpoint': {
        // A line the client asked for passes; a function breakpoint's line is mirrored under
        // its shim id; a line only a temporary stop asked for is the shim's business.
        const bodies = this.state.breakpoints.translateBreakpointEvent((event.body ?? {}) as DebugProtocol.BreakpointEvent['body']);
        const mirrored: DebugProtocol.Event[] = bodies.map((body) => ({ ...event, body }));
        slot.resolve(mirrored.length > 0 ? mirrored[0] : null);
        for (const extra of mirrored.slice(1)) {
          this.client.send(extra);
        }
        return;
      }
      case 'terminated':
      case 'exited':
        this.abortStepLoop();
        slot.resolve(event);
        return;
      default:
        slot.resolve(event);
    }
  }

  private async onStopped(event: DebugProtocol.Event, slot: OutputSlot): Promise<void> {
    this.state.bumpGeneration('stopped');
    const body = (event.body ?? {}) as StoppedBody;
    if (body.threadId !== undefined) {
      this.state.lastThreadId = body.threadId;
    }
    const context: StopContext = {
      attachHandshake: this.state.mode === 'attach' && this.state.attachStopExpected && this.state.stopsSeen === 0,
      pausePending: this.state.pausePending
    };
    this.state.stopsSeen += 1;
    this.state.pausePending = false;
    try {
      await this.relabelRuntimeError(body);
    } catch (error) {
      this.logger.warn('runtime-error relabel failed', error);
    }
    if (this.stepLoop) {
      this.deliverStepSignal({ kind: 'stopped', event, slot });
      return;
    }
    if (await this.logAndResume(body)) {
      slot.resolve(null);
      return;
    }
    this.presentHits(body);
    try {
      await this.retargetToCobolThread(body, context);
    } catch (error) {
      this.logger.warn('stop retarget failed', error);
    }
    slot.resolve(event);
  }

  /**
   * A stop the program did not cause on the reported thread — on Windows an attach is
   * reported on the break thread the OS injects (exception 0x80000003), a pause can land on
   * a runtime worker thread — is re-anchored on the first thread that is inside a COBOL
   * program, so the first stackTrace/scopes/evaluate a client asks for show the program
   * rather than a thread-pool stack. Breakpoint, step, entry and runtime-error stops are
   * on the right thread by construction and are left alone, as is any real fault. The
   * original thread and reason stay in the description.
   */
  private async retargetToCobolThread(body: StoppedBody, context: StopContext): Promise<void> {
    if (body.threadId === undefined || this.state.registry.programCount === 0 || !isProgramNeutralStop(body, context)) {
      return;
    }
    if (this.state.lastRuntimeError?.gen === this.state.generation) {
      return;
    }
    // The stop event's slot is held while this runs, so the walk is bounded: one stack
    // for the reported thread, then the other threads' stacks in parallel (at most
    // RETARGET_MAX_THREADS), and a stop or continue landing meanwhile abandons it — the
    // frames it would decide on are the previous generation's.
    const generation = this.state.generation;
    const hasCobolFrame = (threadId: number): boolean => this.state.framesOfThread(threadId).some((f) => f.isCobol);
    await this.fetchStack(body.threadId, WALK_UP_STACK_LEVELS);
    if (this.state.generation !== generation || hasCobolFrame(body.threadId)) {
      return;
    }
    const response = await this.engine.request('threads', {});
    if (this.state.generation !== generation) {
      return;
    }
    const others = ((response.body as DebugProtocol.ThreadsResponse['body'] | undefined)?.threads ?? [])
      .filter((thread) => thread.id !== body.threadId)
      .slice(0, RETARGET_MAX_THREADS);
    await Promise.all(others.map((thread) => this.fetchStack(thread.id, WALK_UP_STACK_LEVELS)));
    if (this.state.generation !== generation) {
      return;
    }
    const target = others.find((thread) => hasCobolFrame(thread.id));
    if (!target) {
      return;
    }
    const reported = body.threadId;
    this.logger.info(`stop (${body.reason}) reported on thread ${reported}, which has no COBOL frame; shown on thread ${target.id}`);
    // A debugger-initiated stop, shown where the program is: `pause`, so no client asks
    // for exceptionInfo about a thread that has no exception.
    const original = body.description ?? body.reason ?? 'stopped';
    body.reason = 'pause';
    body.description = `${context.attachHandshake ? 'Attached' : 'Paused'} (reported on thread ${reported} as "${original}"; shown on thread ${target.id}, inside the COBOL program)`;
    body.threadId = target.id;
    this.state.lastThreadId = target.id;
  }

  /**
   * A stop on the injected `cob_runtime_error` breakpoint is reported as an exception with
   * libcob's format string as its text, read from the first-argument register in frame 0.
   * When the breakpoint id is unknown (the engine answered without one), the frame name
   * decides.
   */
  private async relabelRuntimeError(body: StoppedBody): Promise<void> {
    if (!this.state.runtimeErrorArmed) {
      return;
    }
    const hitIds = body.hitBreakpointIds ?? [];
    const ownId = this.state.runtimeErrorBpId;
    const byId = ownId !== undefined && hitIds.includes(ownId);
    const maybe = !byId && ownId === undefined && /breakpoint/i.test(body.reason ?? '');
    if (!byId && !maybe) {
      return;
    }
    const threadId = body.threadId ?? this.state.lastThreadId;
    let top: DebugProtocol.StackFrame | undefined;
    if (threadId !== undefined) {
      top = (await this.fetchStack(threadId, 1))?.[0];
    }
    if (!byId && top?.name !== RUNTIME_ERROR_FUNCTION) {
      return;
    }
    let text: string | undefined;
    if (top) {
      text = await this.readFormatString(top.id);
    }
    body.reason = 'exception';
    body.description = 'COBOL runtime error';
    if (text) {
      body.text = text;
    }
    if (ownId !== undefined) {
      const remaining = hitIds.filter((id) => id !== ownId);
      if (remaining.length > 0) {
        body.hitBreakpointIds = remaining;
      } else {
        delete body.hitBreakpointIds;
      }
    }
    this.state.lastRuntimeError = { gen: this.state.generation, threadId, text };
    this.logger.info(`runtime error stop: ${text ?? '(format string unavailable)'}`);
  }

  private async readFormatString(frameId: number): Promise<string | undefined> {
    const expression = `/nat (const char*)${formatStringRegister(this.env)}`;
    try {
      const response = await this.engine.request('evaluate', { expression, frameId, context: 'variables' });
      const result = (response.body as { result?: string } | undefined)?.result;
      if (!response.success || !result) {
        return undefined;
      }
      const quoted = /"((?:[^"\\]|\\.)*)"/.exec(result);
      return quoted ? quoted[1] : result;
    } catch (error) {
      this.logger.debug('format string read failed', error);
      return undefined;
    }
  }
}
