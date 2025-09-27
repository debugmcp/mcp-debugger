/**
 * Unit tests for SessionStore
 * 
 * These tests demonstrate the improved testability achieved through extraction.
 * SessionStore is a pure data component with no external dependencies.
 * 
 * This test file has been updated to use the new factory pattern as a demonstration,
 * even though SessionStore doesn't require dependency injection.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionStore, CreateSessionParams } from '../../../../src/session/session-store.js';
import { DebugLanguage, SessionState } from '@debugmcp/shared';
import { SessionNotFoundError } from '../../../../src/errors/debug-errors.js';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    // SessionStore is a pure data component, no dependencies needed
    store = new SessionStore();
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers(); // Clean up fake timers
  });

  describe('createSession', () => {
    it('should create a new Python session with default values', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };

      const session = store.createSession(params);

      expect(session.id).toBeDefined();
      expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(session.name).toMatch(/^session-[0-9a-f]{8}$/);
      expect(session.language).toBe(DebugLanguage.PYTHON);
      expect(session.state).toBe(SessionState.CREATED);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a session with custom name', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        name: 'My Debug Session'
      };

      const session = store.createSession(params);

      expect(session.name).toBe('My Debug Session');
    });

    it('should create a session with custom executable path', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        executablePath: '/usr/bin/python3'
      };

      const session = store.createSession(params);
      const managedSession = store.get(session.id);

      expect(managedSession?.executablePath).toBe('/usr/bin/python3');
    });

    it('should use environment python path if not provided', () => {
      const originalPythonPath = process.env.PYTHON_PATH;
      process.env.PYTHON_PATH = '/opt/python/bin/python';

      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };

      const session = store.createSession(params);
      const managedSession = store.get(session.id);

      expect(managedSession?.executablePath).toBe('/opt/python/bin/python');

      // Restore original value
      if (originalPythonPath) {
        process.env.PYTHON_PATH = originalPythonPath;
      } else {
        delete process.env.PYTHON_PATH;
      }
    });

    it('should use default python if no custom path or env var', () => {
      const originalPythonPath = process.env.PYTHON_PATH;
      delete process.env.PYTHON_PATH;

      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };

      const session = store.createSession(params);
      const managedSession = store.get(session.id);

       const expectedDefault = process.platform === 'win32' ? 'python' : 'python3';
       expect(managedSession?.executablePath).toBe(expectedDefault);

      // Restore original value
      if (originalPythonPath) {
        process.env.PYTHON_PATH = originalPythonPath;
      }
    });

    it('should throw error for unsupported language', () => {
      const params = {
        language: 'unsupported' as DebugLanguage
      };

      expect(() => store.createSession(params)).toThrow(
        "Language 'unsupported' is not supported. Only 'python' is currently implemented."
      );
    });

    it('should store the session internally', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };

      const session = store.createSession(params);
      
      expect(store.has(session.id)).toBe(true);
      expect(store.size()).toBe(1);
    });
  });

  describe('get', () => {
    it('should return session if exists', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        name: 'Test Session'
      };
      const created = store.createSession(params);

      const retrieved = store.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Session');
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = store.get('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getOrThrow', () => {
    it('should return session if exists', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };
      const created = store.createSession(params);

      const retrieved = store.getOrThrow(created.id);

      expect(retrieved.id).toBe(created.id);
    });

    it('should throw error for non-existent session', () => {
      expect(() => store.getOrThrow('non-existent-id')).toThrow(SessionNotFoundError);
    });
  });

  describe('update', () => {
    it('should update session fields', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };
      const created = store.createSession(params);
      expect(created.updatedAt).toBeDefined();
      const originalUpdatedAt = created.updatedAt!;

      // Wait a bit to ensure updatedAt changes
      vi.advanceTimersByTime(100);

      store.update(created.id, {
        name: 'Updated Name',
        executablePath: '/new/python/path'
      });

      const updated = store.get(created.id);
      expect(updated).toBeDefined();
      if (!updated) throw new Error('Session should exist');
      expect(updated.name).toBe('Updated Name');
      expect(updated.executablePath).toBe('/new/python/path');
      expect(updated.updatedAt).toBeDefined();
      expect(updated.updatedAt!.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should throw error when updating non-existent session', () => {
      expect(() => store.update('non-existent-id', { name: 'New Name' })).toThrow(SessionNotFoundError);
    });
  });

  describe('updateState', () => {
    it('should update session state', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };
      const created = store.createSession(params);

      store.updateState(created.id, SessionState.RUNNING);

      const updated = store.get(created.id);
      expect(updated?.state).toBe(SessionState.RUNNING);
    });

    it('should not update timestamp if state unchanged', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };
      const created = store.createSession(params);
      const originalUpdatedAt = created.updatedAt;

      store.updateState(created.id, SessionState.CREATED);

      const updated = store.get(created.id);
      expect(updated?.updatedAt).toEqual(originalUpdatedAt);
    });

    it('should throw error when updating state of non-existent session', () => {
      expect(() => store.updateState('non-existent-id', SessionState.RUNNING)).toThrow(SessionNotFoundError);
    });
  });

  describe('remove', () => {
    it('should remove existing session', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };
      const created = store.createSession(params);

      const removed = store.remove(created.id);

      expect(removed).toBe(true);
      expect(store.has(created.id)).toBe(false);
      expect(store.size()).toBe(0);
    });

    it('should return false when removing non-existent session', () => {
      const removed = store.remove('non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no sessions', () => {
      const sessions = store.getAll();
      expect(sessions).toEqual([]);
    });

    it('should return all sessions as DebugSessionInfo', () => {
      const params1: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        name: 'Session 1'
      };
      const params2: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        name: 'Session 2'
      };

      const session1 = store.createSession(params1);
      const session2 = store.createSession(params2);

      const sessions = store.getAll();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.name).sort()).toEqual(['Session 1', 'Session 2']);
      expect(sessions.find(s => s.id === session1.id)).toBeDefined();
      expect(sessions.find(s => s.id === session2.id)).toBeDefined();
    });

    it('should not expose internal session data', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        executablePath: '/custom/python'
      };
      store.createSession(params);

      const sessions = store.getAll();
      
      // DebugSessionInfo should not include executablePath or proxyManager
      expect(sessions[0]).not.toHaveProperty('executablePath');
      expect(sessions[0]).not.toHaveProperty('proxyManager');
    });
  });

  describe('getAllManaged', () => {
    it('should return all sessions with full data', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON,
        executablePath: '/custom/python'
      };
      store.createSession(params);

      const sessions = store.getAllManaged();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].executablePath).toBe('/custom/python');
      expect(sessions[0].proxyManager).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing session', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };
      const created = store.createSession(params);

      expect(store.has(created.id)).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(store.has('non-existent-id')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 for empty store', () => {
      expect(store.size()).toBe(0);
    });

    it('should return correct count', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };
      
      store.createSession(params);
      expect(store.size()).toBe(1);

      store.createSession(params);
      expect(store.size()).toBe(2);

      store.createSession(params);
      expect(store.size()).toBe(3);
    });
  });

  describe('clear', () => {
    it('should remove all sessions', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };
      
      store.createSession(params);
      store.createSession(params);
      store.createSession(params);
      
      expect(store.size()).toBe(3);

      store.clear();

      expect(store.size()).toBe(0);
      expect(store.getAll()).toEqual([]);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple operations correctly', () => {
      const params: CreateSessionParams = {
        language: DebugLanguage.PYTHON
      };

      // Create multiple sessions
      const session1 = store.createSession({ ...params, name: 'Session 1' });
      const session2 = store.createSession({ ...params, name: 'Session 2' });
      const session3 = store.createSession({ ...params, name: 'Session 3' });

      // Update states
      store.updateState(session1.id, SessionState.RUNNING);
      store.updateState(session2.id, SessionState.PAUSED);
      store.updateState(session3.id, SessionState.ERROR);

      // Remove one
      store.remove(session2.id);

      // Verify final state
      expect(store.size()).toBe(2);
      expect(store.get(session1.id)?.state).toBe(SessionState.RUNNING);
      expect(store.get(session2.id)).toBeUndefined();
      expect(store.get(session3.id)?.state).toBe(SessionState.ERROR);
    });
  });
});
