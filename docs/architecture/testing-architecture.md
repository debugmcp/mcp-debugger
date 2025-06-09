# MCP Debug Server - Testing Architecture

This document describes the testing architecture, patterns, and strategies used in the MCP Debug Server project, which has achieved 90%+ test coverage.

## Test Framework and Configuration

### Technology Stack
- **Test Runner**: Vitest 1.3.1
- **Coverage Tool**: @vitest/coverage-v8
- **Assertion Library**: Vitest's built-in expect
- **Mocking**: Vitest's vi mocking utilities
- **Configuration**: `vitest.config.ts`

### Coverage Achievement
From `COVERAGE_SUMMARY.md`:
- **Overall Coverage**: 90.42%
- **Statements**: 6,517 of 7,208 (90.42%)
- **Branches**: 826 of 970 (85.15%)
- **Functions**: 704 of 782 (90.03%)
- **Lines**: 6,390 of 7,076 (90.31%)

## Test Organization

### Directory Structure
```
tests/
├── unit/                    # Unit tests (mirrors src/ structure)
│   ├── proxy/              # ProxyManager tests
│   ├── session/            # SessionManager tests
│   ├── dap-core/           # Functional core tests
│   └── ...
├── integration/            # Integration tests
│   ├── proxy-startup.test.ts
│   └── python_debug_workflow.test.ts
├── e2e/                    # End-to-end tests
│   └── debugpy-connection.test.ts
├── implementations/test/   # Fake implementations
├── mocks/                  # Shared mocks
└── utils/                  # Test utilities
```

## Key Testing Patterns

### 1. Fake Implementations Pattern

**Location**: `tests/implementations/test/fake-process-launcher.ts`

The project uses sophisticated fake implementations for testing process-spawning code:

```typescript
export class FakeProxyProcess extends EventEmitter implements IProxyProcess {
  pid: number;
  killed = false;
  private messageQueue: any[] = [];
  sentCommands: any[] = [];

  simulateMessage(message: any): void {
    this.emit('message', message);
  }

  simulateExit(code: number | null, signal?: string | null): void {
    this.emit('exit', code, signal);
  }

  sendCommand(command: any): void {
    this.sentCommands.push(command);
    if (typeof command === 'object') {
      this.emit('message', JSON.stringify(command));
    }
  }
}
```

This pattern enables testing complex process interactions without spawning real processes.

### 2. Test Lifecycle Management

**Example**: `tests/unit/proxy/proxy-manager-lifecycle.test.ts`

```typescript
describe('ProxyManager - Lifecycle', () => {
  let proxyManager: ProxyManager;
  let fakeLauncher: FakeProxyProcessLauncher;
  let mockLogger: ILogger;
  let mockFileSystem: IFileSystem;

  beforeEach(() => {
    fakeLauncher = new FakeProxyProcessLauncher();
    mockLogger = createMockLogger();
    mockFileSystem = createMockFileSystem();
    
    proxyManager = new ProxyManager(
      fakeLauncher,
      mockFileSystem,
      mockLogger
    );
  });

  afterEach(() => {
    vi.useRealTimers(); // Always restore real timers first
    vi.clearAllMocks();
    fakeLauncher.reset();
  });
});
```

Key practices:
- Fresh instances for each test
- Proper cleanup in afterEach
- Timer restoration when using fake timers

### 3. Async Testing with Timeouts

**Pattern**: Testing timeout scenarios with fake timers

```typescript
it('should handle initialization timeout', async () => {
  vi.useFakeTimers();
  
  try {
    // Start the async operation that will timeout
    const startPromise = proxyManager.start(defaultConfig);
    
    // Immediately attach rejection expectation
    const expectPromise = expect(startPromise).rejects.toThrow(
      ErrorMessages.proxyInitTimeout(30)
    );

    // Advance timers
    await vi.advanceTimersByTimeAsync(30001);

    // Await the expectation
    await expectPromise;
  } finally {
    vi.useRealTimers();
  }
});
```

This pattern ensures proper handling of async operations with timeouts.

### 4. Event Testing Pattern

**Example**: Testing event emissions

```typescript
it('should emit exit event when proxy process exits', async () => {
  // Setup
  fakeLauncher.prepareProxy((proxy) => {
    setTimeout(() => {
      proxy.simulateMessage({
        type: 'status',
        sessionId: defaultConfig.sessionId,
        status: 'adapter_configured_and_launched'
      });
    }, 50);
  });

  await proxyManager.start(defaultConfig);

  // Create promise to capture event
  const exitPromise = new Promise<{ code: number; signal?: string }>((resolve) => {
    proxyManager.once('exit', (code, signal) => resolve({ code, signal }));
  });

  // Trigger event
  const fakeProxy = fakeLauncher.getLastLaunchedProxy()!;
  fakeProxy.simulateExit(0, 'SIGTERM');

  // Assert
  const result = await exitPromise;
  expect(result.code).toBe(0);
  expect(result.signal).toBe('SIGTERM');
});
```

### 5. Error Scenario Testing

