/**
 * ChildProxyView — a child session's proxy manager (the session tree, issue
 * #1081; docs/architecture/session-tree.md, "Where it lives").
 *
 * One worker serves the root session and every child the adapter reports,
 * each on its own connection to the same adapter. The root's ProxyManager
 * owns the worker process and the IPC channel; a view is an IProxyManager
 * over that same channel filtered to one child's session id: its requests
 * travel on the child's envelope, the worker's messages tagged with the
 * child's id are dispatched to it, and its `stop()` closes only the child's
 * connection — never the worker, never the adapter slot. The session layer
 * wires a child exactly like a root, with the same handlers.
 */
import { EventEmitter } from 'events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { HandshakeProxy, ILogger } from '@debugmcp/shared';
import type { ChildReportedEvent, IProxyManager, PreDetachResume, ProxyManagerEvents } from './proxy-manager.js';
import type { ProxyConfig } from './proxy-config.js';
import type { ProxyDapEventMessage, ProxyMessage, ProxyStatusMessage } from '../dap-core/types.js';
import { CHILD_ADOPT_COMMAND, CHILD_CLOSE_COMMAND, type ChildAdoptArgs } from './dap-proxy-interfaces.js';

/** The worker's answer to CHILD_ADOPT_COMMAND. */
export interface ChildAdoptResult {
  sessionId: string;
  /** The child's own initialize response body. */
  capabilities?: DebugProtocol.Capabilities;
}

export interface IChildProxyView extends IProxyManager {
  readonly childSessionId: string;
  /**
   * Adopt the held report as this view's connection: the worker opens a
   * connection to the adapter, runs the child handshake with the given
   * breakpoints re-sent before configurationDone, and answers the held
   * request. Resolves once the child runs under this session.
   */
  adopt(args: ChildAdoptArgs, options?: { timeoutMs?: number }): Promise<ChildAdoptResult>;
  /** A worker message tagged with this view's session id. */
  dispatch(message: ProxyMessage): void;
  /** The worker (or this connection) is gone: emit `exit` once. */
  onWorkerExit(code: number | null, signal?: string, expected?: boolean): void;
}

/** What a view needs from the root manager. */
export interface ChildViewRoot {
  isRunning(): boolean;
  getProxyPid(): number | null;
  getAdapterStderrTail(): readonly string[];
  sendDapRequestAs<T extends DebugProtocol.Response>(
    sessionId: string,
    command: string,
    args?: unknown,
    options?: { timeoutMs?: number }
  ): Promise<T>;
  createChildView(childSessionId: string): IChildProxyView;
  detachChildView(childSessionId: string): void;
  releaseReportedChild(connectionSessionId: string, reportId: string, reason: string): void;
}

/** Where a forwarded DAP event lands: the root manager or a child view. */
export interface DapEventSink {
  emit(event: string, ...args: unknown[]): boolean;
  onStopped(threadId: number): void;
}

/**
 * The one mapping from a worker's dapEvent to the typed ProxyManager events,
 * shared by the root and every view so a child's `stopped`, `output` or
 * `terminated` means exactly what the root's does.
 */
export function forwardDapEvent(sink: DapEventSink, event: string, body: unknown): void {
  switch (event) {
    case 'stopped': {
      const stoppedBody = body as { threadId?: number; reason?: string } | undefined;
      const threadId = typeof stoppedBody?.threadId === 'number' ? stoppedBody.threadId : undefined;
      if (typeof threadId === 'number') {
        sink.onStopped(threadId);
      }
      // Do not fabricate a threadId; emit undefined if the adapter omitted it.
      sink.emit('stopped', threadId, stoppedBody?.reason || 'unknown', stoppedBody as DebugProtocol.StoppedEvent['body']);
      break;
    }
    case 'continued':
      sink.emit('continued');
      break;
    case 'terminated':
      sink.emit('terminated');
      break;
    case 'exited': {
      const exitedBody = body as { exitCode?: number } | undefined;
      sink.emit('exited', typeof exitedBody?.exitCode === 'number' ? exitedBody.exitCode : undefined);
      break;
    }
    case 'output':
      sink.emit('output', body as DebugProtocol.OutputEvent['body']);
      break;
    case 'breakpoint':
      sink.emit('breakpoint', body as DebugProtocol.BreakpointEvent['body']);
      break;
    default:
      sink.emit('dap-event', event, body);
  }
}

