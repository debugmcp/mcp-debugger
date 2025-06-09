# MCP Debug Server - Testing Guide

This guide covers how to write and run tests for the MCP Debug Server project, which maintains 90%+ test coverage.

## Test Framework

The project uses **Vitest** as the test runner, chosen for its:
- Fast execution with native ESM support
- Compatible API with Jest
- Built-in TypeScript support
- Excellent watch mode
- Snapshot testing capabilities

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (recommended for development)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run a specific test file
npm test -- tests/unit/session/session-manager.test.ts

# Run tests matching a pattern
npm test -- --grep "ProxyManager"
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
npm run coverage:report
# Opens in browser: coverage/index.html

# Check coverage thresholds
npm run coverage:check
```

Current coverage thresholds (from `vitest.config.ts`):
- Statements: 90%
- Branches: 85%
- Functions: 90%
- Lines: 90%

## Writing Tests

### Test File Organization

Tests mirror the source code structure:

```
src/session/session-manager.ts
→ tests/unit/session/session-manager.test.ts

src/proxy/proxy-manager.ts
→ tests/unit/proxy/proxy-manager.test.ts
→ tests/unit/proxy/proxy-manager-lifecycle.test.ts
→ tests/unit/proxy/proxy-manager-error.test.ts
```

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentToTest } from '../../../src/component-to-test.js';

describe('ComponentToTest', () => {
  let component: ComponentToTest;
  let mockDependency: MockType;

  beforeEach(() => {
    // Setup before each test
    mockDependency = createMockDependency();
    component = new ComponentToTest(mockDependency);
  });

  afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
    vi.useRealTimers(); // If using fake timers
  });

  describe('methodName', () => {
    it('should handle normal case', async () => {
      // Arrange
      const input = 'test-input';
      const expectedOutput = 'expected-output';
      
      // Act
      const result = await component.methodName(input);
      
      // Assert
      expect(result).toBe(expectedOutput);
      expect(mockDependency.someMethod).toHaveBeenCalledWith(input);
    });

    it('should handle error case', async () => {
      // Arrange
      mockDependency.someMethod.mockRejectedValue(new Error('Test error'));
      
      // Act & Assert
      await expect(component.methodName('input'))
        .rejects.toThrow('Test error');
    });
  });
});
```

### Testing Patterns

#### 1. Mocking Dependencies

```typescript
// Using test utilities
import { createMockLogger, createMockFileSystem } from '../../utils/test-utils.js';

const mockLogger = createMockLogger();
const mockFileSystem = createMockFileSystem();

// Verify mock calls
expect(mockLogger.info).toHaveBeenCalledWith(
  '[Component] Operation completed',
  { sessionId: 'test-123' }
);
```

#### 2. Testing Async Operations

```typescript
it('should handle async operation', async () => {
  // Setup promise that will resolve
  const resultPromise = Promise.resolve('success');
  vi.mocked(mockService.fetchData).mockReturnValue(resultPromise);
  
  // Test async method
  const result = await component.processData();
  
  // Verify
  expect(result).toBe('success');
});
```

#### 3. Testing with Fake Timers

```typescript
it('should timeout after specified duration', async () => {
  vi.useFakeTimers();
  
  try {
    // Start operation that has timeout
    const operationPromise = component.operationWithTimeout();
    
    // Create expectation before advancing time
    const expectPromise = expect(operationPromise)
      .rejects.toThrow('Operation timed out');
    
    // Advance time
    await vi.advanceTimersByTimeAsync(5001);
    
    // Verify timeout
    await expectPromise;
  } finally {
    vi.useRealTimers();
  }
});
```

#### 4. Testing Event Emissions

```typescript
it('should emit events correctly', async () => {
  // Create promise to capture event
  const eventPromise = new Promise<{ data: string }>((resolve) => {
    component.once('data-ready', (data) => resolve({ data }));
  });
  
  // Trigger action that emits event
  component.processData();
  
  // Verify event
  const result = await eventPromise;
  expect(result.data).toBe('processed');
});
```

