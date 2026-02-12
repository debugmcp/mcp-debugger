# src/implementations/
@generated: 2026-02-11T23:47:40Z

## Overall Purpose and Responsibility

The `src/implementations` directory provides concrete, production-ready implementations of all core abstraction interfaces defined in the debugmcp system. This module serves as the "implementation layer" that bridges domain interfaces with real Node.js runtime capabilities, enabling the system to interact with the operating system, file system, network, and external processes.

## Key Components and Relationships

### Core System Abstractions
- **FileSystemImpl** - Production file system operations using `fs-extra`
- **ProcessManagerImpl** - Child process management wrapping Node.js `child_process`
- **NetworkManagerImpl** - Network server creation and port discovery using Node.js `net`
- **ProcessEnvironment** - Environment variable access with immutable snapshot pattern

### Process Launching Ecosystem
- **ProcessLauncherImpl** - Basic process spawning with enhanced wrapper interfaces
- **DebugTargetLauncherImpl** - Python debugging with `debugpy` integration
- **ProxyProcessLauncherImpl** - Specialized proxy worker process management with IPC
- **ProcessAdapter/ProxyProcessAdapter** - Event-driven process wrappers with lifecycle management
- **ProcessLauncherFactoryImpl** - Central factory for creating launcher instances

### Utility Components
- **WhichCommandFinder** - Command path resolution using system PATH with optional caching

## Public API Surface and Entry Points

### Main Export (index.ts)
Central barrel export providing clean API access to all implementations:
```typescript
import { 
  FileSystemImpl, ProcessManagerImpl, NetworkManagerImpl,
  ProcessLauncherImpl, DebugTargetLauncherImpl, ProxyProcessLauncherImpl,
  ProcessLauncherFactoryImpl 
} from '@debugmcp/implementations'
```

### Key Factory Pattern
**ProcessLauncherFactoryImpl** serves as the primary entry point for process-related operations, creating pre-configured launcher instances for different use cases.

## Internal Organization and Data Flow

### Layered Architecture
1. **Interface Layer**: All classes implement contracts from `@debugmcp/shared`
2. **Adapter Layer**: Wraps Node.js APIs with enhanced domain interfaces
3. **Enhancement Layer**: Adds debugging, proxy capabilities, and resource management

### Data Flow Patterns
- **Environment Access**: Snapshot-based consistency model captures environment state at construction
- **Process Lifecycle**: Event-driven architecture with proper cleanup and resource management
- **Network Operations**: Promise-based async patterns for server creation and port discovery
- **File Operations**: Enhanced fs-extra capabilities with defensive copying

## Important Patterns and Conventions

### Resource Management
- **Automatic Cleanup**: Event listener tracking and disposal to prevent memory leaks
- **Defensive Copying**: All returned data structures are copies to prevent external mutation
- **Proper Disposal**: Explicit cleanup methods and timeout-based termination

### Error Handling
- **Error Translation**: Third-party errors converted to domain-specific exceptions
- **Graceful Degradation**: Multiple fallback strategies (especially in ProcessManagerImpl.exec())
- **Comprehensive Logging**: Detailed diagnostic information for debugging

### Initialization Patterns
- **State Machines**: ProxyProcessAdapter uses initialization states for lifecycle tracking
- **Promise-based Initialization**: Async setup with timeout and cleanup mechanisms
- **Message-based Handshakes**: IPC communication for proxy process readiness detection

### Configuration Management
- **Environment Filtering**: Test-related environment variable removal for clean proxy environments
- **Working Directory Management**: Consistent project root directory setup
- **Diagnostic Configuration**: Built-in debugging flags and trace options

This implementation layer provides the critical bridge between abstract interfaces and concrete Node.js runtime capabilities, enabling the debugmcp system to operate effectively in production environments while maintaining clean architectural boundaries.