/** The `child-reported` event carried by a child_reported status. */
export function childReportedOf(message: Extract<ProxyStatusMessage, { status: 'child_reported' }>): ChildReportedEvent {
  return {
    reportId: message.reportId,
    targetId: message.targetId,
    name: message.name,
    configuration: message.configuration
  };
}

export class ChildProxyView extends EventEmitter implements IChildProxyView {
  private connectionOpen = false;
  private adoptionStarted = false;
  private pendingAdoption: Promise<DebugProtocol.Response> | undefined;
  private stopped = false;
  private exitEmitted = false;
  private currentThreadId: number | null = null;

  constructor(
    private readonly root: ChildViewRoot,
    public readonly childSessionId: string,
    private readonly logger: ILogger
  ) {
    super();
    // Like the root manager: an `error` with no listener must not throw.
    this.on('error', () => {});
  }

  // ----- IProxyManager -----

  async start(_config: ProxyConfig): Promise<void> {
    throw new Error(`child session ${this.childSessionId} is started by its parent, not launched`);
  }

  async adopt(args: ChildAdoptArgs, options: { timeoutMs?: number } = { timeoutMs: 30000 }): Promise<ChildAdoptResult> {
    if (this.stopped || this.exitEmitted) {
      throw new Error(`child session ${this.childSessionId}: its connection is closed`);
    }
    this.adoptionStarted = true;
    this.pendingAdoption = this.root.sendDapRequestAs<DebugProtocol.Response>(
      this.childSessionId,
      CHILD_ADOPT_COMMAND,
      args,
      options
    );
    try {
      const response = await this.pendingAdoption;
      // Closing a child can race its handshake or the final IPC answer. Never
      // reopen a detached view or announce readiness after a terminal event.
      if (this.stopped || this.exitEmitted) {
        throw new Error(`child session ${this.childSessionId}: its connection closed during adoption`);
      }
      const body = (response?.body ?? {}) as Partial<ChildAdoptResult>;
      this.connectionOpen = true;
      if (body.capabilities) {
        this.emit('adapter-capabilities', body.capabilities);
      }
      this.emit('adapter-configured');
      this.emit('initialized');
      return { sessionId: body.sessionId ?? this.childSessionId, capabilities: body.capabilities };
    } finally {
      this.pendingAdoption = undefined;
    }
  }

