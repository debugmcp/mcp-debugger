/**
 * Unit tests for Session Models
 * 
 * Comprehensive tests for state mapping functions and model definitions.
 * These tests ensure backward compatibility between legacy and new state models,
 * which is critical for the debugging session lifecycle.
 */
import { describe, it, expect } from 'vitest';
import {
  DebugLanguage,
  SessionLifecycleState,
  ExecutionState,
  SessionState,
  mapLegacyState,
  mapToLegacyState
} from '@debugmcp/shared';

describe('Session Models', () => {
  describe('mapLegacyState', () => {
    it('should map CREATED legacy state to CREATED lifecycle (session initialization)', () => {
      const result = mapLegacyState(SessionState.CREATED);
      expect(result).toEqual({
        lifecycle: SessionLifecycleState.CREATED
      });
      expect(result.execution).toBeUndefined();
    });

    it('should map INITIALIZING legacy state to ACTIVE lifecycle with INITIALIZING execution (adapter startup)', () => {
      const result = mapLegacyState(SessionState.INITIALIZING);
      expect(result).toEqual({
        lifecycle: SessionLifecycleState.ACTIVE,
        execution: ExecutionState.INITIALIZING
      });
    });

    it('should map READY legacy state to ACTIVE lifecycle with INITIALIZING execution (backward compatibility)', () => {
      const result = mapLegacyState(SessionState.READY);
      expect(result).toEqual({
        lifecycle: SessionLifecycleState.ACTIVE,
        execution: ExecutionState.INITIALIZING
      });
    });

    it('should map RUNNING legacy state to ACTIVE lifecycle with RUNNING execution (program executing)', () => {
      const result = mapLegacyState(SessionState.RUNNING);
      expect(result).toEqual({
        lifecycle: SessionLifecycleState.ACTIVE,
        execution: ExecutionState.RUNNING
      });
    });

    it('should map PAUSED legacy state to ACTIVE lifecycle with PAUSED execution (breakpoint hit)', () => {
      const result = mapLegacyState(SessionState.PAUSED);
      expect(result).toEqual({
        lifecycle: SessionLifecycleState.ACTIVE,
        execution: ExecutionState.PAUSED
      });
    });

    it('should map STOPPED legacy state to TERMINATED lifecycle (session ended)', () => {
      const result = mapLegacyState(SessionState.STOPPED);
      expect(result).toEqual({
        lifecycle: SessionLifecycleState.TERMINATED
      });
      expect(result.execution).toBeUndefined();
    });

    it('should map ERROR legacy state to ACTIVE lifecycle with ERROR execution (recoverable error)', () => {
      const result = mapLegacyState(SessionState.ERROR);
      expect(result).toEqual({
        lifecycle: SessionLifecycleState.ACTIVE,
        execution: ExecutionState.ERROR
      });
    });

    // Edge case: Test with string values that might come from JSON
    it('should handle string values that match enum values (external data compatibility)', () => {
      const legacyStateAsString = 'created' as SessionState;
      const result = mapLegacyState(legacyStateAsString);
      expect(result).toEqual({
        lifecycle: SessionLifecycleState.CREATED
      });
    });
  });

  describe('mapToLegacyState', () => {
    it('should map CREATED lifecycle to CREATED legacy state', () => {
      const result = mapToLegacyState(SessionLifecycleState.CREATED);
      expect(result).toBe(SessionState.CREATED);
    });

    it('should map CREATED lifecycle with any execution state to CREATED legacy state (lifecycle takes precedence)', () => {
      const result = mapToLegacyState(SessionLifecycleState.CREATED, ExecutionState.RUNNING);
      expect(result).toBe(SessionState.CREATED);
    });

    it('should map TERMINATED lifecycle to STOPPED legacy state', () => {
      const result = mapToLegacyState(SessionLifecycleState.TERMINATED);
      expect(result).toBe(SessionState.STOPPED);
    });

    it('should map TERMINATED lifecycle with any execution state to STOPPED legacy state (lifecycle takes precedence)', () => {
      const result = mapToLegacyState(SessionLifecycleState.TERMINATED, ExecutionState.ERROR);
      expect(result).toBe(SessionState.STOPPED);
    });

    describe('ACTIVE lifecycle mappings', () => {
      it('should map ACTIVE with INITIALIZING execution to INITIALIZING legacy state', () => {
        const result = mapToLegacyState(SessionLifecycleState.ACTIVE, ExecutionState.INITIALIZING);
        expect(result).toBe(SessionState.INITIALIZING);
      });

      it('should map ACTIVE with RUNNING execution to RUNNING legacy state', () => {
        const result = mapToLegacyState(SessionLifecycleState.ACTIVE, ExecutionState.RUNNING);
        expect(result).toBe(SessionState.RUNNING);
      });

      it('should map ACTIVE with PAUSED execution to PAUSED legacy state', () => {
        const result = mapToLegacyState(SessionLifecycleState.ACTIVE, ExecutionState.PAUSED);
        expect(result).toBe(SessionState.PAUSED);
      });

      it('should map ACTIVE with TERMINATED execution to STOPPED legacy state (program ended but session active)', () => {
        const result = mapToLegacyState(SessionLifecycleState.ACTIVE, ExecutionState.TERMINATED);
        expect(result).toBe(SessionState.STOPPED);
      });

      it('should map ACTIVE with ERROR execution to ERROR legacy state', () => {
        const result = mapToLegacyState(SessionLifecycleState.ACTIVE, ExecutionState.ERROR);
        expect(result).toBe(SessionState.ERROR);
      });

      it('should map ACTIVE with undefined execution to READY legacy state (default case)', () => {
        const result = mapToLegacyState(SessionLifecycleState.ACTIVE);
        expect(result).toBe(SessionState.READY);
      });

      it('should map ACTIVE with undefined execution to READY legacy state (explicit undefined)', () => {
        const result = mapToLegacyState(SessionLifecycleState.ACTIVE, undefined);
        expect(result).toBe(SessionState.READY);
      });
    });

    // Edge case: Test with string values that might come from JSON
    it('should handle string values for lifecycle state (external data compatibility)', () => {
      const lifecycleAsString = 'active' as SessionLifecycleState;
      const executionAsString = 'running' as ExecutionState;
      const result = mapToLegacyState(lifecycleAsString, executionAsString);
      expect(result).toBe(SessionState.RUNNING);
    });
  });

  describe('Round-trip mapping consistency', () => {
    it('should maintain consistency for CREATED state (legacy → new → legacy)', () => {
      const original = SessionState.CREATED;
      const mapped = mapLegacyState(original);
      const roundTrip = mapToLegacyState(mapped.lifecycle, mapped.execution);
      expect(roundTrip).toBe(original);
    });

    it('should maintain consistency for INITIALIZING state (legacy → new → legacy)', () => {
      const original = SessionState.INITIALIZING;
      const mapped = mapLegacyState(original);
      const roundTrip = mapToLegacyState(mapped.lifecycle, mapped.execution);
      expect(roundTrip).toBe(original);
    });

    it('should maintain consistency for READY state (legacy → new → legacy)', () => {
      const original = SessionState.READY;
      const mapped = mapLegacyState(original);
      const roundTrip = mapToLegacyState(mapped.lifecycle, mapped.execution);
      expect(roundTrip).toBe(SessionState.INITIALIZING); // READY maps to INITIALIZING in new model
    });

    it('should maintain consistency for RUNNING state (legacy → new → legacy)', () => {
      const original = SessionState.RUNNING;
      const mapped = mapLegacyState(original);
      const roundTrip = mapToLegacyState(mapped.lifecycle, mapped.execution);
      expect(roundTrip).toBe(original);
    });

    it('should maintain consistency for PAUSED state (legacy → new → legacy)', () => {
      const original = SessionState.PAUSED;
      const mapped = mapLegacyState(original);
      const roundTrip = mapToLegacyState(mapped.lifecycle, mapped.execution);
      expect(roundTrip).toBe(original);
    });

    it('should maintain consistency for STOPPED state (legacy → new → legacy)', () => {
      const original = SessionState.STOPPED;
      const mapped = mapLegacyState(original);
      const roundTrip = mapToLegacyState(mapped.lifecycle, mapped.execution);
      expect(roundTrip).toBe(original);
    });

    it('should maintain consistency for ERROR state (legacy → new → legacy)', () => {
      const original = SessionState.ERROR;
      const mapped = mapLegacyState(original);
      const roundTrip = mapToLegacyState(mapped.lifecycle, mapped.execution);
      expect(roundTrip).toBe(original);
    });
  });

  describe('Enums', () => {
    describe('DebugLanguage', () => {
      it('should define PYTHON language', () => {
        expect(DebugLanguage.PYTHON).toBe('python');
      });

      it('should define MOCK language for testing', () => {
        expect(DebugLanguage.MOCK).toBe('mock');
      });

      it('should have exactly 5 language options including javascript, rust, and go', () => {
        const languages = Object.values(DebugLanguage);
        expect(languages).toHaveLength(5);
        expect(languages).toContain('javascript');
        expect(languages).toContain('rust');
        expect(languages).toContain('go');
      });
    });

    describe('SessionLifecycleState', () => {
      it('should define all lifecycle states', () => {
        expect(SessionLifecycleState.CREATED).toBe('created');
        expect(SessionLifecycleState.ACTIVE).toBe('active');
        expect(SessionLifecycleState.TERMINATED).toBe('terminated');
      });

      it('should have exactly 3 lifecycle states', () => {
        const states = Object.values(SessionLifecycleState);
        expect(states).toHaveLength(3);
      });
    });

    describe('ExecutionState', () => {
      it('should define all execution states', () => {
        expect(ExecutionState.INITIALIZING).toBe('initializing');
        expect(ExecutionState.RUNNING).toBe('running');
        expect(ExecutionState.PAUSED).toBe('paused');
        expect(ExecutionState.TERMINATED).toBe('terminated');
        expect(ExecutionState.ERROR).toBe('error');
      });

      it('should have exactly 5 execution states', () => {
        const states = Object.values(ExecutionState);
        expect(states).toHaveLength(5);
      });
    });

    describe('SessionState (legacy)', () => {
      it('should define all legacy session states', () => {
        expect(SessionState.CREATED).toBe('created');
        expect(SessionState.INITIALIZING).toBe('initializing');
        expect(SessionState.READY).toBe('ready');
        expect(SessionState.RUNNING).toBe('running');
        expect(SessionState.PAUSED).toBe('paused');
        expect(SessionState.STOPPED).toBe('stopped');
        expect(SessionState.ERROR).toBe('error');
      });

      it('should have exactly 7 legacy states', () => {
        const states = Object.values(SessionState);
        expect(states).toHaveLength(7);
      });
    });
  });

  describe('State mapping edge cases', () => {
    it('should handle all possible lifecycle and execution combinations', () => {
      const lifecycleStates = Object.values(SessionLifecycleState);
      const executionStates = [...Object.values(ExecutionState), undefined];
      
      // Test all combinations don't throw errors
      lifecycleStates.forEach(lifecycle => {
        executionStates.forEach(execution => {
          expect(() => mapToLegacyState(lifecycle, execution)).not.toThrow();
        });
      });
    });

    it('should handle all legacy states without throwing', () => {
      const legacyStates = Object.values(SessionState);
      
      legacyStates.forEach(state => {
        expect(() => mapLegacyState(state)).not.toThrow();
      });
    });
  });

  describe('Type definitions and interfaces', () => {
    it('should export all expected types', () => {
      // This test verifies that TypeScript compilation succeeds with all the exported types
      // The actual type checking is done at compile time, but we can verify the structure
      
      // Example type usage to ensure they're exported correctly
      const mockSession: import('@debugmcp/shared').DebugSession = {
        id: 'test-id',
        language: DebugLanguage.PYTHON,
        name: 'test-session',
        state: SessionState.CREATED,
        sessionLifecycle: SessionLifecycleState.CREATED,
        executionState: undefined,
        currentFile: undefined,
        currentLine: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        breakpoints: new Map()
      };

      expect(mockSession.id).toBe('test-id');
    });
  });
});
