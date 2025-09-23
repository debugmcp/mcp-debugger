/**
 * Automatic mock generation utilities
 *
 * Provides tools to automatically generate mocks from interfaces
 * and validate that mocks match their real implementations.
 */

import { vi } from 'vitest';

/**
 * Creates a mock object from a real implementation or class prototype.
 * All methods become vi.fn() mocks, all properties start as undefined.
 *
 * @param target The real implementation or class to mock
 * @param options Configuration options for mock generation
 * @returns A mock object with the same interface as the target
 */
export function createMockFromInterface<T extends object>(
  target: T | (new (...args: any[]) => T),
  options: {
    /**
     * Methods to exclude from mocking (e.g., private methods starting with _)
     */
    excludeMethods?: (keyof T)[] | RegExp;
    /**
     * Default return values for specific methods
     */
    defaultReturns?: Partial<{ [K in keyof T]: any }>;
    /**
     * Whether to include inherited methods from prototype chain
     */
    includeInherited?: boolean;
  } = {}
): T & { [K in keyof T]: T[K] extends (...args: any[]) => any ? jest.Mock : T[K] } {
  const mock = {} as any;
  const {
    excludeMethods = [],
    defaultReturns = {},
    includeInherited = true
  } = options;

  // Handle both instances and constructors
  let instance: any;
  let proto: any;

  if (typeof target === 'function') {
    // It's a constructor
    proto = target.prototype;
    instance = proto;
  } else {
    // It's an instance
    instance = target;
    proto = Object.getPrototypeOf(target);
  }

  // Collect all property names
  const propertyNames = new Set<string>();

  // Add own properties
  Object.getOwnPropertyNames(instance).forEach(name => propertyNames.add(name));

  // Add prototype properties if requested
  if (includeInherited && proto) {
    Object.getOwnPropertyNames(proto).forEach(name => propertyNames.add(name));

    // Walk up the prototype chain
    let currentProto = Object.getPrototypeOf(proto);
    while (currentProto && currentProto !== Object.prototype && includeInherited) {
      Object.getOwnPropertyNames(currentProto).forEach(name => propertyNames.add(name));
      currentProto = Object.getPrototypeOf(currentProto);
    }
  }

  // Process each property
  propertyNames.forEach(propName => {
    // Skip constructor
    if (propName === 'constructor') return;

    // Check if excluded
    if (excludeMethods instanceof RegExp) {
      if (excludeMethods.test(propName)) return;
    } else if (excludeMethods.includes(propName as keyof T)) {
      return;
    }

    // Get the property descriptor
    let descriptor = Object.getOwnPropertyDescriptor(instance, propName) ||
                    Object.getOwnPropertyDescriptor(proto, propName);

    if (!descriptor) {
      // Look up the prototype chain
      let currentProto = proto;
      while (currentProto && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(currentProto, propName);
        currentProto = Object.getPrototypeOf(currentProto);
      }
    }

    // Determine property type and create mock
    if (descriptor) {
      if (typeof descriptor.value === 'function') {
        // It's a method - create a mock function
        const defaultReturn = defaultReturns[propName as keyof T];
        if (defaultReturn !== undefined) {
          mock[propName] = vi.fn().mockReturnValue(defaultReturn);
        } else if (propName.startsWith('get')) {
          // Getter-like method, return undefined by default
          mock[propName] = vi.fn().mockReturnValue(undefined);
        } else if (propName.startsWith('is') || propName.startsWith('has')) {
          // Boolean-returning method
          mock[propName] = vi.fn().mockReturnValue(false);
        } else {
          mock[propName] = vi.fn();
        }
      } else if (descriptor.get || descriptor.set) {
        // It's a getter/setter
        Object.defineProperty(mock, propName, {
          get: descriptor.get ? vi.fn().mockReturnValue(undefined) : undefined,
          set: descriptor.set ? vi.fn() : undefined,
          enumerable: descriptor.enumerable,
          configurable: true
        });
      } else {
        // It's a regular property
        mock[propName] = undefined;
      }
    }
  });

  return mock;
}

/**
 * Validates that a mock object matches the interface of a real implementation.
 * Throws an error if there are missing methods or property mismatches.
 *
 * @param mock The mock object to validate
 * @param real The real implementation to compare against
 * @param interfaceName Name for error reporting
 */
