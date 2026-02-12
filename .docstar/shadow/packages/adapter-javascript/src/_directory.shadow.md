# packages/adapter-javascript/src/
@generated: 2026-02-11T23:48:00Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/src` directory contains the complete implementation of the `@debugmcp/adapter-javascript` package, providing a standardized JavaScript/TypeScript debugging adapter for the DebugMCP framework. This module wraps VS Code's js-debug adapter in a unified interface, enabling seamless debugging of Node.js applications, TypeScript projects, and various JavaScript runtimes through the Debug Adapter Protocol (DAP).

## Key Components and Architecture

### Core Adapter System
- **JavascriptDebugAdapter**: Main adapter implementation that manages debugging sessions, handles DAP protocol communication, and coordinates with the vendored VS Code js-debug adapter
- **JavascriptAdapterFactory**: Factory pattern implementation that validates the debugging environment and creates adapter instances with proper dependency injection
- **index.ts**: Public API barrel that exports all core components, utilities, and types

### Configuration and Environment Detection
- **utils/ directory**: Comprehensive toolkit for cross-platform executable resolution, project configuration detection, and launch coordination
- **types/ directory**: TypeScript type definitions and interfaces for debugging configuration objects
- Automatic TypeScript runtime detection (tsx, ts-node) and ESM project identification

### Transport and Protocol Handling
- TCP-only transport mode designed for proxy infrastructure
- Full DAP protocol support with state management and event processing
- Launch barrier pattern for synchronized debugger startup

## Public API Surface

### Main Entry Points
- **JavascriptAdapterFactory**: Creates and validates JavaScript debug adapter instances
- **JavascriptDebugAdapter**: Core debugging session management and DAP communication
- **transformConfig()**: Configuration transformation for launch parameters
- **resolveNodeExecutable()**: Node.js executable path resolution
- **detectTsRunners()**: TypeScript runtime environment detection

### Configuration Types
- **JsDebugConfig**: TypeScript interface for debugging configuration objects
- Support for flexible key-value configuration patterns

## Internal Organization and Data Flow

### Initialization Flow
1. **Factory Validation**: Environment checks for Node.js version ≥14, vendor dependencies, and TypeScript runtimes
2. **Adapter Creation**: Instantiation with validated environment and cached executable paths
3. **Configuration Transform**: Launch parameters adapted for js-debug with automatic TypeScript detection
4. **Connection Management**: TCP proxy coordination with state tracking

### Runtime Detection Pipeline
- **Multi-tier Resolution**: Local node_modules → system PATH → configuration files → safe defaults
- **Caching Layer**: Memoized results for executable paths and TypeScript runner detection
- **Platform Abstraction**: Windows/Unix executable handling with proper extension resolution

### State Management
- **Lifecycle Tracking**: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- **Event-Driven Architecture**: EventEmitter pattern for state transitions and protocol events
- **Thread Coordination**: Active debugging session tracking with automatic cleanup

## Important Patterns and Conventions

### Error Resilience
- Comprehensive validation with user-friendly error messages
- Graceful fallbacks for missing dependencies or configuration
- No-throw utility design with safe defaults

### Cross-Platform Support
- Platform-aware executable resolution with proper extensions
- Container environment detection (MCP_CONTAINER, MCP_WORKSPACE_ROOT)
- Path normalization and filesystem abstraction

### Extensibility Design
- Dependency injection support for testing and customization
- Modular utility architecture for easy extension
- Clear separation between core adapter logic and helper utilities

### TypeScript Integration
- Automatic runtime selection with priority: user override → tsx → ts-node → node
- ESM project detection and loader configuration
- Source map handling and output file resolution

The directory represents a complete, production-ready debugging solution that bridges the gap between the DebugMCP framework and VS Code's powerful JavaScript debugging capabilities, while maintaining platform independence and robust error handling.