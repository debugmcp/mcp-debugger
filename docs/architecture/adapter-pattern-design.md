# Debug Adapter Pattern Design

## Overview

The Debug Adapter Pattern transforms mcp-debugger from a Python-specific tool into a multi-language debugging platform. This design introduces a language-agnostic adapter interface that encapsulates all language-specific behavior while maintaining backward compatibility with existing functionality.

### Design Philosophy

1. **Wrap, Don't Rewrite**: The existing ProxyManager provides excellent process management. We inject adapters to handle language-specific concerns.
2. **Interface Segregation**: Keep interfaces focused and cohesive
3. **Dependency Inversion**: Core depends on interfaces, not implementations
4. **Open/Closed**: Open for extension (new languages), closed for modification
5. **Single Responsibility**: Each adapter handles one language

## Architecture Diagram

```mermaid
graph TD
    Client[MCP Client] -->|MCP Protocol| Server[server.ts]
    Server -->|Creates/Manages| SM[SessionManager]
    SM -->|Gets Adapter| AR[AdapterRegistry]
    AR -->|Creates| AD[IDebugAdapter]
    SM -->|Injects Adapter| PM[ProxyManager]
    PM -->|Uses Adapter| AD
    PM -->|Spawns| AP[Adapter Process]
    AP -->|DAP Protocol| DP[Debug Runtime]
    
    subgraph "Language Adapters"
        PA[PythonAdapter]
        MA[MockAdapter]
        NA[NodeAdapter]
        GA[GoAdapter]
    end
    
    AR --> PA
    AR --> MA
    AR --> NA
    AR --> GA
    
    style AD fill:#9cf,stroke:#333,stroke-width:2px
    style AR fill:#9cf,stroke:#333,stroke-width:2px
    style PM fill:#f9f,stroke:#333,stroke-width:2px
```

## Interface Design Decisions

### Why These Methods?

#### Lifecycle Management
- **`initialize()`**: Performs one-time setup and environment validation
- **`dispose()`**: Ensures clean resource cleanup

**Rationale**: Separates construction from initialization, allowing dependency injection while deferring expensive operations.

#### State Management
- **`getState()`**: Provides current adapter state
- **`isReady()`**: Quick check for debugging readiness
- **`getCurrentThreadId()`**: Tracks active debugging thread

**Rationale**: Enables state monitoring without tight coupling to internal implementation.

#### Environment Validation
- **`validateEnvironment()`**: Comprehensive environment check
- **`getRequiredDependencies()`**: Lists what's needed

**Rationale**: Fail-fast principle - detect problems early with clear error messages.

#### Executable Management
- **`resolveExecutablePath()`**: Finds the language runtime
- **`getDefaultExecutableName()`**: Platform-aware defaults
- **`getExecutableSearchPaths()`**: Where to look for executables

**Rationale**: Abstracts platform differences and user configurations.

#### DAP Protocol Operations
- **`sendDapRequest()`**: Sends requests to debug adapter
- **`handleDapEvent()`**: Processes incoming events
- **`handleDapResponse()`**: Handles request responses

**Rationale**: While ProxyManager handles the transport, adapters may need to transform or enhance DAP messages for language-specific behavior.

### Event Model

Adapters emit events for state changes and DAP protocol events:

```typescript
adapter.on('stateChanged', (oldState, newState) => {
  logger.info(`Adapter state: ${oldState} → ${newState}`);
});

adapter.on('stopped', (event) => {
  logger.info(`Debugger stopped: ${event.body.reason}`);
});
```

### Error Handling

Consistent error patterns across adapters:

```typescript
try {
  await adapter.validateEnvironment();
} catch (error) {
  if (error instanceof AdapterError) {
    if (error.code === AdapterErrorCode.EXECUTABLE_NOT_FOUND) {
      // Show installation instructions
      console.log(adapter.getInstallationInstructions());
    }
    if (error.recoverable) {
      // Attempt recovery
    }
  }
}
```

## Sequence Diagrams

### Session Creation with Adapter

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant S as Server
    participant SM as SessionManager
    participant AR as AdapterRegistry
    participant A as Adapter
    participant SS as SessionStore
    
    C->>S: create_debug_session(language='python')
    S->>SM: createSession({language, name})
    SM->>AR: isLanguageSupported('python')
    AR-->>SM: true
    SM->>SS: createSession(params)
    SS-->>SM: sessionInfo
    SM-->>S: sessionInfo
    S-->>C: {sessionId, name, language}