export function validateMockInterface<T extends object>(
  mock: any,
  real: T | (new (...args: any[]) => T),
  interfaceName: string
): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get the real instance or prototype
  let realInstance: any;
  if (typeof real === 'function') {
    realInstance = real.prototype;
  } else {
    realInstance = real;
  }

  // Collect all real methods and properties
  const realMembers = new Set<string>();
  let currentProto = realInstance;
  while (currentProto && currentProto !== Object.prototype) {
    Object.getOwnPropertyNames(currentProto).forEach(name => {
      if (name !== 'constructor') {
        realMembers.add(name);
      }
    });
    currentProto = Object.getPrototypeOf(currentProto);
  }

  // Check each real member exists in mock
  realMembers.forEach(memberName => {
    if (!(memberName in mock)) {
      // Check if it's a private member (starts with _)
      if (memberName.startsWith('_')) {
        warnings.push(`Private member '${memberName}' not in mock (this may be intentional)`);
      } else {
        errors.push(`Missing member '${memberName}'`);
      }
    } else {
      // Check type compatibility
      const realType = typeof realInstance[memberName];
      const mockType = typeof mock[memberName];

      if (realType === 'function' && mockType !== 'function') {
        errors.push(`Member '${memberName}' should be a function but is ${mockType}`);
      }

      // Check function arity (number of parameters)
      if (realType === 'function' && mockType === 'function') {
        const realFunc = realInstance[memberName];
        const mockFunc = mock[memberName];

        if (realFunc.length !== mockFunc.length && !vi.isMockFunction(mockFunc)) {
          warnings.push(
            `Function '${memberName}' has different arity: ` +
            `real has ${realFunc.length} params, mock has ${mockFunc.length}`
          );
        }
      }
    }
  });

  // Check for extra members in mock
  Object.keys(mock).forEach(mockMember => {
    if (!realMembers.has(mockMember)) {
      warnings.push(`Mock has extra member '${mockMember}' not in real implementation`);
    }
  });

  // Report errors and warnings
  if (warnings.length > 0) {
    console.warn(`Mock validation warnings for ${interfaceName}:\n  - ${warnings.join('\n  - ')}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Mock validation failed for ${interfaceName}:\n  - ${errors.join('\n  - ')}\n` +
      `Use createMockFromInterface() to ensure mock matches the real implementation.`
    );
  }
}

/**
 * Creates a validated mock that is guaranteed to match the real interface.
 * Combines mock creation with validation.
 *
 * @param realImplementation The real class or instance to mock
 * @param interfaceName Name for error reporting
 * @param options Mock generation options
 * @returns A validated mock object
 */
export function createValidatedMock<T extends object>(
  realImplementation: T | (new (...args: any[]) => T),
  interfaceName: string,
  options?: Parameters<typeof createMockFromInterface>[1]
): ReturnType<typeof createMockFromInterface<T>> {
  const mock = createMockFromInterface(realImplementation, options);

  // Validate immediately
  validateMockInterface(mock, realImplementation, interfaceName);

  return mock;
}

/**
 * Helper to create a mock that extends EventEmitter
 * Many classes in the codebase extend EventEmitter
 */
export function createEventEmitterMock<T extends object>(
  additionalMethods: Partial<T> = {}
): T & {
  on: jest.Mock;
  once: jest.Mock;
  emit: jest.Mock;
  off: jest.Mock;
  removeListener: jest.Mock;
  removeAllListeners: jest.Mock;
  setMaxListeners: jest.Mock;
  getMaxListeners: jest.Mock;
  addListener: jest.Mock;
  prependListener: jest.Mock;
  prependOnceListener: jest.Mock;
  listeners: jest.Mock;
  rawListeners: jest.Mock;
  listenerCount: jest.Mock;
  eventNames: jest.Mock;
} {
  return {
    // Core EventEmitter methods
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnValue(true),
    off: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn().mockReturnThis(),

    // Additional EventEmitter methods
    setMaxListeners: vi.fn().mockReturnThis(),
    getMaxListeners: vi.fn().mockReturnValue(10),
    addListener: vi.fn().mockReturnThis(),
    prependListener: vi.fn().mockReturnThis(),
    prependOnceListener: vi.fn().mockReturnThis(),
    listeners: vi.fn().mockReturnValue([]),
    rawListeners: vi.fn().mockReturnValue([]),
    listenerCount: vi.fn().mockReturnValue(0),
    eventNames: vi.fn().mockReturnValue([]),

    ...additionalMethods
  } as any;
}

/**
 * Decorator to automatically validate mocks in tests
 * Use in beforeEach to ensure mocks stay in sync
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   mockProxyManager = createEventEmitterMock({
 *     start: vi.fn(),
 *     stop: vi.fn()
 *   });
 *
 *   autoValidateMock(mockProxyManager, ProxyManager, 'ProxyManager');
 * });
 * ```
 */
export function autoValidateMock<T extends object>(
  mock: any,
  realClass: new (...args: any[]) => T,
  className: string
): void {
  // Store original mock for restoration
  const originalMock = { ...mock };

  // Add validation that runs on first use
  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      // Validate on first method access
      if (!target._validated) {
        try {
          validateMockInterface(originalMock, realClass, className);
          target._validated = true;
        } catch (error) {
          console.error(`Mock validation failed on first use: ${error}`);
          throw error;
        }
      }
      return Reflect.get(target, prop, receiver);
    }
  };

  // Return a proxy that validates on first use
  return new Proxy(mock, handler);
}