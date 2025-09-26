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
export declare class SessionStoreFactory implements ISessionStoreFactory {
    create(): SessionStore;
}
/**
 * Mock implementation of SessionStore factory for testing
 */
export declare class MockSessionStoreFactory implements ISessionStoreFactory {
    createdStores: MockSessionStore[];
    create(): SessionStore;
}
/**
 * Mock SessionStore for testing
 * Extends the real SessionStore to maintain compatibility
 */
export declare class MockSessionStore extends SessionStore {
    createSessionCalls: Array<{
        params: CreateSessionParams;
    }>;
    constructor();
    createSession(params: CreateSessionParams): import("packages/shared/dist/index.js").DebugSessionInfo;
}