```

### Debugging Lifecycle

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant S as Server
    participant SM as SessionManager
    participant AR as AdapterRegistry
    participant A as Adapter
    participant PM as ProxyManager
    participant AP as Adapter Process
    
    C->>S: start_debugging(sessionId, script)
    S->>SM: startDebugging(...)
    SM->>AR: create(language, config)
    AR->>A: new PythonAdapter(deps)
    AR-->>SM: adapter
    
    SM->>A: validateEnvironment()
    A-->>SM: {valid: true}
    
    SM->>PM: new ProxyManager(adapter, ...)
    SM->>PM: start(config)
    
    PM->>A: buildAdapterCommand(config)
    A-->>PM: {command, args, env}
    
    PM->>AP: spawn(command, args)
    AP-->>PM: process started
    
    PM->>A: connect(host, port)
    A-->>PM: connected
    
    PM-->>SM: initialized
    SM-->>S: {success: true}
    S-->>C: Debugging started
```

### Step Operation with Adapter

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant SM as SessionManager
    participant PM as ProxyManager
    participant A as Adapter
    participant AP as Adapter Process
    
    C->>SM: stepOver(sessionId)
    SM->>PM: sendDapRequest('next', {threadId})
    
    PM->>A: sendDapRequest('next', {threadId})
    A->>A: Transform if needed
    A->>AP: DAP next request
    
    AP-->>A: DAP response
    A->>A: Transform if needed
    A-->>PM: response
    
    PM-->>SM: response
    
    AP->>A: stopped event
    A->>PM: emit('stopped', event)
    PM->>SM: emit('stopped', event)
    
    SM-->>C: {success: true}
