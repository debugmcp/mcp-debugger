# @debugmcp/shared

Shared interfaces, types, and base classes for the MCP Debugger monorepo.

## Overview

This package contains all the shared contracts and types that are used across the MCP Debugger ecosystem. By centralizing these definitions, we ensure consistency and enable better type safety across all packages.

## Installation

```bash
npm install @debugmcp/shared
```

## What's Included

### Interfaces

#### Debug Adapter Interfaces
- `IDebugAdapter` - Core interface for all debug adapter implementations
- `AdapterState` - Enumeration of adapter states
- `AdapterCapabilities` - DAP capabilities structure
- `AdapterConfig` - Configuration for adapter instances
- `AdapterCommand` - Command structure for launching adapters

#### External Dependencies
- `IFileSystem` - File system operations interface
- `IProcessManager` - Process management interface
- `INetworkManager` - Network operations interface
- `ILogger` - Logging interface
- `IEnvironment` - Environment information interface
- `IProxyManager` - Debug proxy management interface

#### Adapter Registry
- `IAdapterFactory` - Factory interface for creating adapters
- `IAdapterRegistry` - Registry for managing adapter factories
- `AdapterDependencies` - Dependencies required by adapters
- `AdapterMetadata` - Metadata about adapter implementations

#### Adapter Policies
- `AdapterPolicy` - Interface for language-specific adapter behavior
- `PythonAdapterPolicy` - Python/debugpy adapter policy
- `JsDebugAdapterPolicy` - JavaScript/js-debug adapter policy
- `RustAdapterPolicy` - Rust/CodeLLDB adapter policy
- `GoAdapterPolicy` - Go/Delve adapter policy
- `MockAdapterPolicy` - Mock adapter policy for testing
- `DefaultAdapterPolicy` - Lightweight placeholder used during initialization
- `DapClientBehavior` - DAP client behavior configuration

#### Process Interfaces
- `IProxyProcess` - Process abstraction for debug proxies
- `IChildProcessFactory` - Factory for creating child processes

### Types

#### Session Types
- `SessionState` - Debug session states
- `SessionLifecycleState` - Session lifecycle states
- `ExecutionState` - Execution states (running, paused, etc.)
- `DebugSessionInfo` - Public session information
- `Breakpoint` - Breakpoint structure
- `Variable` - Variable information
- `StackFrame` - Stack frame information

#### Configuration Types
- `GenericLaunchConfig` - Base launch configuration
- `LanguageSpecificLaunchConfig` - Language-specific launch configs
- `DebugFeature` - Enumeration of debug features

### Base Classes

- `BaseAdapterFactory` - Abstract base class for adapter factories

### Enumerations

- `DebugLanguage` - Supported debug languages (Python, JavaScript, Rust, Go, Mock)
- `AdapterState` - Adapter lifecycle states
- `SessionState` - Session states (legacy, deprecated — use `SessionLifecycleState` + `ExecutionState` dual-state model)
- `AdapterErrorCode` - Error codes for adapter operations

## Usage Examples

### Implementing a Debug Adapter

```typescript
import { 
  IDebugAdapter, 
  AdapterState, 
  DebugLanguage,
  AdapterDependencies 
} from '@debugmcp/shared';

export class MyDebugAdapter implements IDebugAdapter {
  readonly language = DebugLanguage.PYTHON;
  readonly name = 'My Python Adapter';
  
  constructor(dependencies: AdapterDependencies) {
    // Initialize with dependencies
  }
  
  async initialize(): Promise<void> {
    // Initialization logic
  }
  
  // ... implement other required methods
}
```

### Creating an Adapter Factory

```typescript
import {
  BaseAdapterFactory,
  IDebugAdapter,
  AdapterDependencies,
  AdapterMetadata,
  DebugLanguage
} from '@debugmcp/shared';

export class MyAdapterFactory extends BaseAdapterFactory {
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new MyDebugAdapter(dependencies);
  }
  
  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.PYTHON,
      displayName: 'Python',
      version: '1.0.0',
      // ... other metadata
    };
  }
}
```

### Using Session Types

```typescript
import { 
  SessionState, 
  DebugSessionInfo,
  Breakpoint 
} from '@debugmcp/shared';

function handleSessionState(session: DebugSessionInfo) {
  switch (session.state) {
    case SessionState.RUNNING:
      console.log('Session is running');
      break;
    case SessionState.PAUSED:
      console.log('Session is paused');
      break;
    // ... handle other states
  }
}
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Type Checking

```bash
npm run type-check
```

## Architecture

This package follows a clear separation of concerns:

1. **Interfaces** - Define contracts that implementations must follow
2. **Types** - Define data structures and type aliases
3. **Base Classes** - Provide common functionality for implementations
4. **Enumerations** - Define constant values and states

## Migration Guide

If you're migrating from the monolithic structure to use this shared package:

1. Update your imports:
   ```typescript
   // Before
   import { IDebugAdapter } from '../adapters/debug-adapter-interface.js';
   
   // After
   import { IDebugAdapter } from '@debugmcp/shared';
   ```

2. Remove local interface definitions that are now in shared
3. Update your `tsconfig.json` to reference the shared package
4. Ensure your package.json includes `@debugmcp/shared` as a dependency

## Contributing

When adding new shared types or interfaces:

1. Place interfaces in `src/interfaces/`
2. Place types in `src/models/`
3. Place base classes in `src/factories/`
4. Update `src/index.ts` to export new additions
5. Document the additions in this README
6. Add tests if applicable

## License

MIT - See LICENSE file in the repository root
