/**
 * Unit tests for AdapterRegistry
 * 
 * @since 2.0.0
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  AdapterRegistry, 
  getAdapterRegistry, 
  resetAdapterRegistry 
} from '../../../../src/adapters/adapter-registry.js';
import { 
  IAdapterFactory,
  AdapterNotFoundError,
  DuplicateRegistrationError,
  FactoryValidationError
} from '@debugmcp/shared';
import { MockAdapterFactory } from '../../../../src/adapters/mock/mock-adapter-factory.js';
import { MockDebugAdapter } from '../../../../src/adapters/mock/mock-debug-adapter.js';
import { DebugLanguage } from '@debugmcp/shared';

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;
  let mockFactory: MockAdapterFactory;

  beforeEach(() => {
    registry = new AdapterRegistry({ validateOnRegister: false });
    mockFactory = new MockAdapterFactory();
  });

  afterEach(() => {
    // Clean up any created adapters
    registry.disposeAll();
  });

  describe('register', () => {
    it('should register a new adapter factory', async () => {
      await registry.register('mock', mockFactory);
      
      expect(registry.isLanguageSupported('mock')).toBe(true);
      expect(registry.getSupportedLanguages()).toContain('mock');
    });

    it('should throw error when registering duplicate language without override', async () => {
      await registry.register('mock', mockFactory);
      
      await expect(registry.register('mock', mockFactory))
        .rejects.toThrow(DuplicateRegistrationError);
    });

    it('should allow override when configured', async () => {
      const registryWithOverride = new AdapterRegistry({ 
        allowOverride: true,
        validateOnRegister: false 
      });
      
      await registryWithOverride.register('mock', mockFactory);
      await registryWithOverride.register('mock', mockFactory); // Should not throw
      
      expect(registryWithOverride.isLanguageSupported('mock')).toBe(true);
    });

    it('should validate factory when configured', async () => {
      const registryWithValidation = new AdapterRegistry({ 
        validateOnRegister: true 
      });
      
      // Mock factory validation passes by default
      await expect(registryWithValidation.register('mock', mockFactory))
        .resolves.not.toThrow();
    });

    it('should throw error when factory validation fails', async () => {
      const registryWithValidation = new AdapterRegistry({ 
        validateOnRegister: true 
      });
      
      // Create a factory that fails validation
      const failingFactory: IAdapterFactory = {
        createAdapter: vi.fn(),
        getMetadata: vi.fn().mockReturnValue({ language: 'fail' }),
        validate: vi.fn().mockResolvedValue({
          valid: false,
          errors: ['Test error'],
          warnings: []
        })
      };
      
      await expect(registryWithValidation.register('fail', failingFactory))
        .rejects.toThrow(FactoryValidationError);
    });
  });

  describe('unregister', () => {
    it('should unregister an adapter factory', async () => {
      await registry.register('mock', mockFactory);
      
      const result = registry.unregister('mock');
      
      expect(result).toBe(true);
      expect(registry.isLanguageSupported('mock')).toBe(false);
    });

    it('should return false when unregistering non-existent language', () => {
      const result = registry.unregister('nonexistent');
      
      expect(result).toBe(false);
    });

    it('should dispose all active adapters when unregistering', async () => {
      await registry.register('mock', mockFactory);
      
      // Create an adapter
      const adapter = await registry.create('mock', {
        sessionId: 'test-session',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      });
      
      const disposeSpy = vi.spyOn(adapter, 'dispose');
      
      registry.unregister('mock');
      
      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    beforeEach(async () => {
      await registry.register('mock', mockFactory);
    });

    it('should create an adapter instance', async () => {
      const adapter = await registry.create('mock', {
        sessionId: 'test-session',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      });
      
      expect(adapter).toBeInstanceOf(MockDebugAdapter);
      expect(adapter.language).toBe(DebugLanguage.MOCK);
    });

    it('should throw error for unsupported language', async () => {
      await expect(registry.create('python', {
        sessionId: 'test',
        executablePath: 'python',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: 'logs',
        scriptPath: 'test.py',
        launchConfig: {}
      })).rejects.toThrow(AdapterNotFoundError);
    });

    it('should enforce instance limit', async () => {
      const limitedRegistry = new AdapterRegistry({ 
        maxInstancesPerLanguage: 2,
        validateOnRegister: false 
      });
      await limitedRegistry.register('mock', mockFactory);
      
      // Create max instances
      await limitedRegistry.create('mock', {
        sessionId: 'test-1',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      });
      
      await limitedRegistry.create('mock', {
        sessionId: 'test-2',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1235,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      });
      
      // Third should fail
      await expect(limitedRegistry.create('mock', {
        sessionId: 'test-3',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1236,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      })).rejects.toThrow(/Maximum adapter instances/);
    });

    it('should track active adapters', async () => {
      expect(registry.getActiveAdapterCount()).toBe(0);
      
      await registry.create('mock', {
        sessionId: 'test-session',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      });
      
      expect(registry.getActiveAdapterCount()).toBe(1);
    });
  });

  describe('query methods', () => {
    beforeEach(async () => {
      await registry.register('mock', mockFactory);
    });

    it('should return supported languages', () => {
      const languages = registry.getSupportedLanguages();
      
      expect(languages).toEqual(['mock']);
    });

    it('should check if language is supported', () => {
      expect(registry.isLanguageSupported('mock')).toBe(true);
      expect(registry.isLanguageSupported('python')).toBe(false);
    });

    it('should return adapter info', () => {
      const info = registry.getAdapterInfo('mock');
      
      expect(info).toBeDefined();
      expect(info?.language).toBe(DebugLanguage.MOCK);
      expect(info?.displayName).toBe('Mock Debug Adapter');
      expect(info?.available).toBe(true);
    });

    it('should return undefined for non-existent adapter', () => {
      const info = registry.getAdapterInfo('nonexistent');
      
      expect(info).toBeUndefined();
    });

    it('should return all adapter info', () => {
      const allInfo = registry.getAllAdapterInfo();
      
      expect(allInfo.size).toBe(1);
      expect(allInfo.has('mock')).toBe(true);
    });
  });

  describe('lifecycle management', () => {
    it('should dispose all adapters', async () => {
      await registry.register('mock', mockFactory);
      
      const adapter1 = await registry.create('mock', {
        sessionId: 'test-1',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      });
      
      const adapter2 = await registry.create('mock', {
        sessionId: 'test-2',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1235,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      });
      
      const dispose1Spy = vi.spyOn(adapter1, 'dispose');
      const dispose2Spy = vi.spyOn(adapter2, 'dispose');
      
      await registry.disposeAll();
      
      expect(dispose1Spy).toHaveBeenCalled();
      expect(dispose2Spy).toHaveBeenCalled();
      expect(registry.getActiveAdapterCount()).toBe(0);
    });
  });

  describe('singleton pattern', () => {
    afterEach(() => {
      resetAdapterRegistry();
    });

    it('should return same instance', () => {
      const instance1 = getAdapterRegistry();
      const instance2 = getAdapterRegistry();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', async () => {
      const instance1 = getAdapterRegistry();
      await instance1.register('mock', mockFactory);
      
      resetAdapterRegistry();
      
      const instance2 = getAdapterRegistry();
      expect(instance2).not.toBe(instance1);
      expect(instance2.isLanguageSupported('mock')).toBe(false);
    });
  });

  describe('auto-dispose', () => {
    it('should auto-dispose disconnected adapters after timeout', async () => {
      const registry = new AdapterRegistry({
        validateOnRegister: false,
        autoDispose: true,
        autoDisposeTimeout: 100 // 100ms for testing
      });
      
      await registry.register('mock', mockFactory);
      
      const adapter = await registry.create('mock', {
        sessionId: 'test-session',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      });
      
      const disposeSpy = vi.spyOn(adapter, 'dispose');
      
      // Simulate adapter disconnecting
      adapter.emit('stateChanged', 'connected', 'disconnected');
      
      // Wait for auto-dispose timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should cancel auto-dispose if adapter reconnects', async () => {
      const registry = new AdapterRegistry({
        validateOnRegister: false,
        autoDispose: true,
        autoDisposeTimeout: 100 // 100ms for testing
      });
      
      await registry.register('mock', mockFactory);
      
      const adapter = await registry.create('mock', {
        sessionId: 'test-session',
        executablePath: 'node',
        adapterHost: 'localhost',
        adapterPort: 1234,
        logDir: 'logs',
        scriptPath: 'test.js',
        launchConfig: {}
      });
      
      const disposeSpy = vi.spyOn(adapter, 'dispose');
      
      // Simulate adapter disconnecting then reconnecting
      adapter.emit('stateChanged', 'connected', 'disconnected');
      await new Promise(resolve => setTimeout(resolve, 50));
      adapter.emit('stateChanged', 'disconnected', 'connected');
      
      // Wait past the auto-dispose timeout
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(disposeSpy).not.toHaveBeenCalled();
    });
  });
});
