# Dual-Pattern Decision Guide: IDebugAdapter vs AdapterPolicy

## Quick Decision Matrix

| Need | Use IDebugAdapter | Use AdapterPolicy |
|------|------------------|-------------------|
| Full language support | ✅ | ❌ |
| DAP protocol handling | ✅ | ❌ |
| Process management | ✅ | ❌ |
| Session-specific behaviors | ❌ | ✅ |
| Stack filtering | ❌ | ✅ |
| Variable extraction | ❌ | ✅ |
| Simple validation | ❌ | ✅ |
| Handshake procedures | ❌ | ✅ |

## When to Use IDebugAdapter

Use IDebugAdapter when you need:
- **Complete language implementation**
- **DAP protocol communication**
- **Process lifecycle management**
- **Stateful adapter instances**
- **Feature capability declarations**

### IDebugAdapter Example: Adding Go Support

```typescript
// packages/adapter-go/src/go-debug-adapter.ts
export class GoDebugAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = DebugLanguage.GO;
  readonly name = 'Go Debug Adapter';
  
  async validateEnvironment(): Promise<ValidationResult> {
    // Check for dlv (Delve debugger)
  }
  
  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Build dlv command line
  }
  
  async sendDapRequest<T>(command: string, args?: unknown): Promise<T> {
    // Send DAP requests to Delve
  }
  
  // ... full IDebugAdapter implementation
}
```

## When to Use AdapterPolicy

Use AdapterPolicy when you need:
- **Language-specific session behaviors**
- **Validation logic and environment checks**
- **Data filtering or transformation**
- **Policy methods with managed state** (20+ methods including state management via `createInitialState`, `updateStateOnCommand`, `updateStateOnEvent`, etc.)
- **Quick language-specific decisions**

### AdapterPolicy Example: Adding Go Support

```typescript
// packages/shared/src/interfaces/adapter-policy-go.ts
export const GoAdapterPolicy: AdapterPolicy = {
  getDapAdapterConfiguration(): AdapterConfiguration {
    return {
      type: 'dlv-dap',
      supportedProtocols: ['tcp'],
      defaultPort: 38697
    };
  },
  
  resolveExecutablePath(providedPath?: string): string | undefined {
    return providedPath || 'dlv';
  },
  
  filterStackFrames(frames: StackFrame[], includeInternals = false): StackFrame[] {
    if (includeInternals) return frames;
    // Filter Go runtime and testing framework frames
    return frames.filter(f =>
      !f.file?.includes('runtime/') && !f.file?.includes('/testing/')
    );
  },

  resolveExecutablePath(providedPath?: string): string | undefined {
    // Priority: provided path > DLV_PATH env var > default 'dlv'
    return providedPath || process.env.DLV_PATH || 'dlv';
  }
};
```

## Common Scenarios

### Scenario 1: Adding Basic Language Support
**Need**: Quick support for a language with standard DAP adapter

**Solution**: Implement both
1. Minimal IDebugAdapter for core functionality
2. AdapterPolicy for language-specific behaviors

### Scenario 2: Customizing Existing Language
**Need**: Change how Python variables are displayed

**Solution**: Modify PythonAdapterPolicy
```typescript
// Just update the policy
PythonAdapterPolicy.extractLocalVariables = (frames, scopes, vars) => {
  // Custom extraction logic
};
```

### Scenario 3: Complex Handshake Protocol
**Need**: Handle multi-session negotiation (like JavaScript)

**Solution**: Use AdapterPolicy.performHandshake()
```typescript
export const ComplexLanguagePolicy: AdapterPolicy = {
  async performHandshake(context: HandshakeContext): Promise<void> {
    // Complex handshake logic
    // Access to proxyManager, sessionId, etc.
  }
};
```

### Scenario 4: Custom DAP Extensions
**Need**: Language requires custom DAP messages

**Solution**: Implement in IDebugAdapter
```typescript
class CustomAdapter implements IDebugAdapter {
  async sendDapRequest<T>(command: string, args?: unknown): Promise<T> {
    if (command === 'customCommand') {
      // Handle custom DAP extension
    }
    // Standard handling
  }
}
```

## Integration Points

### How They Work Together

