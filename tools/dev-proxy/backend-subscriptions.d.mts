export interface RelayClient {
  getProtocolEra?(): 'legacy' | 'modern';
  subscribeResource(params: { uri: string }): Promise<unknown>;
  unsubscribeResource(params: { uri: string }): Promise<unknown>;
  listen(filter: {
    resourceSubscriptions: string[];
    toolsListChanged: boolean;
    resourcesListChanged: boolean;
  }): Promise<{ close(): Promise<void> }>;
}

export interface SubscriptionRelay {
  uris(): string[];
  subscribe(uri: string): Promise<void>;
  unsubscribe(uri: string): Promise<void>;
  reopen(): Promise<void>;
  close(): Promise<void>;
}

export function createSubscriptionRelay(deps: {
  getClient: () => RelayClient | null | undefined;
  log?: (msg: string) => void;
}): SubscriptionRelay;