  /**
   * Connection-scoped: close this child's connection (debugpy ends the child,
   * the measured semantics of a child's close) and forget the view. The
   * worker, the adapter and the root's own state are untouched.
   */
  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    const needsClose = this.connectionOpen || this.adoptionStarted;
    this.connectionOpen = false;
    // The worker registers an adoption before its first await, so the close
    // also cancels a handshake still in flight on the same IPC channel.
    if (needsClose && !this.exitEmitted && this.root.isRunning()) {
      try {
        await this.root.sendDapRequestAs(this.childSessionId, CHILD_CLOSE_COMMAND, { terminateDebuggee: true }, { timeoutMs: 5000 });
      } catch (error) {
        this.logger.warn(
          `[ChildProxyView ${this.childSessionId}] close failed (best effort): ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    this.connectionOpen = false;
    this.root.detachChildView(this.childSessionId);
  }

  async sendDapRequest<T extends DebugProtocol.Response>(
    command: string,
    args?: unknown,
    options?: { timeoutMs?: number }
  ): Promise<T> {
    // A stopped event (and the session layer's immediate inspection) may
    // precede the adoption answer. Hold requests until the handshake settles,
    // preserving its error if adoption fails, instead of rejecting a live child.
    if (!this.connectionOpen && this.pendingAdoption && !this.stopped && !this.exitEmitted) {
      await this.pendingAdoption;
    }
    if (!this.connectionOpen || !this.root.isRunning()) {
      throw new Error(`child session ${this.childSessionId}: its connection is not open`);
    }
    return this.root.sendDapRequestAs<T>(this.childSessionId, command, args, options);
  }

  isRunning(): boolean {
    return !this.stopped && !this.exitEmitted && (this.connectionOpen || this.pendingAdoption !== undefined) && this.root.isRunning();
  }

  getProxyPid(): number | null {
    return this.root.getProxyPid();
  }

  getCurrentThreadId(): number | null {
    return this.currentThreadId;
  }

  setCurrentThreadId(threadId: number): void {
    this.currentThreadId = threadId;
  }

  getPreDetachResume(): PreDetachResume | undefined {
    return undefined;
  }

  getAdapterStderrTail(): readonly string[] {
    return this.root.getAdapterStderrTail();
  }

  /** A grandchild reported on this connection is a child of this session; its view lives on the root. */
  createChildView(childSessionId: string): IChildProxyView {
    return this.root.createChildView(childSessionId);
  }

  // ----- the worker's messages for this session -----

  dispatch(message: ProxyMessage): void {
    switch (message.type) {
      case 'dapEvent': {
        const event = message as ProxyDapEventMessage;
        forwardDapEvent(this.sink(), event.event, event.body);
        return;
      }
      case 'status':
        this.dispatchStatus(message as ProxyStatusMessage);
        return;
      case 'error': {
        const text = (message as { message?: unknown }).message;
        this.emit('error', new Error(typeof text === 'string' ? text : 'proxy error'));
        return;
      }
      default:
        // Responses resolve on the root, by request id.
        return;
    }
  }

  onWorkerExit(code: number | null, signal?: string, expected?: boolean): void {
    this.connectionOpen = false;
    if (this.exitEmitted) {
      return;
    }
    this.exitEmitted = true;
    // The root's arity: `expected` rides along only on status-driven exits.
    if (expected === undefined) {
      this.emit('exit', code, signal);
    } else {
      this.emit('exit', code, signal, expected);
    }
  }

  private dispatchStatus(message: ProxyStatusMessage): void {
    switch (message.status) {
      case 'child_reported': {
        const report = childReportedOf(message);
        if (this.listenerCount('child-reported') > 0) {
          this.emit('child-reported', report);
        } else {
          this.root.releaseReportedChild(this.childSessionId, report.reportId, 'no child-session adopter on the server');
        }
        return;
      }
      case 'breakpoints_synced':
        this.emit('breakpoints-synced', message.breakpoints ?? []);
        return;
      case 'function_breakpoints_synced':
        this.emit('function-breakpoints-synced', message.functionBreakpoints ?? []);
        return;
      case 'adapter_capabilities':
        this.emit('adapter-capabilities', message.capabilities);
        return;
      case 'adapter_notice':
        if (typeof message.note === 'string' && message.note.length > 0) {
          this.emit('adapter-notice', message.note);
        }
        return;
      case 'dap_connection_closed':
      case 'terminated':
      case 'adapter_exited':
        this.onWorkerExit(message.code ?? null, message.signal || undefined, message.expected);
        return;
      default:
        this.logger.debug(`[ChildProxyView ${this.childSessionId}] Ignoring status ${message.status}`);
    }
  }

  private sink(): DapEventSink {
    return {
      emit: (event, ...args) => this.emit(event as keyof ProxyManagerEvents, ...(args as never[])),
      onStopped: (threadId) => {
        this.currentThreadId = threadId;
      }
    };
  }

  // The typed `on`/`emit` of IProxyManager are satisfied by EventEmitter's
  // own methods, structurally, exactly as on the root manager.
}

/** Fails to compile unless T is assignable to U. */
type AssertAssignable<T extends U, U> = T;
/** A view is a HandshakeProxy too, like the root manager (see proxy-manager.ts). */
type _ChildProxyViewSatisfiesHandshakeProxy = AssertAssignable<ChildProxyView, HandshakeProxy>;
