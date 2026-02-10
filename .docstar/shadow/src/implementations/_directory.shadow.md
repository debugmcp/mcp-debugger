# src/implementations/
@generated: 2026-02-10T01:19:43Z

## Overall Purpose
The `src/implementations` directory contains concrete production implementations of all core system interfaces, serving as the bridge between the debugmcp system's abstract contracts and Node.js platform APIs. This module transforms interface specifications into working functionality using established Node.js libraries and patterns.

## Key Components and Relationships

### Core Infrastructure Implementations
- **ProcessEnvironment**: Immutable environment variable access with snapshot-based consistency
- **FileSystemImpl**: Enhanced file operations wrapper around `fs-extra` library
- **ProcessManagerImpl**: Child process spawning and execution via Node.js `child_process` module
- **NetworkManagerImpl**: Network server creation and port allocation using Node.js `net` module

### Specialized Process Management Layer
- **ProcessAdapter**: Transforms `IChildProcess` into enhanced `IProcess` with EventEmitter interface and proper resource cleanup
- **ProcessLauncherImpl**: Basic process launching with adapter wrapping
- **DebugTargetLauncherImpl**: Python debugging with debugpy integration and automatic port allocation
- **ProxyProcessAdapter**: Advanced process wrapper with initialization state machine and IPC handling
- **ProxyProcessLauncherImpl**: Specialized proxy worker process launcher with environment filtering

### Support Utilities
- **WhichCommandFinder**: Command path resolution using the `which` package with optional caching
- **ProcessLauncherFactoryImpl**: Factory for creating configured launcher instances

## Public API Surface
The module exposes its functionality through a clean barrel export pattern in `index.ts`:

**Primary Entry Points:**
- `FileSystemImpl` - File system operations
- `ProcessManagerImpl` - Basic process management
- `NetworkManagerImpl` - Network utilities
- `ProcessLauncherImpl` - Standard process launching
- `DebugTargetLauncherImpl` - Python debug target creation
- `ProxyProcessLauncherImpl` - Proxy worker management
- `ProcessLauncherFactoryImpl` - Factory for launcher instances

## Internal Organization and Data Flow

### Layered Architecture
1. **Base Layer**: Direct Node.js API wrappers (ProcessManagerImpl, NetworkManagerImpl, FileSystemImpl)
2. **Adapter Layer**: Enhanced interfaces with lifecycle management (ProcessAdapter, ProxyProcessAdapter)
3. **Specialized Layer**: Domain-specific launchers with business logic (DebugTargetLauncherImpl, ProxyProcessLauncherImpl)
4. **Factory Layer**: Instance creation and configuration (ProcessLauncherFactoryImpl)

### Data Flow Patterns
- **Environment Access**: Snapshot captured at construction → immutable access throughout lifecycle
- **Process Launching**: Factory → Launcher → ProcessManager → Adapter → Enhanced IProcess
- **Debug Target Creation**: NetworkManager (port allocation) → ProcessManager (spawn) → IDebugTarget wrapper
- **Proxy Process Lifecycle**: Environment setup → Launch → Initialization handshake → IPC communication

## Important Patterns and Conventions

### Resource Management
- Automatic event listener cleanup tracking to prevent memory leaks
- Proper disposal methods for complex adapters
- Timeout-based resource cleanup with graceful degradation

### Error Handling
- Consistent error translation from Node.js APIs to domain exceptions
- Defensive programming with fallback behaviors
- Comprehensive async error handling with proper cleanup

### State Management
- Immutable snapshots for environment variables
- State machines for complex process initialization
- Cache management with optional performance optimization

### Testing Support
- Environment variable filtering to prevent test contamination
- Clear cache methods for test isolation
- Multiple return type handling for mock compatibility

The module serves as the concrete foundation for the entire debugmcp system, providing reliable, well-tested implementations that abstract away Node.js complexity while maintaining performance and proper resource management.