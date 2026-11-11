import type { Server } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

export interface FrontBackend {
  state: string;
  mcpClient: {
    listTools(): Promise<{ tools?: unknown[] }>;
    listResources(): Promise<unknown>;
    readResource(params: unknown): Promise<unknown>;
  } | null;
  ensureStarted?(): unknown;
  whenReady(options?: { signal?: AbortSignal }): Promise<boolean>;
  callTool(name: string, args: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>;
  needsRestart?(): boolean;
}

export interface FrontRelay {
  subscribe(uri: string): Promise<void>;
  unsubscribe(uri: string): Promise<void>;
  /** Track everything the backend lists while a 2026 client is pinned. */
  trackAll?(enabled: boolean): void;
  /** Re-read the backend's list (after a resources/list_changed, or when tracking starts). */
  refreshKnown?(): Promise<void>;
}

export interface Front {
  /** The serveStdio factory: one fresh Server per connection or probe, in the era asked for. */
  factory: (ctx: { era: 'legacy' | 'modern' }) => Server;
  /** The newest instance that has not closed: the relay target. */
  current(): Server | null;
  /** Relay a backend notification to the pinned instance through its typed senders. */
  notify(notification: { method: string; params?: Record<string, unknown> }): Promise<void>;
  sendToolListChanged(): Promise<void>;
}

export function createFront(deps: {
  backend: FrontBackend;
  relay: FrontRelay;
  devTools: unknown[];
  handleDevTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  discoveryWaitMs?: number;
  log?: (msg: string) => void;
}): Front;

/** The SDK stdio transport that reports every close of the wire once. */
export class ObservedStdioServerTransport extends StdioServerTransport {
  constructor(onWireClosed: () => void);
}