```typescript
// During session initialization
class SessionManagerOperations {
  async startDebugging(sessionId: string) {
    const session = this.getSession(sessionId);
    
    // 1. Create IDebugAdapter for core debugging
    const adapter = await this.adapterRegistry.create(session.language);
    
    // 2. Get AdapterPolicy for session behaviors  
    const policy = this.selectPolicy(session.language);
    
    // 3. Use adapter for environment validation
    await adapter.validateEnvironment();
    
    // 4. Use policy for executable validation
    if (policy.validateExecutable) {
      await policy.validateExecutable(executablePath);
    }
    
    // 5. Create ProxyManager with adapter
    const proxyManager = new ProxyManager(adapter);
    
    // 6. Use policy for handshake if needed
    if (policy.performHandshake) {
      await policy.performHandshake({ proxyManager, sessionId });
    }
  }
}
```

### Data Flow Example

```
User Request
    ↓
Server (MCP Tools)
    ↓
SessionManager
    ├─→ IDebugAdapter (Process & DAP)
    │     ├─→ buildAdapterCommand()
    │     ├─→ validateEnvironment()
    │     └─→ sendDapRequest()
    │
    └─→ AdapterPolicy (Session Behaviors)
          ├─→ validateExecutable()
          ├─→ performHandshake()
          ├─→ filterStackFrames()
          └─→ extractLocalVariables()
```

## Best Practices

### DO: IDebugAdapter
✅ Implement all required interface methods
✅ Handle DAP protocol correctly
✅ Emit appropriate events
✅ Provide clear error messages
✅ Test with real debugging scenarios

### DON'T: IDebugAdapter
❌ Put session-specific logic here
❌ Add language conditionals
❌ Make it dependent on SessionManager
❌ Skip environment validation

### DO: AdapterPolicy
✅ Use the state management hooks (`createInitialState`, `updateStateOnCommand`, `updateStateOnEvent`) for adapter-specific state tracking
✅ Make methods optional when sensible
✅ Return sensible defaults
✅ Keep logic focused on adapter-specific concerns
✅ Test policies independently

### DON'T: AdapterPolicy
❌ Depend on external services
❌ Handle DAP protocol directly
❌ Make methods too granular

## Migration Path for New Languages

### Step 1: Start with AdapterPolicy
```typescript
// Quick win - basic support
export const NewLanguagePolicy: AdapterPolicy = {
  getDapAdapterConfiguration(): AdapterConfiguration {
    return { type: 'debug-adapter-name', ... };
  },
  resolveExecutablePath(): string | undefined {
    return 'language-executable';
  }
};
```

### Step 2: Add to selectPolicy()
```typescript
case 'newlang':
  return NewLanguagePolicy;
```

### Step 3: Implement IDebugAdapter
```typescript
// Full implementation for complete support
export class NewLanguageAdapter implements IDebugAdapter {
  // Complete implementation
}
```

### Step 4: Register with AdapterRegistry
```typescript
registry.register('newlang', NewLanguageAdapterFactory);
```

## Testing Strategy

### Testing IDebugAdapter
```typescript
describe('GoDebugAdapter', () => {
  it('validates environment correctly', async () => {
    const adapter = new GoDebugAdapter(deps);
    const result = await adapter.validateEnvironment();
    expect(result.valid).toBe(true);
  });
  
  it('builds correct command', () => {
    const command = adapter.buildAdapterCommand(config);
    expect(command.command).toBe('dlv');
  });
});
```

### Testing AdapterPolicy
```typescript
describe('GoAdapterPolicy', () => {
  it('filters runtime frames', () => {
    const frames = [
      { file: 'main.go', line: 10 },
      { file: 'runtime/proc.go', line: 100 }
    ];
    const filtered = GoAdapterPolicy.filterStackFrames(frames);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].file).toBe('main.go');
  });
});
```

## Summary

- **IDebugAdapter**: Core debugging infrastructure (heavyweight, stateful, process management)
- **AdapterPolicy**: Session management behaviors (20+ methods with state management hooks for adapter-specific tracking)
- **Both needed**: For complete language support
- **Start simple**: Begin with AdapterPolicy for quick wins
- **Grow as needed**: Add IDebugAdapter for full support

The dual-pattern architecture provides flexibility and clean separation of concerns, making the codebase maintainable and extensible.