#### 5. Testing with Fake Process Implementation

```typescript
import { FakeProxyProcessLauncher } from '../../implementations/test/fake-process-launcher.js';

it('should handle process messages', async () => {
  const fakeLauncher = new FakeProxyProcessLauncher();
  
  // Prepare fake behavior
  fakeLauncher.prepareProxy((proxy) => {
    setTimeout(() => {
      proxy.simulateMessage({
        type: 'status',
        status: 'initialized'
      });
    }, 100);
  });
  
  const manager = new ProxyManager(fakeLauncher, mockFs, mockLogger);
  await manager.start(config);
  
  // Verify process was launched
  expect(fakeLauncher.launchedProxies).toHaveLength(1);
});
```

### Testing Error Scenarios

```typescript
describe('error handling', () => {
  it('should handle file not found', async () => {
    // Mock file system to simulate error
    vi.mocked(mockFileSystem.pathExists).mockResolvedValue(false);
    
    await expect(component.loadFile('missing.txt'))
      .rejects.toThrow('File not found: missing.txt');
  });

  it('should clean up on error', async () => {
    // Simulate error during operation
    vi.mocked(mockService.connect).mockRejectedValue(
      new Error('Connection failed')
    );
    
    await expect(component.initialize()).rejects.toThrow();
    
    // Verify cleanup
    expect(component.isInitialized()).toBe(false);
    expect(mockService.disconnect).toHaveBeenCalled();
  });

  it('should use centralized error messages', async () => {
    await expect(component.operationWithTimeout())
      .rejects.toThrow(ErrorMessages.operationTimeout(30));
  });
});
```

### Integration Testing

Integration tests use real implementations where possible:

```typescript
// tests/integration/python_debug_workflow.test.ts
import { createRealDependencies } from '../utils/integration-helpers.js';

describe('Python Debug Workflow', () => {
  let sessionManager: SessionManager;
  let testPort: number;

  beforeEach(async () => {
    // Use real implementations
    const deps = await createRealDependencies();
    testPort = await TestPortManager.getNextPort();
    
    sessionManager = new SessionManager(
      { logDirBase: './test-logs' },
      deps
    );
  });

  it('should debug Python script end-to-end', async () => {
    // Create session
    const session = await sessionManager.createSession({
      language: DebugLanguage.PYTHON,
      name: 'Integration Test'
    });

    // Set breakpoint
    await sessionManager.setBreakpoint(
      session.id,
      'test-script.py',
      10
    );

    // Start debugging
    const result = await sessionManager.startDebugging(
      session.id,
      'test-script.py'
    );

    expect(result.success).toBe(true);
    
    // ... continue with full workflow
  });
});
```

## Test Utilities

### Mock Creation Helpers

Located in `tests/utils/test-utils.ts`:

```typescript
export function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  };
}

export function createMockFileSystem(): IFileSystem {
  return {
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    pathExists: vi.fn().mockResolvedValue(true),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    // ... all required methods
  };
}
```

### Test Fixtures

Located in `tests/fixtures/`:

```typescript
// python-scripts.ts
export const SIMPLE_SCRIPT = `
def main():
    x = 10
    y = 20
    result = x + y
    print(f"Result: {result}")
    
if __name__ == "__main__":
    main()
`;

export const SCRIPT_WITH_LOOP = `
def calculate():
    total = 0
    for i in range(10):
        total += i
    return total
`;
```

### Port Management

For tests that need network ports:

```typescript
import { TestPortManager } from '../utils/port-manager.js';

const port = TestPortManager.getNextPort(); // Returns unique port
// Use port for test...
TestPortManager.release(port); // Optional cleanup
```

## Debugging Tests

### VS Code Debugging

1. Set breakpoint in test file
2. Open test file
3. Press F5 or use "Debug Tests" launch configuration
4. Step through test execution

### Console Logging

