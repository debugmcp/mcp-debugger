# packages/adapter-javascript/src/
@generated: 2026-02-10T21:26:56Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/src` directory implements a complete JavaScript/TypeScript debug adapter for the DebugMCP framework. This module bridges VS Code's vendored js-debug adapter with the standardized DebugMCP interface, providing comprehensive debugging capabilities for Node.js applications with automatic TypeScript runtime detection and configuration transformation.

## Key Components and Architecture

### Core Adapter Implementation
- **JavascriptDebugAdapter**: Main adapter class that wraps the vendored VS Code js-debug adapter, managing state transitions, DAP protocol handling, and launch configuration transformation
- **JavascriptAdapterFactory**: Factory implementation providing environment validation, dependency checking, and adapter instantiation with metadata configuration

### Public API Surface (index.ts)
- **JavascriptAdapterFactory** & **JavascriptDebugAdapter**: Core components for adapter creation and debugging sessions
- **JsDebugConfig**: TypeScript type definitions for debug configuration
- **Utility Functions**: resolveNodeExecutable, detectTsRunners, transformConfig for environment setup

### Utilities Ecosystem
- **Configuration Detection**: ESM project detection, TypeScript path mapping analysis, output file resolution
- **Executable Resolution**: Cross-platform Node.js and TypeScript runtime discovery with caching
- **Launch Coordination**: Barrier pattern implementation for debugger launch synchronization
- **Config Transformation**: Automatic TypeScript detection and runtime selection with fallback strategies

### Type System
- **JsDebugConfig**: Flexible configuration interface serving as foundation for future type refinement
- Strong TypeScript integration throughout with proper DAP protocol type definitions

## Internal Organization and Data Flow

### Layered Architecture
1. **Factory Layer**: Environment validation and adapter instantiation
2. **Adapter Layer**: DAP protocol handling and state management  
3. **Utilities Layer**: Configuration detection, executable resolution, and launch coordination
4. **Types Layer**: TypeScript definitions and contracts

### Component Relationships
- Factory validates environment using utilities before creating adapter instances
- Adapter leverages utilities for configuration transformation and executable resolution
- Launch barrier coordinates timing between adapter and debugger process
- All components use shared filesystem abstraction for testability

### Key Data Flow Patterns
- **Validation → Creation → Configuration → Launch**: Linear progression through adapter lifecycle
- **Heuristic Detection**: Multiple fallback strategies for TypeScript runtime and project type detection
- **Local-First Resolution**: Prioritizes project-local installations over global PATH
- **Fail-Safe Design**: Graceful degradation with sensible defaults rather than hard failures

## Important Patterns and Conventions

### Error Resilience
- Comprehensive try-catch wrapping around filesystem operations
- Distinction between critical errors (Node.js version) and warnings (TypeScript runners)
- Safe path resolution for both development and production contexts

### Platform Abstraction
- Cross-platform executable resolution with Windows/Unix awareness
- Container mode support via environment variables (MCP_CONTAINER, MCP_WORKSPACE_ROOT)
- TCP-only transport constraint for proxy infrastructure compatibility

### Performance & Testability
- Module-wide caching for expensive operations (executable paths, TypeScript detection)
- Dependency injection via configurable filesystem abstraction
- Synchronous operations where possible to match interface constraints
- Clear separation of concerns enabling focused unit testing

### TypeScript Integration
- Automatic TypeScript detection via file extensions and project structure
- Runtime selection priority: user override → tsx → ts-node → node
- ESM project detection with proper loader configuration
- Source map and output file handling for debugging experience

This module serves as a comprehensive JavaScript/TypeScript debugging solution that bridges the gap between VS Code's powerful js-debug adapter and the DebugMCP framework's standardized interface, providing robust environment detection, intelligent configuration, and reliable debugging capabilities across diverse project setups.