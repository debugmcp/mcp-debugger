# src\implementations/
@children-hash: 74c9f0a4eb1643df
@generated: 2026-02-15T09:01:26Z

## Overall Purpose and Responsibility

The `src/implementations` directory contains production-ready concrete implementations of all core abstractions defined in the debugmcp system. This module serves as the bridge between domain interfaces and platform-specific APIs (primarily Node.js), providing the runtime implementations that enable the debugging framework to operate in production environments.

## Key Components and Architecture

### Core Infrastructure Implementations
- **ProcessManagerImpl**: Wraps Node.js `child_process` module for process spawning and execution
- **FileSystemImpl**: Leverages `fs-extra` library to provide enhanced file system operations
- **NetworkManagerImpl**: Abstracts Node.js `net` module for server creation and port allocation
- **ProcessEnvironment**: Implements environment variable access with immutable snapshot pattern

### Specialized Process Launchers
- **ProcessLauncherImpl**: Basic process launching with event-driven wrapper
- **DebugTargetLauncherImpl**: Python debugpy integration for debug target processes  
- **ProxyProcessLauncherImpl**: Complex proxy worker process management with initialization state machine
- **ProcessLauncherFactoryImpl**: Factory for creating configured launcher instances

### Utility Components
- **WhichCommandFinder**: System PATH command resolution using the 'which' package
- **ProcessAdapter**: Event-driven wrapper converting IChildProcess to IProcess
- **ProxyProcessAdapter**: Enhanced adapter with initialization tracking and IPC communication

## Public API Surface

### Main Entry Points (via index.ts)
```typescript
// Core implementations
export { FileSystemImpl, ProcessManagerImpl, NetworkManagerImpl }

// Process launcher family
export { 
  ProcessLauncherImpl, 
  DebugTargetLauncherImpl, 
  ProxyProcessLauncherImpl,
  ProcessLauncherFactoryImpl 
}
```

### Key Interfaces Fulfilled
- `IFileSystem` - File operations with fs-extra enhancements
- `IProcessManager` - Process spawning and execution
- `INetworkManager` - Network server and port management  
- `IEnvironment` - Environment variable access
- `CommandFinder` - Executable path resolution

## Internal Organization and Data Flow

### Adapter Pattern Architecture
Most implementations follow the adapter pattern, wrapping Node.js APIs with domain-specific interfaces. The `ProcessAdapter` and `ProxyProcessAdapter` classes exemplify this pattern by converting native `ChildProcess` objects into `IProcess` interfaces with enhanced event handling.

### Resource Management Strategy
- **Immutable Snapshots**: Environment variables captured at construction time
- **Defensive Copying**: All data structures returned as copies to prevent mutation
- **Automatic Cleanup**: Event listener tracking and disposal to prevent memory leaks
- **Timeout Handling**: Process operations include timeout mechanisms with fallback termination

### State Management Patterns
- **Initialization State Machine**: `ProxyProcessAdapter` uses 'none' | 'waiting' | 'completed' | 'failed' states
- **Caching Strategy**: `WhichCommandFinder` provides optional command path caching
- **Event-Driven Communication**: IPC message handling with detailed debugging events

## Important Patterns and Conventions

### Error Handling
- **Error Translation**: Native errors converted to domain-specific exceptions (e.g., `CommandNotFoundError`)
- **Graceful Degradation**: Multiple fallback strategies in process execution
- **Defensive Programming**: Comprehensive validation and warning systems

### Process Management
- **Process Group Handling**: Unix process group termination for complete cleanup
- **Environment Filtering**: Test-related variables filtered from proxy processes  
- **IPC Configuration**: Proper stdio setup with `detached: false` for communication channels

### Asynchronous Operations
- **Promise-based APIs**: All file system and network operations use modern async/await
- **Event Emitter Integration**: Process lifecycle events properly forwarded and managed
- **Timeout Protection**: Long-running operations include timeout and cleanup mechanisms

This directory represents the concrete runtime layer of the debugmcp system, translating abstract interfaces into working Node.js implementations while maintaining clean separation of concerns and robust error handling.