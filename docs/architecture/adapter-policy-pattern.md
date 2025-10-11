# Adapter Policy Pattern Documentation

## Overview

The mcp-debugger uses a **dual-pattern architecture** that combines two complementary adapter patterns:
1. **IDebugAdapter**: Full adapter implementations for complete language support
2. **AdapterPolicy**: Lightweight policies for language-specific behaviors in session management

This document explains the AdapterPolicy pattern and how it relates to the main IDebugAdapter interface.

## The Two Patterns Explained

### IDebugAdapter (Primary Pattern)
- **Purpose**: Complete debug adapter implementation
- **Scope**: Handles all DAP protocol communication and language runtime management
- **Location**: `packages/adapter-<language>/`
- **Examples**: JavascriptDebugAdapter, PythonAdapter, MockAdapter

### AdapterPolicy (Supporting Pattern)
- **Purpose**: Language-specific policies for session management
- **Scope**: Lightweight behaviors used by SessionManager classes
- **Location**: `packages/shared/src/interfaces/adapter-policy-*.ts`
- **Examples**: JsDebugAdapterPolicy, PythonAdapterPolicy, MockAdapterPolicy

## AdapterPolicy Interface

The AdapterPolicy interface provides static methods for language-specific behaviors:

```typescript
export interface AdapterPolicy {
  // DAP adapter configuration
  getDapAdapterConfiguration(): AdapterConfiguration;
  
  // Executable path resolution and validation
  resolveExecutablePath(providedPath?: string): string | undefined;
  validateExecutable?(executablePath: string): Promise<boolean>;
  
  // Debugger configuration and capabilities
  getDebuggerConfiguration(): DebuggerConfiguration;
  
  // Language-specific handshake procedures
  performHandshake?(context: HandshakeContext): Promise<void>;
  
  // Stack frame filtering (optional)
  filterStackFrames?(frames: StackFrame[], includeInternals?: boolean): StackFrame[];
  
  // Variable extraction (optional)
  extractLocalVariables?(
    stackFrames: StackFrame[],
    scopesMap: Record<number, DebugProtocol.Scope[]>,
    variablesMap: Record<number, Variable[]>,
    includeSpecial?: boolean
  ): Variable[];
  
  // Scope name conventions (optional)
  getLocalScopeName?(): string | string[];
}
```

## How the Patterns Work Together

### 1. Session Creation Flow
```
Client Request → Server → SessionManager
                            ↓
                    AdapterRegistry.create()
                            ↓
                    Creates IDebugAdapter instance
                            ↓
                    SessionManager.selectPolicy()
                            ↓
                    Gets AdapterPolicy for behaviors
```

### 2. During Debugging Operations

#### IDebugAdapter handles:
- Building adapter command lines
- Managing DAP protocol communication
- Environment validation
- Connection management
- Feature capabilities

