# packages\adapter-javascript\src/
@generated: 2026-02-12T21:01:13Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/src` directory implements a complete JavaScript/TypeScript debugging adapter for the DebugMCP framework. It provides a standardized interface that wraps the VS Code js-debug adapter, enabling JavaScript and TypeScript debugging capabilities with automatic runtime detection, configuration transformation, and cross-platform executable resolution.

## Key Components and Relationships

### Core Adapter Architecture
- **JavascriptAdapterFactory**: Entry-point factory that validates the debugging environment (Node.js version, vendor dependencies, TypeScript runners) and creates adapter instances
- **JavascriptDebugAdapter**: Main adapter implementation that manages debugging lifecycle, transforms configurations, and bridges between DebugMCP framework and vendored js-debug adapter
- **State Management**: Adapter transitions through defined states (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING) with event emission

### Configuration and Detection Layer (`utils/`)
- **Config Transformer**: Analyzes project structure to detect ESM/CommonJS modules, TypeScript path mappings, and build output patterns
- **Executable Resolver**: Cross-platform Node.js executable discovery using 4-tier precedence (preferred → process.execPath → PATH → fallback)
- **TypeScript Detector**: Discovers local and global tsx/ts-node executables for TypeScript debugging support
- **Launch Barrier**: Synchronizes debugger startup by coordinating timing between launch and readiness

### Type System (`types/`)
- **JsDebugConfig**: Flexible configuration interface providing type-safe debugging parameter handling

## Public API Surface

### Primary Entry Points
- **JavascriptAdapterFactory**: Factory for creating validated adapter instances
- **JavascriptDebugAdapter**: Main debugging session manager
- **resolveNodeExecutable()**: Simplified Node.js executable resolution
- **detectTsRunners()**: TypeScript runtime discovery
- **transformConfig()**: Configuration analysis and transformation

### Core Capabilities
- Full DAP (Debug Adapter Protocol) compliance with comprehensive feature support
- Automatic TypeScript detection and runtime selection (tsx → ts-node → node)
- ESM project detection with appropriate loader configuration
- Cross-platform executable resolution and path normalization
- TCP-only transport for proxy infrastructure compatibility

## Internal Organization and Data Flow

### Layered Architecture
1. **Factory Layer**: Environment validation and adapter instantiation
2. **Adapter Layer**: Protocol handling, state management, and configuration transformation
3. **Utilities Layer**: Configuration detection, executable resolution, and launch coordination
4. **Type Layer**: TypeScript definitions for type-safe operations

### Configuration Flow
1. Project analysis (package.json, tsconfig.json, file extensions)
2. Runtime detection (Node.js, tsx, ts-node availability)
3. Configuration transformation (generic config → js-debug specific)
4. Launch command construction with appropriate flags and loaders

### Debugging Lifecycle
1. Factory validation (Node.js version, vendor dependencies)
2. Adapter initialization and environment setup
3. Configuration transformation with automatic TypeScript detection
4. Launch coordination through barrier pattern
5. DAP event handling and state management

## Important Patterns and Conventions

### Design Principles
- **Graceful Degradation**: Safe defaults when detection fails, warnings instead of errors for non-critical issues
- **Caching Strategy**: Memoized expensive operations (Node.js path resolution, TypeScript runner detection)
- **Platform Abstraction**: Cross-platform handling for Windows/Unix executable naming and paths
- **Dependency Injection**: Testable filesystem abstraction and configurable detection

### Error Handling
- **No-Throw Safety**: All filesystem operations wrapped with safe fallbacks
- **Error Translation**: Maps Node.js errors to user-friendly messages with installation guidance
- **Timeout Protection**: Launch barriers proceed with warnings rather than blocking indefinitely

### Constraints and Requirements
- **TCP Transport Only**: Required for proxy infrastructure integration
- **Synchronous Config Transform**: Interface limitation prevents async operations in configuration transformation
- **Vendored Dependency**: Must locate vsDebugServer.cjs in specific vendor paths
- **Container Support**: Handles MCP_CONTAINER and MCP_WORKSPACE_ROOT environment variables

This module serves as the complete JavaScript/TypeScript debugging solution within the DebugMCP ecosystem, providing robust runtime detection, configuration management, and debugging capabilities while maintaining compatibility with VS Code's proven js-debug adapter.