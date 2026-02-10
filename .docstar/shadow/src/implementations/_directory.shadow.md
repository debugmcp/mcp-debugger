# src/implementations/
@generated: 2026-02-10T21:26:18Z

## Purpose

The `src/implementations` directory provides production-ready concrete implementations of all core abstraction interfaces in the debugmcp system. This module serves as the bridge between domain abstractions and Node.js runtime capabilities, enabling dependency injection and testability throughout the application.

## Key Components and Architecture

### Core System Implementations
- **ProcessManagerImpl** - Wraps Node.js `child_process` module for process spawning and execution
- **FileSystemImpl** - Enhanced file system operations using `fs-extra` with promise-based APIs
- **NetworkManagerImpl** - Node.js networking abstraction for server creation and port discovery
- **ProcessEnvironment** - Immutable environment variable access with snapshot consistency
- **WhichCommandFinder** - Command path resolution with optional caching using the `which` package

### Specialized Process Launchers
- **ProcessLauncherImpl** - Basic process launching with enhanced IProcess wrapper
- **DebugTargetLauncherImpl** - Python debugpy integration with automatic port allocation
- **ProxyProcessLauncherImpl** - Advanced proxy process management with initialization handshaking
- **ProcessLauncherFactoryImpl** - Factory for creating configured launcher instances

## Public API Surface

### Main Entry Point
The `index.ts` barrel export provides centralized access to all implementations:
```typescript
import { 
  FileSystemImpl, 
  ProcessManagerImpl, 
  NetworkManagerImpl,
  ProcessLauncherImpl,
  DebugTargetLauncherImpl,
  ProxyProcessLauncherImpl,
  ProcessLauncherFactoryImpl 
} from '@debugmcp/implementations'
```

### Key Interfaces Implemented
- `IEnvironment` - Environment variable access
- `IFileSystem` - File system operations  
- `INetworkManager` - Network operations
- `IProcessManager` - Process management
- `IProcessLauncher` - Process launching
- `IDebugTargetLauncher` - Debug target creation
- `IProxyProcessLauncher` - Proxy process management
- `CommandFinder` - Command path resolution

## Internal Organization and Data Flow

### Adapter Pattern Implementation
Most classes follow the adapter pattern, wrapping Node.js built-in modules (`fs`, `child_process`, `net`) with domain-specific interfaces. This enables:
- Consistent error handling across the system
- Testability through interface substitution
- Clean separation between domain logic and platform specifics

### Process Management Hierarchy
```
ProcessManagerImpl (core spawning)
  ↓
ProcessLauncherImpl (basic wrapping)
  ↓
DebugTargetLauncherImpl (debug-specific)
ProxyProcessLauncherImpl (proxy-specific with state machine)
```

### Resource Management
- **Snapshot Pattern**: ProcessEnvironment captures immutable environment state
- **Defensive Copying**: All returned data structures prevent external mutation
- **Lifecycle Management**: ProcessAdapter tracks listeners and provides cleanup
- **State Machine**: ProxyProcessAdapter manages initialization states

## Important Patterns and Conventions

### Error Handling
- Native Node.js errors are translated to domain-specific error types
- Comprehensive try/catch patterns with meaningful error messages
- Graceful degradation for edge cases (especially in testing environments)

### Async/Promise Patterns
- All I/O operations use modern async/await patterns
- Promise-based wrappers around callback-based Node.js APIs
- Proper resource cleanup in async operations

### Dependency Injection Ready
- All implementations accept their dependencies through constructors or factory methods
- Clean interfaces enable easy mocking and testing
- Separation of concerns between interface contracts and implementation details

### Configuration Management
- Environment-based configuration through ProcessEnvironment
- Optional caching strategies (WhichCommandFinder)
- Flexible process launching with comprehensive options support

This module is essential for production deployment, providing robust, well-tested implementations of all system abstractions while maintaining clean architectural boundaries.