#### AdapterPolicy handles:
- Executable path validation (language-specific)
- Handshake procedures (e.g., JavaScript's multi-session negotiation)
- Stack frame filtering (e.g., hiding Node.js internals)
- Variable extraction logic (e.g., Python's locals vs JavaScript's scopes)

## Implementation Examples

### Python Policy
```typescript
export const PythonAdapterPolicy: AdapterPolicy = {
  getDapAdapterConfiguration(): AdapterConfiguration {
    return {
      type: 'debugpy',
      supportedProtocols: ['tcp'],
      defaultPort: 5678
    };
  },

  resolveExecutablePath(providedPath?: string): string | undefined {
    // Python-specific resolution logic
    if (providedPath) return providedPath;
    // Check common Python commands
    const commands = ['python3', 'python', 'py'];
    // ... resolution logic
  },

  async validateExecutable(executablePath: string): Promise<boolean> {
    // Validate it's actually Python
    try {
      const result = await execSync(`"${executablePath}" --version`);
      return result.includes('Python');
    } catch {
      return false;
    }
  },

  extractLocalVariables(stackFrames, scopesMap, variablesMap): Variable[] {
    // Python-specific: look for 'Locals' scope
    const topFrame = stackFrames[0];
    const scopes = scopesMap[topFrame.id] || [];
    const localsScope = scopes.find(s => s.name === 'Locals');
    // ... extraction logic
  }
};
```

### JavaScript Policy
```typescript
export const JsDebugAdapterPolicy: AdapterPolicy = {
  getDapAdapterConfiguration(): AdapterConfiguration {
    return {
      type: 'pwa-node',
      supportedProtocols: ['tcp'],
      defaultPort: 9229
    };
  },

  async performHandshake(context: HandshakeContext): Promise<void> {
    // JavaScript-specific multi-session negotiation
    const { proxyManager, sessionId, dapLaunchArgs } = context;
    
    // Send initialize request
    await proxyManager.sendDapRequest('initialize', {
      clientID: 'mcp-debugger',
      adapterID: 'pwa-node',
      // ... capabilities
    });
    
    // Handle multi-session mode if needed
    if (needsMultiSession) {
      // ... handle startDebugging reverse request
    }
  },

  filterStackFrames(frames: StackFrame[], includeInternals = false): StackFrame[] {
    if (includeInternals) return frames;
    
    // Filter out Node.js internals
    return frames.filter(frame => {
      const file = frame.file || '';
      return !file.includes('node_modules') && 
             !file.includes('internal/') &&
             !file.startsWith('node:');
    });
  }
};
```

## Usage in Session Management

### The selectPolicy() Pattern

Session management classes use a `selectPolicy()` method to get the appropriate policy:

```typescript
export class SessionManagerData extends SessionManagerCore {
  protected selectPolicy(language: string | DebugLanguage): AdapterPolicy {
    switch (language) {
      case 'python':
      case DebugLanguage.PYTHON:
        return PythonAdapterPolicy;
      case 'javascript':
      case DebugLanguage.JAVASCRIPT:
        return JsDebugAdapterPolicy;
      case 'mock':
      case DebugLanguage.MOCK:
        return MockAdapterPolicy;
      default:
        return DefaultAdapterPolicy;
    }
  }

  async getStackTrace(sessionId: string): Promise<StackFrame[]> {
    // ... get frames from DAP
    
    // Apply language-specific filtering
    const policy = this.selectPolicy(session.language);
    if (policy.filterStackFrames) {
      frames = policy.filterStackFrames(frames, includeInternals);
    }
    
    return frames;
  }
}
```

## Migration from Hardcoded Conditionals

### Before (Hardcoded)
```typescript
// In session-manager-operations.ts
if (session.language === 'python') {
  // Python-specific validation
  const valid = await this.isValidPythonExecutable(executablePath);
}

if (session.language === 'javascript') {
  // JavaScript-specific handshake
  await this.performJsHandshake(proxyManager, ...);
}
```

### After (Policy-Based)
```typescript
// In session-manager-operations.ts
const policy = this.selectPolicy(session.language);

// Validation
if (policy.validateExecutable) {
  const valid = await policy.validateExecutable(executablePath);
}

// Handshake
if (policy.performHandshake) {
  await policy.performHandshake(context);
}
```

## When to Use Each Pattern

### Use IDebugAdapter when:
- Adding complete support for a new language
- Implementing DAP protocol handling
- Managing adapter process lifecycle
- Defining language capabilities

### Use AdapterPolicy when:
- Adding language-specific behaviors to session management
- Customizing stack trace presentation
- Implementing language-specific validation
- Handling unique handshake requirements

## Adding Support for a New Language

To add complete support for a new language, you need both:

### 1. Create the IDebugAdapter Implementation
```typescript
// packages/adapter-rust/src/rust-adapter.ts
export class RustDebugAdapter extends EventEmitter implements IDebugAdapter {
  // Full implementation of all IDebugAdapter methods
}
```

### 2. Create the AdapterPolicy
```typescript
// packages/shared/src/interfaces/adapter-policy-rust.ts
export const RustAdapterPolicy: AdapterPolicy = {
  getDapAdapterConfiguration(): AdapterConfiguration {
    return {
      type: 'lldb',
      supportedProtocols: ['tcp'],
      defaultPort: 3333
    };
  },
  
  resolveExecutablePath(providedPath?: string): string | undefined {
    // Rust-specific resolution
    return providedPath || 'rust-lldb';
  },
  
  // Add any Rust-specific behaviors
};
```

### 3. Register in selectPolicy()
```typescript
case 'rust':
case DebugLanguage.RUST:
  return RustAdapterPolicy;
```

## Benefits of the Dual-Pattern Architecture

1. **Separation of Concerns**
   - IDebugAdapter: Complete adapter implementation
   - AdapterPolicy: Lightweight session behaviors

2. **Incremental Refactoring**
   - Policies can be added without changing adapter implementations
   - Language conditionals can be migrated gradually

3. **Type Safety**
   - Both patterns are fully typed
   - Compile-time checking for interface compliance

4. **Testability**
   - Policies are simple static objects, easy to test
   - Adapters can be tested independently

5. **Maintainability**
   - Language-specific code is centralized
   - Clear boundaries between concerns

## Summary

The dual-pattern architecture provides a robust foundation for multi-language debugging:
- **IDebugAdapter** provides the complete adapter infrastructure
- **AdapterPolicy** provides lightweight language-specific behaviors
- Together, they enable clean, maintainable, and extensible language support

This architecture successfully eliminates language-specific conditionals from the core business logic while maintaining flexibility for language-specific requirements.
