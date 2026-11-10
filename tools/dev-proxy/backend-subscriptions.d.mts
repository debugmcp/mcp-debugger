export interface RelayClient {
  getProtocolEra?(): 'legacy' | 'modern';
  subscribeResource(params: { uri: string }): Promise<unknown>;
  unsubscribeResource(params: { uri: string }): Promise<unknown>;
  listResources(): Promise<{ resources?: Array<{ uri: string }> }>;
  listen(filter: {
    resourceSubscriptions: string[];
    toolsListChanged: boolean;
    resourcesListChanged: boolean;
  }): Promise<{ close(): Promise<void> }>;
}

export interface SubscriptionRelay {
  /** What front clients asked for by name. */
  uris(): string[];
  /** Track everything the backend lists (a 2026 front client is pinned), or stop. */
  trackAll(enabled: boolean): void;
  subscribe(uri: string): Promise<void>;
  unsubscribe(uri: string): Promise<void>;
  /** After a backend (re)connect: re-read the list if tracking, express the whole set. */
  reopen(): Promise<void>;
  /** The backend's resource list changed: re-read it and express what is new. */
  refreshKnown(): Promise<void>;
  /** Before a backend goes away: end the open listen; the set stays. */
  close(): Promise<void>;
}

export function createSubscriptionRelay(deps: {
  getClient: () => RelayClient | null | undefined;
  log?: (msg: string) => void;
}): SubscriptionRelay;
