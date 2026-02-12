# src\implementations/
@generated: 2026-02-12T21:05:46Z

## Directory Purpose

The `src/implementations` directory provides production-ready concrete implementations of all core interfaces defined in the shared layer. This module serves as the primary implementation layer for the debugmcp system, containing platform-specific adapters that bridge domain interfaces with Node.js APIs and third-party libraries.

## Key Components and Integration

### Core System Implementations
- **FileSystemImpl**: Production file system adapter using fs-extra for enhanced operations
- **ProcessManagerImpl**: Node.js child_process wrapper for spawning and executing processes
- **NetworkManagerImpl**: Network abstraction layer using Node.js net module for server creation and port discovery
- **ProcessEnvironment**: Environment variable access with immutable snapshot pattern

### Process Launching Ecosystem
- **ProcessLauncherImpl**: Basic process spawning with enhanced IProcess wrapper
- **DebugTargetLauncherImpl**: Specialized Python debugging launcher with debugpy integration
- **ProxyProcessLauncherImpl**: Advanced proxy worker launcher with initialization state machine
- **ProcessAdapter/ProxyProcessAdapter**: Process wrappers with event handling and resource cleanup

### Utility Implementations
- **WhichCommandFinder**: System PATH command resolution with optional caching
- **ProcessLauncherFactoryImpl**: Factory for creating configured launcher instances

## Public API Surface

### Main Entry Point
The **index.ts** barrel export provides the complete public API:
```typescript
// Core implementations
export { FileSystemImpl, ProcessManagerImpl, NetworkManagerImpl }

// Process launching suite
export { ProcessLauncherImpl, DebugTargetLauncherImpl, ProxyProcessLauncherImpl, ProcessLauncherFactoryImpl }
```

### Primary Usage Pattern
Consumers import implementations through the main index:
```typescript
import { FileSystemImpl, ProcessManagerImpl } from '@debugmcp/implementations'
```

## Internal Organization and Data Flow

### Architectural Patterns
1. **Adapter Pattern**: All implementations wrap Node.js APIs with domain interfaces
2. **Factory Pattern**: ProcessLauncherFactoryImpl creates configured instances
3. **Strategy Pattern**: Multiple launcher implementations for different use cases
4. **Resource Management**: Automatic cleanup and disposal patterns throughout

### Data Flow Architecture
1. **Environment Layer**: ProcessEnvironment provides immutable system context
2. **File System Layer**: FileSystemImpl handles all disk operations
3. **Process Management Layer**: ProcessManagerImpl spawns processes, launchers provide specialized wrappers
4. **Network Layer**: NetworkManagerImpl manages server creation and port allocation
5. **Command Resolution**: WhichCommandFinder locates system executables

### Cross-Component Dependencies
- Process launchers depend on ProcessManager for spawning
- Debug launchers use NetworkManager for port discovery
- Proxy launchers require FileSystem for working directory resolution
- All components use shared interfaces for consistent contracts

## Important Patterns and Conventions

### Resource Management
- Event listener tracking and cleanup in process adapters
- Defensive copying in environment access
- Proper server cleanup in network operations
- Promise-based async patterns throughout

### Error Handling
- Custom error translation (CommandNotFoundError)
- Comprehensive try/catch patterns
- Timeout handling with fallback mechanisms
- Early exit detection and graceful degradation

### State Management
- Immutable snapshots for environment variables
- State machines for proxy process initialization
- Caching strategies with optional disable
- Mixed consistency models (snapshot vs live data)

This implementation layer provides the production foundation that bridges domain abstractions with platform-specific Node.js capabilities, enabling the debugmcp system to operate reliably across different environments while maintaining clean separation of concerns.