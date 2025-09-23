/**
 * Tests for automatic mock generation and validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockFromInterface,
  validateMockInterface,
  createValidatedMock,
  createEventEmitterMock
} from './auto-mock.js';
import { EventEmitter } from 'events';

// Test classes for validation
class TestClass {
  public property: string = 'test';
  private _privateProperty: string = 'private';

  public method(arg1: string, arg2: number): string {
    return `${arg1}-${arg2}`;
  }

  public async asyncMethod(): Promise<void> {
    await Promise.resolve();
  }

  public get getter(): string {
    return this.property;
  }

  public set setter(value: string) {
    this.property = value;
  }

  private _privateMethod(): void {
    // Private method
  }

  public isActive(): boolean {
    return true;
  }

  public hasFeature(): boolean {
    return false;
  }

  public getConfig(): object {
    return {};
  }
}

class ExtendedClass extends TestClass {
  public extendedMethod(): void {
    // Extended method
  }
}

class TestEventEmitter extends EventEmitter {
  public customMethod(): string {
    return 'custom';
  }

  public start(): void {
    this.emit('started');
  }
}

describe('Auto Mock Generation', () => {
  describe('createMockFromInterface', () => {
    it('should create mock with all public methods', () => {
      const mock = createMockFromInterface(TestClass);

      expect(mock.method).toBeDefined();
      expect(vi.isMockFunction(mock.method)).toBe(true);
      expect(mock.asyncMethod).toBeDefined();
      expect(vi.isMockFunction(mock.asyncMethod)).toBe(true);
    });

    it('should handle boolean methods with sensible defaults', () => {
      const mock = createMockFromInterface(TestClass);

      expect(mock.isActive()).toBe(false);
      expect(mock.hasFeature()).toBe(false);
    });

    it('should handle getter methods with undefined default', () => {
      const mock = createMockFromInterface(TestClass);

      expect(mock.getConfig()).toBeUndefined();
    });

    it('should exclude methods based on regex pattern', () => {
      const mock = createMockFromInterface(TestClass, {
        excludeMethods: /^_/
      });

      expect(mock.method).toBeDefined();
      expect(mock._privateMethod).toBeUndefined();
    });

    it('should exclude specific methods by name', () => {
      const mock = createMockFromInterface(TestClass, {
        excludeMethods: ['asyncMethod']
      });

      expect(mock.method).toBeDefined();
      expect(mock.asyncMethod).toBeUndefined();
    });

    it('should apply default return values', () => {
      const mock = createMockFromInterface(TestClass, {
        defaultReturns: {
          method: 'mocked-result',
          isActive: true
        }
      });

      expect(mock.method('test', 1)).toBe('mocked-result');
      expect(mock.isActive()).toBe(true);
    });

    it('should handle inherited methods', () => {
      const mock = createMockFromInterface(ExtendedClass);

      expect(mock.method).toBeDefined();
      expect(mock.extendedMethod).toBeDefined();
      expect(vi.isMockFunction(mock.method)).toBe(true);
      expect(vi.isMockFunction(mock.extendedMethod)).toBe(true);
    });

    it('should skip inherited methods when requested', () => {
      const mock = createMockFromInterface(ExtendedClass, {
        includeInherited: false
      });

      // Should only have ExtendedClass's own method
      expect(mock.extendedMethod).toBeDefined();
    });
  });

  describe('validateMockInterface', () => {
    it('should pass validation for complete mock', () => {
      const mock = {
        property: undefined,
        method: vi.fn(),
        asyncMethod: vi.fn(),
        getter: undefined,
        setter: undefined,
        isActive: vi.fn().mockReturnValue(false),
        hasFeature: vi.fn().mockReturnValue(false),
        getConfig: vi.fn(),
        _privateMethod: vi.fn() // Including private for completeness
      };

      expect(() => {
        validateMockInterface(mock, TestClass, 'TestClass');
      }).not.toThrow();
    });

    it('should fail validation for missing public methods', () => {
      const incompleteMock = {
        property: undefined,
        // Missing method!
        asyncMethod: vi.fn(),
        isActive: vi.fn()
      };

      expect(() => {
        validateMockInterface(incompleteMock, TestClass, 'TestClass');
      }).toThrow(/Missing member 'method'/);
    });

    it('should warn about missing private methods but not fail', () => {
      const mockWithoutPrivate = {
        property: undefined,
        method: vi.fn(),
        asyncMethod: vi.fn(),
        getter: undefined,
        setter: undefined,
        isActive: vi.fn(),
        hasFeature: vi.fn(),
        getConfig: vi.fn()
        // Missing _privateMethod
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validateMockInterface(mockWithoutPrivate, TestClass, 'TestClass');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Private member \'_privateMethod\'')
      );

      consoleSpy.mockRestore();
    });

    it('should fail when method is wrong type', () => {
      const wrongTypeMock = {
        property: undefined,
        method: 'not-a-function', // Should be a function!
        asyncMethod: vi.fn(),
        getter: undefined,
        setter: undefined,
        isActive: vi.fn(),
        hasFeature: vi.fn(),
        getConfig: vi.fn(),
        _privateMethod: vi.fn()
      };

      expect(() => {
        validateMockInterface(wrongTypeMock, TestClass, 'TestClass');
      }).toThrow(/Member 'method' should be a function/);
    });

    it('should warn about extra members in mock', () => {
      const mockWithExtra = {
        property: undefined,
        method: vi.fn(),
        asyncMethod: vi.fn(),
        getter: undefined,
        setter: undefined,
        isActive: vi.fn(),
        hasFeature: vi.fn(),
        getConfig: vi.fn(),
        _privateMethod: vi.fn(),
        extraMethod: vi.fn() // Extra method not in real class
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validateMockInterface(mockWithExtra, TestClass, 'TestClass');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mock has extra member \'extraMethod\'')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createValidatedMock', () => {
    it('should create and validate mock in one step', () => {
      const mock = createValidatedMock(TestClass, 'TestClass');

      expect(mock.method).toBeDefined();
      expect(vi.isMockFunction(mock.method)).toBe(true);
      expect(mock.asyncMethod).toBeDefined();
      expect(vi.isMockFunction(mock.asyncMethod)).toBe(true);
    });

    it('should apply options and still validate', () => {
      const mock = createValidatedMock(TestClass, 'TestClass', {
        defaultReturns: {
          method: 'test-return'
        }
      });

      expect(mock.method('arg', 1)).toBe('test-return');
    });
  });

  describe('createEventEmitterMock', () => {
    it('should create mock with EventEmitter methods', () => {
      const mock = createEventEmitterMock();

      expect(mock.on).toBeDefined();
      expect(mock.once).toBeDefined();
      expect(mock.emit).toBeDefined();
      expect(mock.off).toBeDefined();
      expect(mock.removeListener).toBeDefined();
      expect(mock.removeAllListeners).toBeDefined();

      // Check chaining works
      expect(mock.on('event', () => {})).toBe(mock);
    });

    it('should merge additional methods', () => {
      const mock = createEventEmitterMock<TestEventEmitter>({
        customMethod: vi.fn().mockReturnValue('mocked'),
        start: vi.fn()
      });

      expect(mock.customMethod()).toBe('mocked');
      expect(mock.start).toBeDefined();
      expect(vi.isMockFunction(mock.start)).toBe(true);
    });

    it('should work with validateMockInterface for EventEmitter classes', () => {
      const mock = createEventEmitterMock<TestEventEmitter>({
        customMethod: vi.fn(),
        start: vi.fn()
      });

      // This should pass since EventEmitter methods are part of the mock
      expect(() => {
        validateMockInterface(mock, TestEventEmitter, 'TestEventEmitter');
      }).not.toThrow();
    });
  });

  describe('Integration with real classes', () => {
    it('should create valid mock for ProxyManager-like class', () => {
      // Simulate a ProxyManager-like class
      class ProxyManagerLike extends EventEmitter {
        public async start(config: any): Promise<void> {
          // Start logic
        }

        public async stop(): Promise<void> {
          // Stop logic
        }

        public async sendDapRequest(command: string, args?: any): Promise<any> {
          // Send request logic
        }

        public isRunning(): boolean {
          return false;
        }

        public getCurrentThreadId(): number | null {
          return null;
        }
      }

      const mock = createEventEmitterMock<ProxyManagerLike>({
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        sendDapRequest: vi.fn().mockResolvedValue({ success: true }),
        isRunning: vi.fn().mockReturnValue(false),
        getCurrentThreadId: vi.fn().mockReturnValue(null)
      });

      // Validate it matches the interface
      expect(() => {
        validateMockInterface(mock, ProxyManagerLike, 'ProxyManagerLike');
      }).not.toThrow();

      // Verify it works
      expect(mock.isRunning()).toBe(false);
      expect(mock.getCurrentThreadId()).toBeNull();
    });
  });
});