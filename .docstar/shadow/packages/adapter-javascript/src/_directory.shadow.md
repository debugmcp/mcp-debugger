# packages\adapter-javascript\src/
@generated: 2026-02-12T21:06:01Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/src` directory implements a comprehensive JavaScript/TypeScript debug adapter for the DebugMCP framework. It provides a complete debugging solution that wraps VS Code's js-debug adapter in a standardized interface, enabling intelligent runtime detection, configuration transformation, and lifecycle management for JavaScript and TypeScript debugging sessions.

## Key Components and Integration

### Core Architecture
- **`index.ts`**: Public API barrel module exposing all components through clean re-exports
- **`javascript-adapter-factory.ts`**: Factory implementation with environment validation and adapter instantiation
- **`javascript-debug-adapter.ts`**: Main adapter class managing state, DAP protocol handling, and configuration transformation
- **`types/`**: Type definitions providing flexible configuration contracts
- **`utils/`**: Infrastructure utilities for environment detection, executable resolution, and launch coordination

### Component Relationships
The components form a layered architecture where the factory validates the environment and creates adapter instances, the adapter orchestrates debugging sessions using utilities for runtime detection and configuration analysis, while types provide the contract definitions. The utilities serve as the foundation layer, enabling intelligent decisions about TypeScript/ESM projects and executable locations.

## Public API Surface

### Main Entry Points
- **`JavascriptAdapterFactory`**: Entry point for creating validated adapter instances
- **`JavascriptDebugAdapter`**: Core debugging session manager implementing IDebugAdapter
- **`JsDebugConfig`**: Configuration type for debugging parameters

### Utilities
- **`resolveNodeExecutable()`**: Cross-platform Node.js executable resolution
- **`detectTsRunners()`**: TypeScript runtime detection (tsx, ts-node)
- **`transformConfig()`**: Configuration transformation pipeline

## Internal Organization and Data Flow

### Validation → Creation → Execution Pipeline
1. **Factory Validation**: Environment checks for Node.js version, vendor dependencies, and TypeScript runners
2. **Adapter Creation**: Instantiation with validated dependencies and metadata
3. **Session Management**: State transitions, DAP protocol handling, and configuration transformation
4. **Runtime Coordination**: Launch barriers, executable resolution, and project analysis

### Configuration Intelligence
The adapter employs sophisticated project analysis to automatically detect TypeScript projects, ESM modules, and appropriate runtimes. It transforms generic debug configurations into js-debug-specific formats with intelligent defaults for source maps, output files, and loader selection.

### State Management
Comprehensive state tracking through AdapterState enum (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING) with event-driven transitions and cleanup mechanisms.

## Important Patterns and Conventions

### Defensive Programming
- No-throw filesystem operations with graceful degradation
- Safe error handling with user-friendly error translation
- Timeout mechanisms preventing blocking operations
- Multiple fallback strategies for executable resolution

### Platform Abstraction
- Cross-platform executable resolution (Windows/POSIX)
- Container environment support (MCP_CONTAINER, MCP_WORKSPACE_ROOT)
- Path normalization and binary search across different environments

### Dependency Injection
- FileSystem abstraction enabling comprehensive testing
- Modular utilities with clear separation of concerns
- Caching layers for expensive detection operations

### Proxy Infrastructure Integration
- TCP-only transport mode for proxy architecture
- Port validation requirements for external coordination
- Event-driven communication with ProxyManager

The module serves as a complete debugging solution that intelligently adapts to different JavaScript/TypeScript environments while maintaining compatibility with the broader DebugMCP ecosystem through standardized interfaces and robust error handling.