**Example**: Testing error propagation

```typescript
it('should handle process spawn failure', async () => {
  // Mock file system to simulate proxy script not found
  vi.mocked(mockFileSystem.pathExists).mockResolvedValue(false);

  await expect(proxyManager.start(defaultConfig))
    .rejects.toThrow('Bootstrap worker script not found');
});
```

## Test Utilities

### Mock Creation Helpers

**Location**: `tests/utils/test-utils.ts`

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
    exists: vi.fn().mockResolvedValue(true),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    pathExists: vi.fn().mockResolvedValue(true),
    // ... other methods
  };
}
```

### Port Management

**Location**: `tests/utils/port-manager.ts`

Ensures tests don't conflict on network ports:

```typescript
export class TestPortManager {
  private static basePort = 30000;
  private static currentPort = TestPortManager.basePort;
  private static allocatedPorts = new Set<number>();

  static getNextPort(): number {
    const port = this.currentPort++;
    this.allocatedPorts.add(port);
    return port;
  }

  static reset(): void {
    this.currentPort = this.basePort;
    this.allocatedPorts.clear();
  }
}
```

## Integration Testing Strategy

### Python Debug Workflow Test

**Location**: `tests/integration/python_debug_workflow.test.ts`

Tests the complete debugging flow:

```typescript
it('should debug Python script with breakpoints', async () => {
  // Create session
  const sessionInfo = await sessionManager.createSession({
    language: DebugLanguage.PYTHON,
    name: 'Integration Test'
  });

  // Set breakpoint
  const breakpoint = await sessionManager.setBreakpoint(
    sessionInfo.id,
    testScript,
    5
  );

  // Start debugging
  const result = await sessionManager.startDebugging(
    sessionInfo.id,
    testScript
  );

  // Wait for breakpoint hit
  await waitForCondition(
    () => session?.state === SessionState.PAUSED,
    5000
  );

  // Get variables
  const stackTrace = await sessionManager.getStackTrace(sessionInfo.id);
  const scopes = await sessionManager.getScopes(
    sessionInfo.id, 
    stackTrace[0].id
  );
  const variables = await sessionManager.getVariables(
    sessionInfo.id,
    scopes[0].variablesReference
  );

  // Verify
  expect(variables).toContainEqual(
    expect.objectContaining({ name: 'x', value: '10' })
  );
});
```

## Test Categories

### 1. Unit Tests
- Test individual components in isolation
- Mock all dependencies
- Focus on logic and state management
- Examples: `proxy-manager-lifecycle.test.ts`, `session-manager-dap.test.ts`

### 2. Integration Tests
- Test component interactions
- Use real implementations where possible
- Focus on data flow and protocol compliance
- Examples: `python_debug_workflow.test.ts`, `proxy-startup.test.ts`

### 3. End-to-End Tests
- Test complete scenarios
- Minimal mocking
- Focus on user workflows
- Examples: `debugpy-connection.test.ts`

## Special Testing Considerations

### 1. Process Cleanup

Tests that spawn processes must ensure cleanup:

```typescript
afterEach(async () => {
  // Clean up any remaining sessions
  await sessionManager.closeAllSessions();
  
  // Verify no orphaned processes
  const sessions = sessionManager.getAllSessions();
  expect(sessions).toHaveLength(0);
});
```

### 2. Timing-Sensitive Tests

Use helpers for timing-sensitive operations:

```typescript
async function waitForCondition(
  condition: () => boolean,
  timeout: number,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (!condition() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  if (!condition()) {
    throw new Error(`Condition not met within ${timeout}ms`);
  }
}
```

### 3. Error Message Testing

Verify exact error messages using the centralized system:

```typescript
it('should timeout with correct message', async () => {
  await expect(operation())
    .rejects.toThrow(ErrorMessages.proxyInitTimeout(30));
});
```

## Coverage Analysis

### High Coverage Areas (95%+)
- `src/utils/` - Utility functions
- `src/session/` - Session management
- `src/proxy/` - Proxy management
- `src/dap-core/` - Functional core

### Challenging Coverage Areas
- Error handling paths
- Process crash scenarios
- Network failure cases
- Race conditions

### Coverage Tools

Run coverage analysis:
```bash
npm run test:coverage
```

View detailed report:
```bash
npm run coverage:report
```

## Best Practices

1. **Always clean up resources** - Processes, timers, event listeners
2. **Use fake implementations** - Avoid real process spawning in unit tests
3. **Test error paths** - Ensure error handling is thoroughly tested
4. **Mock at boundaries** - Mock external dependencies, not internal components
5. **Prefer integration tests** - When testing component interactions
6. **Document complex tests** - Add comments explaining test scenarios
7. **Keep tests focused** - One concept per test
8. **Use descriptive names** - Test names should explain what and why

## Next Steps

- See [Development Setup Guide](../development/setup-guide.md) for running tests
- See [Testing Guide](../development/testing-guide.md) for writing new tests
- See [Debugging Guide](../development/debugging-guide.md) for debugging test failures
