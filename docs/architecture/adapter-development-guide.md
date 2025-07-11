# Debug Adapter Development Guide

> **⚠️ DRAFT DOCUMENTATION**  
> This guide is based on mcp-debugger v0.10.0 and will be refined as more language adapters are developed.

## Quick Start: Hello World Adapter

Want to add debugging support for your favorite language? Here's a minimal adapter in 15 minutes:

```typescript
import { EventEmitter } from 'events';
import { IDebugAdapter, AdapterState, DebugLanguage } from '../debug-adapter-interface.js';

export class HelloWorldAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.HELLO;
  readonly name = 'Hello World Debug Adapter';
  private state = AdapterState.UNINITIALIZED;

  async initialize(): Promise<void> {
    this.state = AdapterState.READY;
    this.emit('initialized');
  }

  async validateEnvironment(): Promise<ValidationResult> {
    // Check if your language runtime exists
    return { valid: true, errors: [], warnings: [] };
  }

  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Return command to launch your debug adapter
    return {
      command: 'hello-debug',
      args: ['--port', config.adapterPort.toString()],
      env: process.env
    };
  }

  // ... implement remaining required methods
}
```

## Step-by-Step Adapter Development

### Step 1: Set Up Your Project Structure

```
src/adapters/
  your-language/
    your-language-adapter.ts      # Main adapter implementation
    your-language-adapter-factory.ts  # Factory for creating instances
    your-language-adapter-process.ts  # Debug adapter process (if custom)
    index.ts                      # Exports
```

### Step 2: Implement the Core Interface

Start with the [MockDebugAdapter](../../src/adapters/mock/mock-debug-adapter.ts) as a template:

```typescript
export class YourLanguageDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.YOUR_LANGUAGE;
  readonly name = 'Your Language Debug Adapter';
  
  private state: AdapterState = AdapterState.UNINITIALIZED;
  private currentThreadId: number | null = null;
  private connected = false;
  
  constructor(private dependencies: AdapterDependencies) {
    super();
  }
  
  // ... implement all required methods
}
```

### Step 3: Handle State Transitions

```typescript
private transitionTo(newState: AdapterState): void {
  const oldState = this.state;
  this.state = newState;
  this.emit('stateChanged', oldState, newState);
}
```

**Reality Check**: Don't over-engineer state validation. Real adapters like [PythonDebugAdapter](../../src/adapters/python/python-debug-adapter.ts) allow flexible transitions.

### Step 4: Implement Environment Validation

```typescript
async validateEnvironment(): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  
  // Check language runtime
  try {
    await this.resolveExecutablePath();
  } catch (error) {
    errors.push({
      code: 'RUNTIME_NOT_FOUND',
      message: `${this.language} runtime not found`,
      recoverable: false
    });
  }
  
  // Check debug adapter
  try {
    await this.checkDebugAdapterInstalled();
  } catch (error) {
    errors.push({
      code: 'ADAPTER_NOT_INSTALLED',
      message: this.getInstallationInstructions(),
      recoverable: true
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}
```

### Step 5: Build the Debug Adapter Command

```typescript
buildAdapterCommand(config: AdapterConfig): AdapterCommand {
  // Example for a Node.js-like adapter
  return {
    command: config.executablePath,
    args: [
      '-m', 'debug_adapter',
      '--host', config.adapterHost,
      '--port', config.adapterPort.toString(),
      '--wait-for-client'
    ],
    env: {
      ...process.env,
      DEBUG_LOG_DIR: config.logDir
    }
  };
}
```

## DAP Protocol Integration

### Understanding DAP Events

**Critical**: Read the [DAP Sequence Reference](../development/dap-sequence-reference.md) to understand event sequences!

Key points:
- `stopped` = PAUSED (at breakpoint), NOT terminated!
- `terminated` = debugging session ended
- `exited` = process ended (with exit code)
- Proper sequence: `exited` → `terminated`

### Handling DAP Events

```typescript
handleDapEvent(event: DebugProtocol.Event): void {
  // Update internal state based on events
  switch (event.event) {
    case 'stopped':
      // Debugger is PAUSED, not terminated!
      this.currentThreadId = event.body?.threadId;
      this.transitionTo(AdapterState.DEBUGGING);
      break;
      
    case 'continued':
      // Resumed execution
      this.transitionTo(AdapterState.DEBUGGING);
      break;
      
    case 'terminated':
      // Session ended
      this.currentThreadId = null;
      this.transitionTo(AdapterState.DISCONNECTED);
      break;
      
    case 'exited':
      // Process ended (but session might still be active)
      // Don't change state here - wait for terminated
      break;
  }
  
  // Emit event for listeners
  this.emit(event.event as keyof AdapterEvents, event.body);
}
```

### Common DAP Quirks by Language

Based on real implementations:

**Python (debugpy)**:
- Sends `exited` → `terminated` on normal exit
- May treat `sys.exit()` as exception
- Can be configured to wait for input on exit

**Node.js**:
- Older versions wait for debugger detach
- May need to detect "Waiting for debugger..." message
- Order of events can vary

**Go (Delve)**:
- Expects client to send `disconnect` after `terminated`
- In attach mode, only sends `terminated` (no `exited`)

## Testing Your Adapter

### Unit Tests

Test each method in isolation:

```typescript
describe('YourLanguageDebugAdapter', () => {
  let adapter: YourLanguageDebugAdapter;
  let mockDependencies: AdapterDependencies;
  
  beforeEach(() => {
    mockDependencies = createMockDependencies();
    adapter = new YourLanguageDebugAdapter(mockDependencies);
  });
  
  describe('validateEnvironment', () => {
    it('should succeed when runtime is available', async () => {
      const result = await adapter.validateEnvironment();
      expect(result.valid).toBe(true);
    });
    
    it('should fail with helpful error when runtime missing', async () => {
      // Mock missing runtime
      const result = await adapter.validateEnvironment();
      expect(result.errors[0].code).toBe('RUNTIME_NOT_FOUND');
    });
  });
});
```

### Integration Tests

Test with the actual ProxyManager:

```typescript
it('should handle full debug session', async () => {
  const sessionManager = new SessionManager(dependencies);
  const sessionId = await sessionManager.createSession({
    language: 'your-language',
    name: 'test session'
  });
  
  await sessionManager.startDebugging({
    sessionId,
    script: 'test.yl',
    launchConfig: { stopOnEntry: true }
  });
  
  // Verify adapter was used correctly
  expect(adapter.getState()).toBe(AdapterState.DEBUGGING);
});
```

### E2E Tests

Use the test infrastructure:

```typescript
it('should debug a simple program', async () => {
  const { mcp, sessionId } = await createTestSession('your-language');
  
  // Start debugging
  await mcp.startDebugging(sessionId, 'hello.yl');
  
  // Wait for stopped event
  await waitForEvent(mcp, 'stopped');
  
  // Continue execution
  await mcp.continue(sessionId);
  
  // Wait for program to end
  await waitForEvent(mcp, 'terminated');
});
```

## Common Pitfalls and Solutions

### 1. Forgetting to Handle State Changes

**Problem**: Not updating internal state on DAP events

**Solution**: Always update state in `handleDapEvent`:
```typescript
if (event.event === 'stopped') {
  this.currentThreadId = event.body?.threadId;
  this.transitionTo(AdapterState.DEBUGGING);
}
```

### 2. Confusing 'stopped' with 'terminated'

**Problem**: Treating `stopped` event as session end

**Solution**: Remember the semantics:
- `stopped` = paused for debugging
- `terminated` = session ended

### 3. Missing Error Context

**Problem**: Generic error messages

**Solution**: Provide helpful context:
```typescript
getMissingExecutableError(): string {
  return `${this.language} executable not found. 
  
  To install:
  - Ubuntu/Debian: sudo apt-get install ${this.language}
  - macOS: brew install ${this.language}
  - Windows: Download from https://${this.language}.org
  
  Or specify a custom path with executablePath option.`;
}
```

### 4. Path Handling Issues

**Problem**: Paths work on one OS but not another

**Solution**: Use path utilities and handle platform differences:
```typescript
translateScriptPath(scriptPath: string, context: PathContext): string {
  if (context.isContainer) {
    // Handle container path mapping
  }
  
  // Normalize for platform
  return path.normalize(scriptPath);
}
```

## Debugging Your Adapter

### Enable Logging

```typescript
constructor(dependencies: AdapterDependencies) {
  super();
  this.logger = dependencies.logger;
  
  // Log all state transitions
  this.on('stateChanged', (oldState, newState) => {
    this.logger.debug(`[${this.name}] State: ${oldState} → ${newState}`);
  });
}
```

### Common Issues

1. **Adapter process won't start**
   - Check `buildAdapterCommand` returns valid command
   - Verify executable permissions
   - Check environment variables

2. **No DAP events received**
   - Verify adapter process is running
   - Check port/host configuration
   - Look for connection errors in logs

3. **State transitions failing**
   - Review VALID_TRANSITIONS (but don't be too strict)
   - Check event handling logic
   - Verify state updates in `handleDapEvent`

## Advanced Topics

### Custom Debug Adapter Process

If you need a custom adapter process (like the mock adapter):

```typescript
// your-language-adapter-process.ts
import { DAPServer } from './dap-server';

const server = new DAPServer();
server.listen(process.argv);
```

### Feature Capabilities

Declare what your adapter supports:

```typescript
getCapabilities(): AdapterCapabilities {
  return {
    supportsConfigurationDoneRequest: true,
    supportsFunctionBreakpoints: false, // If not supported
    supportsConditionalBreakpoints: true,
    supportsSetVariable: true,
    // ... other capabilities
  };
}
```

### Performance Optimization

1. **Lazy initialization**: Don't do expensive work in constructor
2. **Cache executable paths**: Avoid repeated filesystem lookups
3. **Batch operations**: Group related DAP requests when possible

## Real-World Examples

Study these implementations:

1. **[MockDebugAdapter](../../src/adapters/mock/mock-debug-adapter.ts)**
   - Complete reference implementation
   - Shows all required methods
   - Includes error simulation for testing

2. **[PythonDebugAdapter](../../src/adapters/python/python-debug-adapter.ts)**
   - Production implementation
   - Handles debugpy integration
   - Shows real-world complexity

## Checklist for New Adapters

- [ ] All IDebugAdapter methods implemented
- [ ] State transitions working correctly
- [ ] Environment validation with helpful errors
- [ ] DAP event handling (especially stopped/terminated)
- [ ] Unit tests for all methods
- [ ] Integration test with ProxyManager  
- [ ] E2E test with real debugging scenario
- [ ] Installation instructions documented
- [ ] Error messages are helpful
- [ ] Logging for debugging adapter issues

## Getting Help

1. Review existing adapters for patterns
2. Check the [DAP specification](https://microsoft.github.io/debug-adapter-protocol/)
3. Look at [test files](../../tests/core/unit/adapters/) for examples
4. File issues with specific error messages and logs

Remember: Start simple, test often, and iterate based on real usage!