```

## Migration Strategy

### Phase 1: Interface Creation
1. Create IDebugAdapter interface ✅
2. Create IAdapterRegistry interface
3. Create mock adapter for testing
4. Update types to use `executablePath` instead of `pythonPath`

### Phase 2: Mock Implementation
1. Implement MockDebugAdapter
2. Create mock adapter process script
3. Add mock adapter tests
4. Verify interface completeness

### Phase 3: Python Adapter
1. Create PythonDebugAdapter class
2. Move logic from python-utils.ts
3. Extract Python-specific code from SessionManager
4. Update ProxyManager to accept adapters

### Phase 4: Integration
1. Update SessionManager to use AdapterRegistry
2. Update server.ts to remove language validation
3. Add backward compatibility layer
4. Update all tests

## Component Responsibilities

### ProxyManager (What it Keeps)
- Process lifecycle management
- IPC communication with proxy process
- Request/response correlation
- Event forwarding
- DAP message transport

### IDebugAdapter (What it Owns)
- Language-specific configuration
- Executable discovery and validation
- Command building for debug adapter
- Error message translation
- Feature capability declaration
- Language-specific path handling
- DAP message transformation (if needed)

### AdapterRegistry (New Component)
- Adapter registration and discovery
- Language support checking
- Adapter instance creation
- Dependency injection into adapters

### SessionManager (Modified Role)
- Session lifecycle orchestration
- Adapter selection based on language
- ProxyManager creation with adapter
- High-level debugging operations

## Performance Considerations

### Overhead Analysis

| Operation | Current | With Adapters | Impact |
|-----------|---------|---------------|--------|
| Session Creation | 100ms | 105ms | +5% (adapter creation) |
| Language Detection | 80ms | 80ms | No change (moves to adapter) |
| Breakpoint Setting | <10ms | <10ms | No change |
| Step Operations | <50ms | <50ms | No change |
| Memory per Session | Baseline | +~1MB | Adapter instance |

### Optimization Strategies

1. **Lazy Adapter Loading**
   ```typescript
   // Only load adapter when first used
   const adapter = await registry.create(language, config);
   ```

2. **Adapter Pooling**
   ```typescript
   // Reuse adapters for same language
   class AdapterPool {
     private adapters = new Map<string, IDebugAdapter>();
   }
   ```

3. **Parallel Initialization**
   ```typescript
   // Initialize adapter while creating session
   const [session, adapter] = await Promise.all([
     sessionStore.create(params),
     registry.create(language, config)
   ]);
   ```

## MCP Tool Changes

### Current Tool Signature
```json
{
  "name": "create_debug_session",
  "inputSchema": {
    "properties": {
      "language": { "enum": ["python"] },
      "pythonPath": { "type": "string" }
    }
  }
}
```

### New Tool Signature
```json
{
  "name": "create_debug_session",
  "inputSchema": {
    "properties": {
      "language": { "enum": ["python", "node", "go"] },
      "executablePath": { "type": "string" },
      "pythonPath": { 
        "type": "string",
        "deprecated": true,
        "description": "Deprecated. Use executablePath instead."
      }
    }
  }
}
```

### Session Creation Flow

1. **Client Request**
   ```json
   {
     "tool": "create_debug_session",
     "arguments": {
       "language": "python",
       "executablePath": "/usr/bin/python3"
     }
   }
   ```

2. **Server Processing**
   - Check if language is supported via AdapterRegistry
   - Create session with language stored
   - Return session info

3. **Debugging Start**
   - SessionManager creates appropriate adapter
   - Adapter validates environment
   - ProxyManager uses adapter for configuration

## Error Handling Patterns

### Adapter Not Found
```typescript
class AdapterNotFoundError extends AdapterError {
  constructor(language: string) {
    super(
      `No debug adapter registered for language: ${language}`,
      AdapterErrorCode.ADAPTER_NOT_FOUND,
      false
    );
  }
}
```

### Environment Invalid
```typescript
class EnvironmentInvalidError extends AdapterError {
  constructor(message: string, instructions: string) {
    super(message, AdapterErrorCode.ENVIRONMENT_INVALID, true);
    this.instructions = instructions;
  }
}
```

### Graceful Degradation
```typescript
// If feature not supported, disable UI elements
if (!adapter.supportsFeature(DebugFeature.CONDITIONAL_BREAKPOINTS)) {
  disableConditionalBreakpoints();
}
```

## Testing Strategy

### Unit Tests
- Test each adapter method in isolation
- Mock external dependencies
- Verify error handling

### Integration Tests
- Test adapter with real ProxyManager
- Verify DAP communication
- Test language-specific features

### E2E Tests
- Full debugging session per language
- Cross-language compatibility
- Performance benchmarks

## Future Extensibility

### Adding a New Language

1. **Create Adapter Class**
   ```typescript
   export class GoDebugAdapter extends EventEmitter implements IDebugAdapter {
     readonly language = DebugLanguage.GO;
     readonly name = "Go Debug Adapter";
     // ... implement interface
   }
   ```

2. **Register with Registry**
   ```typescript
   registry.register('go', new GoAdapterFactory());
   ```

3. **Update Enum**
   ```typescript
   export enum DebugLanguage {
     PYTHON = 'python',
     NODE = 'node',
     GO = 'go' // New language
   }
   ```

4. **Add Tests**
   - Unit tests for adapter
   - Integration tests
   - Update E2E test matrix

### Feature Flags
```typescript
// Enable experimental languages
const EXPERIMENTAL_LANGUAGES = process.env.EXPERIMENTAL_LANGUAGES?.split(',') || [];
if (EXPERIMENTAL_LANGUAGES.includes('rust')) {
  registry.register('rust', new RustAdapterFactory());
}
```

## Success Metrics

### Functional Metrics
- ✅ All existing Python tests pass
- ✅ No breaking changes to MCP API
- ✅ Can add new language without changing core
- ✅ Mock adapter enables testing without external dependencies

### Performance Metrics
- ✅ Session creation < 150ms
- ✅ Adapter overhead < 5ms per operation
- ✅ No memory leaks with multiple adapters
- ✅ DAP operations performance unchanged

### Code Quality Metrics
- ✅ Reduced coupling (Python deps in adapter only)
- ✅ Increased testability (mockable adapters)
- ✅ Clear separation of concerns
- ✅ Type safety throughout

## Conclusion

This adapter pattern design provides a clean, extensible architecture for multi-language debugging support. Key benefits:

1. **Minimal Risk**: Existing ProxyManager continues to work as-is
2. **Incremental Migration**: Each phase provides value
3. **Future-Proof**: Easy to add new languages
4. **Testable**: Mock adapter enables comprehensive testing
5. **Performant**: Minimal overhead per operation

The design successfully balances extensibility with stability, allowing mcp-debugger to evolve into a true multi-language platform while maintaining its current reliability.