```typescript
it('should process data', async () => {
  console.log('Input:', testData);
  
  const result = await component.process(testData);
  
  console.log('Output:', result);
  console.log('Mock calls:', mockService.mock.calls);
  
  expect(result).toBeDefined();
});
```

### Vitest UI Mode

```bash
# Run tests with UI
npm run test:ui
```

This opens a browser with:
- Test execution visualization
- Code coverage overlay
- Test filtering and search
- Snapshot management

## Best Practices

### 1. Test Naming

Use descriptive test names that explain what and why:

```typescript
// ❌ Bad
it('should work', () => {});
it('test error', () => {});

// ✅ Good
it('should return empty array when no sessions exist', () => {});
it('should throw timeout error when adapter does not respond within 30s', () => {});
```

### 2. Test Organization

Group related tests:

```typescript
describe('SessionManager', () => {
  describe('initialization', () => {
    it('should create log directory', () => {});
    it('should validate dependencies', () => {});
  });
  
  describe('session lifecycle', () => {
    describe('createSession', () => {
      it('should generate unique session ID', () => {});
      it('should set initial state to CREATED', () => {});
    });
    
    describe('closeSession', () => {
      it('should cleanup resources', () => {});
      it('should handle already closed session', () => {});
    });
  });
});
```

### 3. Avoid Test Interdependence

Each test should be independent:

```typescript
// ❌ Bad - tests depend on order
let sharedSession: Session;

it('should create session', () => {
  sharedSession = createSession();
});

it('should use session', () => {
  // Fails if previous test didn't run
  expect(sharedSession.id).toBeDefined();
});

// ✅ Good - independent tests
it('should create session', () => {
  const session = createSession();
  expect(session.id).toBeDefined();
});

it('should process session', () => {
  const session = createSession();
  const result = processSession(session);
  expect(result).toBeDefined();
});
```

### 4. Use Factories for Complex Objects

```typescript
function createTestSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-123',
    state: SessionState.CREATED,
    language: DebugLanguage.PYTHON,
    breakpoints: new Map(),
    ...overrides
  };
}

// Usage
it('should handle paused session', () => {
  const session = createTestSession({ state: SessionState.PAUSED });
  // ... test logic
});
```

### 5. Test Both Success and Failure Paths

```typescript
describe('file operations', () => {
  it('should read file successfully', async () => {
    mockFs.readFile.mockResolvedValue('content');
    const result = await component.readConfig();
    expect(result).toBe('content');
  });

  it('should handle file read error', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
    await expect(component.readConfig())
      .rejects.toThrow('Configuration file not found');
  });
});
```

## Common Issues and Solutions

### Issue: Flaky Timing Tests

**Problem**: Tests fail intermittently due to timing
**Solution**: Use fake timers or increase timeouts

```typescript
// Use fake timers for deterministic tests
vi.useFakeTimers();
await vi.advanceTimersByTimeAsync(1000);

// Or increase timeout for integration tests
it('should complete within timeout', async () => {
  await expect(longOperation()).resolves.toBeDefined();
}, 10000); // 10 second timeout
```

### Issue: Memory Leaks in Tests

**Problem**: Tests consume increasing memory
**Solution**: Proper cleanup in afterEach

```typescript
afterEach(async () => {
  // Close all sessions
  await sessionManager.closeAllSessions();
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Reset singletons
  SingletonService.reset();
  
  // Clear timers
  vi.useRealTimers();
});
```

### Issue: Cannot Mock ES Modules

**Problem**: Mocking ES module imports
**Solution**: Use vi.mock with factory

```typescript
vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn()
  }))
}));
```

## Summary

Writing good tests for the MCP Debug Server:
1. Use descriptive test names
2. Keep tests independent and focused
3. Mock external dependencies
4. Test both success and error paths
5. Clean up resources properly
6. Use test utilities and helpers
7. Maintain high coverage standards

Remember: Tests are documentation that never goes out of date!
