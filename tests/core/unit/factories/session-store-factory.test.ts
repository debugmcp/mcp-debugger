import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  SessionStoreFactory, 
  MockSessionStoreFactory, 
  MockSessionStore,
  ISessionStoreFactory
} from '../../../../src/factories/session-store-factory.js';
import { SessionStore, CreateSessionParams } from '../../../../src/session/session-store.js';
import { DebugLanguage } from '../../../../src/session/models.js';

describe('SessionStoreFactory', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SessionStoreFactory', () => {
    it('should create SessionStore instance', () => {
      const factory = new SessionStoreFactory();
      const store = factory.create();

      // Verify it returns an instance of SessionStore
      expect(store).toBeInstanceOf(SessionStore);
      
      // Verify the interface methods exist
      expect(store.createSession).toBeTypeOf('function');
      expect(store.get).toBeTypeOf('function');
      expect(store.getOrThrow).toBeTypeOf('function');
      expect(store.set).toBeTypeOf('function');
      expect(store.update).toBeTypeOf('function');
      expect(store.updateState).toBeTypeOf('function');
      expect(store.remove).toBeTypeOf('function');
      expect(store.getAll).toBeTypeOf('function');
      expect(store.getAllManaged).toBeTypeOf('function');
      expect(store.has).toBeTypeOf('function');
      expect(store.size).toBeTypeOf('function');
      expect(store.clear).toBeTypeOf('function');
    });

    it('should create independent instances on multiple calls', () => {
      const factory = new SessionStoreFactory();

      const store1 = factory.create();
      const store2 = factory.create();
      const store3 = factory.create();

      // Verify they are different instances
      expect(store1).not.toBe(store2);
      expect(store2).not.toBe(store3);
      expect(store1).not.toBe(store3);
      
      // All should be SessionStore instances
      expect(store1).toBeInstanceOf(SessionStore);
      expect(store2).toBeInstanceOf(SessionStore);
      expect(store3).toBeInstanceOf(SessionStore);
    });

    it('should not retain references to created instances', () => {
      const factory = new SessionStoreFactory();

      // Create some stores
      const stores: SessionStore[] = [];
      for (let i = 0; i < 5; i++) {
        stores.push(factory.create());
      }

      // Factory should not have any internal state tracking created instances
      // This is verified by the fact that SessionStoreFactory has no instance arrays
      // and each create() call returns a new instance
      expect(stores[0]).not.toBe(stores[1]);
      expect(stores[1]).not.toBe(stores[2]);
      expect(stores[2]).not.toBe(stores[3]);
      expect(stores[3]).not.toBe(stores[4]);
    });

    it('should create functional SessionStore instances', () => {
      const factory = new SessionStoreFactory();
      const store = factory.create();

      // Test basic functionality of created store
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        name: 'test-session',
        executablePath: 'python3'
      };

      const session = store.createSession(params);
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.name).toBe('test-session');
      expect(session.language).toBe(DebugLanguage.PYTHON);

      // Verify we can retrieve the session
      expect(store.has(session.id)).toBe(true);
      expect(store.size()).toBe(1);
      
      const retrieved = store.get(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should implement ISessionStoreFactory interface', () => {
      const factory: ISessionStoreFactory = new SessionStoreFactory();
      expect(factory.create).toBeTypeOf('function');
      
      const store = factory.create();
      expect(store).toBeInstanceOf(SessionStore);
    });

    it('should create stores that maintain independent state', () => {
      const factory = new SessionStoreFactory();
      const store1 = factory.create();
      const store2 = factory.create();

      // Create session in store1
      const session1 = store1.createSession({
        language: DebugLanguage.PYTHON,
        name: 'store1-session'
      });

      // Create session in store2
      const session2 = store2.createSession({
        language: DebugLanguage.PYTHON,
        name: 'store2-session'
      });

      // Verify isolation
      expect(store1.has(session1.id)).toBe(true);
      expect(store1.has(session2.id)).toBe(false);
      expect(store2.has(session1.id)).toBe(false);
      expect(store2.has(session2.id)).toBe(true);

      expect(store1.size()).toBe(1);
      expect(store2.size()).toBe(1);
    });
  });

  describe('MockSessionStoreFactory', () => {
    it('should create MockSessionStore instances', () => {
      const factory = new MockSessionStoreFactory();
      const store = factory.create();

      // Verify it returns an instance of MockSessionStore
      expect(store).toBeInstanceOf(MockSessionStore);
      expect(store).toBeInstanceOf(SessionStore); // Also extends SessionStore
      
      // Verify mock-specific properties exist
      const mockStore = store as MockSessionStore;
      expect(mockStore.createSessionCalls).toBeDefined();
      expect(Array.isArray(mockStore.createSessionCalls)).toBe(true);
    });

    it('should track created stores', () => {
      const factory = new MockSessionStoreFactory();
      
      expect(factory.createdStores).toHaveLength(0);

      const store1 = factory.create();
      expect(factory.createdStores).toHaveLength(1);
      expect(factory.createdStores[0]).toBe(store1);

      const store2 = factory.create();
      expect(factory.createdStores).toHaveLength(2);
      expect(factory.createdStores[1]).toBe(store2);

      const store3 = factory.create();
      expect(factory.createdStores).toHaveLength(3);
      expect(factory.createdStores[2]).toBe(store3);
    });

    it('should create independent MockSessionStore instances', () => {
      const factory = new MockSessionStoreFactory();

      const store1 = factory.create();
      const store2 = factory.create();

      expect(store1).not.toBe(store2);
      expect(store1).toBeInstanceOf(MockSessionStore);
      expect(store2).toBeInstanceOf(MockSessionStore);

      // Each should have its own tracking array
      const mockStore1 = store1 as MockSessionStore;
      const mockStore2 = store2 as MockSessionStore;
      expect(mockStore1.createSessionCalls).not.toBe(mockStore2.createSessionCalls);
    });

    it('should maintain independent state between factory instances', () => {
      const factory1 = new MockSessionStoreFactory();
      const factory2 = new MockSessionStoreFactory();

      const store1 = factory1.create();
      const store2 = factory2.create();

      expect(factory1.createdStores).toHaveLength(1);
      expect(factory1.createdStores[0]).toBe(store1);
      
      expect(factory2.createdStores).toHaveLength(1);
      expect(factory2.createdStores[0]).toBe(store2);

      // Arrays should be independent
      expect(factory1.createdStores).not.toBe(factory2.createdStores);
    });

    it('should implement ISessionStoreFactory interface', () => {
      const factory: ISessionStoreFactory = new MockSessionStoreFactory();
      expect(factory.create).toBeTypeOf('function');
      
      const store = factory.create();
      expect(store).toBeInstanceOf(SessionStore);
    });

    it('should allow accessing all created stores for testing', () => {
      const factory = new MockSessionStoreFactory();
      
      // Create multiple stores
      const stores: SessionStore[] = [];
      for (let i = 0; i < 3; i++) {
        stores.push(factory.create());
      }

      // Verify all are tracked
      expect(factory.createdStores).toHaveLength(3);
      stores.forEach((store, index) => {
        expect(factory.createdStores[index]).toBe(store);
      });
    });
  });

  describe('MockSessionStore', () => {
    it('should extend SessionStore', () => {
      const store = new MockSessionStore();
      expect(store).toBeInstanceOf(SessionStore);
      expect(store).toBeInstanceOf(MockSessionStore);
    });

    it('should be assignable to SessionStore type', () => {
      const mockStore: SessionStore = new MockSessionStore();
      expect(mockStore).toBeDefined();
      expect(mockStore.createSession).toBeTypeOf('function');
    });

    it('should start with empty tracking arrays', () => {
      const store = new MockSessionStore();
      expect(store.createSessionCalls).toHaveLength(0);
    });

    it('should track createSession calls', () => {
      const store = new MockSessionStore();
      
      const params1: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        name: 'session-1',
        executablePath: '/usr/bin/python3'
      };

      const params2: CreateSessionParams = {
        language: DebugLanguage.MOCK,
        name: 'session-2'
      };

      store.createSession(params1);
      expect(store.createSessionCalls).toHaveLength(1);
      expect(store.createSessionCalls[0].params).toEqual(params1);

      store.createSession(params2);
      expect(store.createSessionCalls).toHaveLength(2);
      expect(store.createSessionCalls[1].params).toEqual(params2);
    });

    it('should maintain base SessionStore functionality while tracking', () => {
      const store = new MockSessionStore();
      
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        name: 'tracked-session'
      };

      // Create session
      const session = store.createSession(params);
      
      // Verify tracking
      expect(store.createSessionCalls).toHaveLength(1);
      expect(store.createSessionCalls[0].params).toEqual(params);

      // Verify base functionality still works
      expect(session).toBeDefined();
      expect(session.name).toBe('tracked-session');
      expect(store.has(session.id)).toBe(true);
      expect(store.size()).toBe(1);
      
      const retrieved = store.get(session.id);
      expect(retrieved?.name).toBe('tracked-session');
    });

    it('should maintain independent tracking between instances', () => {
      const store1 = new MockSessionStore();
      const store2 = new MockSessionStore();

      const params1: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        name: 'store1-session'
      };

      const params2: CreateSessionParams = {
        language: DebugLanguage.MOCK,
        name: 'store2-session'
      };

      store1.createSession(params1);
      store2.createSession(params2);

      // Each store should track only its own calls
      expect(store1.createSessionCalls).toHaveLength(1);
      expect(store1.createSessionCalls[0].params).toEqual(params1);

      expect(store2.createSessionCalls).toHaveLength(1);
      expect(store2.createSessionCalls[0].params).toEqual(params2);

      // Arrays should be independent
      expect(store1.createSessionCalls).not.toBe(store2.createSessionCalls);
    });

    it('should track multiple createSession calls in order', () => {
      const store = new MockSessionStore();
      const callParams: CreateSessionParams[] = [];

      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        const params: CreateSessionParams = {
          language: DebugLanguage.PYTHON,
          name: `session-${i}`,
          executablePath: `/path/to/python${i}`
        };
        callParams.push(params);
        store.createSession(params);
      }

      // Verify all calls were tracked in order
      expect(store.createSessionCalls).toHaveLength(5);
      callParams.forEach((params, index) => {
        expect(store.createSessionCalls[index].params).toEqual(params);
      });
    });

    it('should handle createSession with minimal parameters', () => {
      const store = new MockSessionStore();
      
      const minimalParams: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };

      const session = store.createSession(minimalParams);
      
      expect(store.createSessionCalls).toHaveLength(1);
      expect(store.createSessionCalls[0].params).toEqual(minimalParams);
      expect(session.language).toBe(DebugLanguage.PYTHON);
      expect(session.name).toMatch(/^session-/); // Auto-generated name
    });

    it('should preserve all SessionStore methods', () => {
      const store = new MockSessionStore();
      
      // Verify all SessionStore methods are available
      const methods = [
        'createSession', 'get', 'getOrThrow', 'set', 'update',
        'updateState', 'remove', 'getAll', 'getAllManaged',
        'has', 'size', 'clear'
      ];

      methods.forEach(method => {
        expect(store[method as keyof MockSessionStore]).toBeTypeOf('function');
      });
    });

    it('should track parameters exactly as passed', () => {
      const store = new MockSessionStore();
      
      const complexParams: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        name: 'complex-session',
        executablePath: '/usr/bin/python3.9'
      };

      store.createSession(complexParams);
      
      // Should track exact parameters
      expect(store.createSessionCalls[0].params).toEqual(complexParams);
      expect(store.createSessionCalls[0].params.executablePath).toBe('/usr/bin/python3.9');
    });
  });
});
