/**
 * Factory for creating SessionStore instances
 * Enables dependency injection and easy mocking for tests
 */
import { SessionStore } from '../session/session-store.js';
/**
 * Production implementation of SessionStore factory
 */
export class SessionStoreFactory {
    create() {
        return new SessionStore();
    }
}
/**
 * Mock implementation of SessionStore factory for testing
 */
export class MockSessionStoreFactory {
    createdStores = [];
    create() {
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
    createSessionCalls = [];
    constructor() {
        super();
    }
    // Override methods to add tracking if needed
    createSession(params) {
        this.createSessionCalls.push({ params });
        return super.createSession(params);
    }
}
//# sourceMappingURL=session-store-factory.js.map