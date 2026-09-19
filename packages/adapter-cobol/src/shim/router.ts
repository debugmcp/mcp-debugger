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
import { MemoryReader } from './memory-reader.js';
import { errorMessage, errorResponse, okResponse } from './protocol.js';
import type { CachedFrame, SessionState } from './session-state.js';

export const COBOL_RUNTIME_ERROR_FILTER = 'cobol_runtime_error';
export const RUNTIME_ERROR_FUNCTION = 'cob_runtime_error';
export const MAX_STEP_ITERATIONS = 400;
export const STEP_BOUND_DESCRIPTION = `stepped ${MAX_STEP_ITERATIONS} generated lines without reaching a COBOL statement`;

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

/** Stop descriptions that are the debugger's doing, not the program's: a pause, an entry stop, the break an attach injects. */
const NEUTRAL_STOP_DESCRIPTION = /0x80000003|breakpoint|SIGSTOP|SIGTRAP|SIGINT|EXC_BREAKPOINT/i;

/** True for a stop the program did not cause on its reported thread (see retargetToCobolThread). */
function isProgramNeutralStop(body: StoppedBody): boolean {
  if ((body.hitBreakpointIds ?? []).length > 0) {
    return false;
  }
  switch (body.reason) {
    case 'pause':
    case 'entry':
      return true;
    case 'exception':
      return NEUTRAL_STOP_DESCRIPTION.test(`${body.description ?? ''} ${body.text ?? ''}`);
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
    body.supportsFunctionBreakpoints = false;
    body.supportsLogPoints = false;
    body.supportsSetVariable = false;
    response.body = body;
    return response;
  }

  private onLaunchOrAttach(request: DebugProtocol.Request): void {
    this.state.mode = request.command === 'attach' ? 'attach' : 'launch';
    const args = request.arguments as Record<string, unknown> | undefined;
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

  /** Re-send the user's function breakpoints plus the runtime-error hook; a refusal (noDebug) is logged, never surfaced. */
  private async sendFunctionBreakpointUnion(): Promise<{ verified: boolean; message?: string }> {
    const breakpoints: DebugProtocol.FunctionBreakpoint[] = [...this.state.userFunctionBps];
    if (this.state.runtimeErrorArmed) {
      breakpoints.push({ name: RUNTIME_ERROR_FUNCTION });
    }
    let response: DebugProtocol.Response;
    try {
      response = await this.engine.request('setFunctionBreakpoints', { breakpoints });
    } catch (error) {
      this.logger.warn('function breakpoint union not answered', error);
      return { verified: false, message: errorMessage(error) };
    }
    if (!response.success) {
      this.logger.warn(`function breakpoint union refused by the engine: ${response.message ?? 'no message'}`);
      this.state.runtimeErrorBpId = undefined;
      return { verified: false, message: response.message };
    }
    // A real engine answers with one entry per breakpoint; a body without them (measured under noDebug
    // refusals, possible from any engine) must not throw its way out of the client's response.
    const body = response.body as Partial<DebugProtocol.SetFunctionBreakpointsResponse['body']> | undefined;
    const ours = this.state.runtimeErrorArmed ? body?.breakpoints?.[breakpoints.length - 1] : undefined;
    this.state.runtimeErrorBpId = ours?.id;
    this.logger.info(`runtime-error hook ${this.state.runtimeErrorArmed ? `armed (id ${ours?.id ?? 'unknown'}, verified ${ours?.verified ?? false})` : 'disarmed'}`);
    return { verified: ours?.verified ?? false, message: ours?.message };
  }

  private onSetFunctionBreakpoints(request: DebugProtocol.Request): void {
    const args = this.argsOf<DebugProtocol.SetFunctionBreakpointsArguments>(request);
    const user = args.breakpoints ?? [];
    this.state.userFunctionBps = [...user];
    const armed = this.state.runtimeErrorArmed;
    const union = armed ? [...user, { name: RUNTIME_ERROR_FUNCTION }] : [...user];
    this.forward(
      { ...request, arguments: { ...args, breakpoints: union } },
      {
        transform: (response) => {
          const body = response.body as DebugProtocol.SetFunctionBreakpointsResponse['body'] | undefined;
          if (response.success && body && Array.isArray(body.breakpoints)) {
            if (armed && body.breakpoints.length > user.length) {
              this.state.runtimeErrorBpId = body.breakpoints[user.length].id;
            }
            body.breakpoints = body.breakpoints.slice(0, user.length);
          } else if (!response.success) {
            this.logger.warn(`setFunctionBreakpoints refused: ${response.message ?? 'no message'}`);
          }
          return response;
        }
      }
    );
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
      return raw;
    } catch (error) {
      this.logger.warn('internal stackTrace failed', error);
      return undefined;
    }
  }

  private async onScopes(request: DebugProtocol.Request): Promise<DebugProtocol.Response | { forward: DebugProtocol.Request; transform?: ForwardMeta['transform'] }> {
    const args = this.argsOf<DebugProtocol.ScopesArguments>(request);
    const frame = await this.ensureFrame(args.frameId);
    // A frame outside COBOL — paused in libcob or C$SLEEP after an attach, in the
    // runtime-error hook, in a C helper — shows the data division of the nearest COBOL
    // program up the stack (the same walk `evaluate` does), under names that say whose
    // it is. Only a stack with no COBOL frame above falls through to the engine.
    const anchor = frame && frame.isCobol && frame.program ? { frame } : await this.anchorFrame(args.frameId);
    const entry = anchor?.frame.program;
    if (!frame || !anchor || !entry) {
      return { forward: request, transform: (response) => this.checkRefBand(response) };
    }
    const cobolFrame = anchor.frame;
    const suffix = cobolFrame.id === frame.id ? '' : ` of ${entry.program.programId} (frame #${cobolFrame.index})`;
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
    if (!nearest && this.state.framesOfThread(threadId).length < WALK_UP_STACK_LEVELS) {
      // The client may have fetched only the top of the stack (get_local_variables asks for
      // one frame): the COBOL frame it is inside of is further down. Fetch deeper once.
      await this.fetchStack(threadId, WALK_UP_STACK_LEVELS);
      nearest = nearestCobol();
    }
    if (!nearest) {
      return undefined;
    }
    return { frame: nearest, note: ` (evaluated in frame #${nearest.index} ${nearest.label})` };
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
      this.forward(request);
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
      const sameStatement =
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
        const foreign =
          body.reason !== 'step' ||
          (body.hitBreakpointIds?.length ?? 0) > 0 ||
          (body.threadId !== undefined && body.threadId !== loop.threadId);
        if (foreign) {
          slot.resolve(event);
          return;
        }
        const raw = await this.fetchStack(loop.threadId, 4);
        const top = raw?.[0];
        if (!top || this.stepLanded(loop, top, raw)) {
          slot.resolve(event);
          return;
        }
        if (iteration === MAX_STEP_ITERATIONS - 1) {
          body.description = STEP_BOUND_DESCRIPTION;
          slot.resolve(event);
          return;
        }
        // `stepIn` must keep stepping in, or the CALL it started on is stepped over; LLDB
        // skips libcob (no debug info) by itself. `stepOut` continues with `next`.
        const continuation = loop.command === 'stepIn' ? 'stepIn' : 'next';
        let next: DebugProtocol.Response;
        try {
          next = await this.engine.request(continuation, { threadId: loop.threadId });
        } catch (error) {
          body.description = `step loop stopped early: ${errorMessage(error)}`;
          slot.resolve(event);
          return;
        }
        if (!next.success) {
          body.description = `step loop stopped early: ${next.message ?? 'next refused'}`;
          slot.resolve(event);
          return;
        }
        slot.resolve(null);
      }
    } finally {
      // Anything still queued belongs to the client: a stop the loop did not get to judge.
      for (const signal of loop.queued) {
        if (signal.kind === 'stopped') {
          signal.slot.resolve(signal.event);
        }
      }
      loop.queued.length = 0;
      this.stepLoop = undefined;
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
        slot.resolve(this.stepLoop ? null : event);
        return;
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
    try {
      await this.relabelRuntimeError(body);
    } catch (error) {
      this.logger.warn('runtime-error relabel failed', error);
    }
    if (this.stepLoop) {
      this.deliverStepSignal({ kind: 'stopped', event, slot });
      return;
    }
    try {
      await this.retargetToCobolThread(body);
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
   * rather than a thread-pool stack. Breakpoint, step and runtime-error stops are on the
   * right thread by construction and are left alone, as is any real fault. The original
   * thread and reason stay in the description.
   */
  private async retargetToCobolThread(body: StoppedBody): Promise<void> {
    if (body.threadId === undefined || this.state.registry.programCount === 0 || !isProgramNeutralStop(body)) {
      return;
    }
    if (this.state.lastRuntimeError?.gen === this.state.generation) {
      return;
    }
    const hasCobolFrame = (threadId: number): boolean => this.state.framesOfThread(threadId).some((f) => f.isCobol);
    await this.fetchStack(body.threadId, WALK_UP_STACK_LEVELS);
    if (hasCobolFrame(body.threadId)) {
      return;
    }
    const response = await this.engine.request('threads', {});
    const threads = (response.body as DebugProtocol.ThreadsResponse['body'] | undefined)?.threads ?? [];
    for (const thread of threads) {
      if (thread.id === body.threadId) {
        continue;
      }
      await this.fetchStack(thread.id, WALK_UP_STACK_LEVELS);
      if (hasCobolFrame(thread.id)) {
        this.logger.info(`stop (${body.reason}) reported on thread ${body.threadId}, which has no COBOL frame; shown on thread ${thread.id}`);
        body.description = `${body.description ?? body.reason ?? 'stopped'} (reported on thread ${body.threadId}; shown on thread ${thread.id}, inside the COBOL program)`;
        body.threadId = thread.id;
        this.state.lastThreadId = thread.id;
        return;
      }
    }
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
