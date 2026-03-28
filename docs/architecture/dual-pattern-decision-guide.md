# Dual-Pattern Decision Guide: IDebugAdapter vs AdapterPolicy

## Quick Decision Matrix

| Need | Use IDebugAdapter | Use AdapterPolicy |
|------|------------------|-------------------|
| Full language support | ✅ | ❌ |
| DAP protocol handling | ✅ | ❌ |
| Process management | ✅ | ❌ |
| Session-specific behaviors | ✅ (connect/disconnect, state machine) | ✅ (state hooks, filtering) |
| Stack filtering | ❌ | ✅ |
| Variable extraction | ❌ | ✅ |
| Simple validation | ✅ (validateEnvironment) | ✅ (validateExecutable) |
| Handshake procedures | ✅ (createLaunchBarrier) | ✅ (performHandshake) |

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
  readonly name = 'Go Debug Adapter (Delve)';

  async validateEnvironment(): Promise<ValidationResult> {
    // Check for dlv (Delve debugger)
  }

  buildAdapterCommand(config: AdapterConfig): AdapterCommand {
    // Build dlv command line
  }

  async sendDapRequest<T>(command: string, args?: unknown): Promise<T> {
    // Intentional stub — DAP request forwarding is handled by the DAP client
    // in the proxy layer, not by the adapter. This throws at runtime.
    throw new Error('DAP request forwarding not implemented - handled by DAP client');
  }

  // ... full IDebugAdapter implementation
}
```

## When to Use AdapterPolicy

Use AdapterPolicy when you need:
- **Language-specific session behaviors**
- **Validation logic and environment checks**
- **Data filtering or transformation**
- **Policy methods with managed state** (20+ methods including state management via `createInitialState`, `updateStateOnCommand`, `updateStateOnResponse`, `updateStateOnEvent`, etc.)
- **Quick language-specific decisions**

### AdapterPolicy Example: Adding Go Support

```typescript
// packages/shared/src/interfaces/adapter-policy-go.ts
export const GoAdapterPolicy: AdapterPolicy = {
  getDapAdapterConfiguration() {
    return { type: 'dlv-dap' };
  },

  resolveExecutablePath(providedPath?: string): string | undefined {
    // Priority: provided path > DLV_PATH env var > default 'dlv'
    return providedPath || process.env.DLV_PATH || 'dlv';
  },

  filterStackFrames(frames: StackFrame[], includeInternals = false): StackFrame[] {
    if (includeInternals) return frames;
    // Filter Go runtime and testing framework frames
    return frames.filter(f =>
      !f.file?.includes('runtime/') && !f.file?.includes('/testing/')
    );
  },
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

**Solution**: Create a derived policy using spread syntax
```typescript
const MyPythonPolicy: AdapterPolicy = { ...PythonAdapterPolicy, extractLocalVariables: (frames, scopes, vars) => { /* custom */ } };
```

### Scenario 3: Complex Handshake Protocol
**Need**: Handle multi-session negotiation (like JavaScript)

**Solution**: Use AdapterPolicy.performHandshake(). Currently only `JsDebugAdapterPolicy` implements this method -- it handles the js-debug multi-session setup (child session negotiation, launch with pending target, etc.). Other policies do not implement `performHandshake`.
```typescript
export const ComplexLanguagePolicy: AdapterPolicy = {
  async performHandshake(context: HandshakeContext): Promise<void> {
    // Complex handshake logic (currently only implemented by JsDebugAdapterPolicy)
    // Access to proxyManager, sessionId, etc.
  }
};
```

### Scenario 4: Custom DAP Extensions
**Need**: Language requires custom DAP messages

**Solution**: Implement in IDebugAdapter

> **Note:** In practice, `sendDapRequest` in most existing adapters returns `{} as T` (a no-op stub) -- DAP request forwarding is handled by the DAP client in the proxy layer, not by the adapter. The Go and Java adapters throw instead. This example shows a hypothetical pattern if adapter-level request interception were needed.

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
// During session initialization (simplified from startProxyManager + startDebugging)
class SessionManagerOperations {
  async startDebugging(sessionId: string) {
    const session = this.getSession(sessionId);

    // startProxyManager flow:
    // 1. Create session log directory
    // 2. Find free port for adapter
    // 3. Collect queued breakpoints
    // 4. Merge launch args (default + user-provided + adapterLaunchConfig)
    // 5. Create IDebugAdapter via AdapterRegistry
    const adapter = await this.adapterRegistry.create(session.language, config);

    // 6. Validate environment via adapter
    await adapter.validateEnvironment();

    // 7. Build adapter command
    const adapterCommand = adapter.buildAdapterCommand(adapterConfig);

    // 8. Create ProxyManager via factory and setup event handlers
    const proxyManager = this.proxyManagerFactory.create(adapter);
    this.setupProxyEventHandlers(session, proxyManager, effectiveLaunchArgs);

    // 9. Start proxy process (spawns child process, sends init payload)
    await proxyManager.start(proxyConfig);

    // Back in startDebugging:
    // 10. Get AdapterPolicy for session behaviors
    const policy = this.selectPolicy(session.language);

    // 11. Use policy for handshake if needed (currently only JsDebugAdapterPolicy)
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
✅ Use the state management hooks (`createInitialState`, `updateStateOnCommand`, `updateStateOnResponse`, `updateStateOnEvent`) for adapter-specific state tracking
✅ Make methods optional when sensible
✅ Return sensible defaults
✅ Keep logic focused on adapter-specific concerns
✅ Test policies independently

### DON'T: AdapterPolicy
❌ Depend on external services
❌ Handle DAP protocol directly
❌ Make methods too granular

## Migration Path for New Languages

### Step 1: Implement IDebugAdapter (required)
Practical language support requires a registered `IDebugAdapter`. `AdapterPolicy` augments behavior but does not replace adapter creation in the current architecture.

### Step 2: Create AdapterPolicy for language-specific session behaviors
```typescript
export const NewLanguagePolicy: AdapterPolicy = {
  getDapAdapterConfiguration() {
    return { type: 'debug-adapter-name' };
  },
  resolveExecutablePath(): string | undefined {
    return 'language-executable';
  }
};
```

### Step 3: Add to selectPolicy() and update DebugLanguage enum
Add your language to the `DebugLanguage` enum in `@debugmcp/shared`, then add your policy to **all three** `selectPolicy()` locations:
- `src/session/session-manager-data.ts` (session-level data operations)
- `src/proxy/dap-proxy-worker.ts` (proxy-level adapter behavior via `selectAdapterPolicy()`)
- `src/session/session-store.ts` (session persistence policy selection)

```typescript
case DebugLanguage.NEWLANG:
  return NewLanguagePolicy;
```

### Step 4: Complete IDebugAdapter Implementation
```typescript
// Full implementation for complete support
export class NewLanguageAdapter implements IDebugAdapter {
  // Complete implementation
}
```

### Step 5: Register with AdapterRegistry
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
- **AdapterPolicy**: Session management behaviors (20+ methods with state management hooks: `createInitialState`, `updateStateOnCommand`, `updateStateOnResponse`, `updateStateOnEvent`, etc.)
- **Both needed**: For complete language support
- **IDebugAdapter required**: Language support requires a registered adapter for adapter creation
- **Grow as needed**: Add AdapterPolicy for language-specific session behaviors

The dual-pattern architecture provides flexibility and clean separation of concerns, making the codebase maintainable and extensible.
