/**
 * Factory for creating SessionStore instances
 * Enables dependency injection and easy mocking for tests
 */
import { SessionStore, CreateSessionParams } from '../session/session-store.js';

/**
 * Interface for SessionStore factory
 */
export interface ISessionStoreFactory {
  create(): SessionStore;
}

/**
 * Production implementation of SessionStore factory
 */
export class SessionStoreFactory implements ISessionStoreFactory {
  create(): SessionStore {
    return new SessionStore();
  }
}

/**
 * Mock implementation of SessionStore factory for testing
 */
export class MockSessionStoreFactory implements ISessionStoreFactory {
  public createdStores: MockSessionStore[] = [];
  
  create(): SessionStore {
    const store = new MockSessionStore();
    this.createdStores.push(store);
    return store;
  }
}

/**
 * Mock SessionStore for testing
 * Extends the real SessionStore to maintain compatibility
 */
export class MockSessionStore extends SessionStore {
  // Add any mock-specific tracking properties here if needed
  public createSessionCalls: Array<{
    params: CreateSessionParams;
  }> = [];

  constructor() {
    super();
  }

  // Override methods to add tracking if needed
  createSession(params: CreateSessionParams) {
    this.createSessionCalls.push({ params });
    return super.createSession(params);
  }
}
