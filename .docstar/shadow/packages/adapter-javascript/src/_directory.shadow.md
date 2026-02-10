# packages/adapter-javascript/src/
@generated: 2026-02-10T01:19:55Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript/src` directory implements a complete JavaScript/TypeScript debug adapter for the DebugMCP framework. It provides intelligent debugging capabilities by wrapping VS Code's vendored js-debug adapter with environment detection, configuration transformation, and TypeScript runtime support.

## Key Components and Architecture

### Core Adapter Infrastructure
- **`index.ts`**: Public API barrel module that exposes the complete package interface
- **`JavascriptAdapterFactory`**: Factory implementation that validates environment requirements (Node.js version ≥14, vendor dependencies, TypeScript runtimes) before creating adapter instances
- **`JavascriptDebugAdapter`**: Main adapter class that manages debugging lifecycle, DAP protocol handling, and configuration transformation

### Supporting Infrastructure
- **`types/`**: Type definitions providing the foundational type system, currently centered around the flexible `JsDebugConfig` interface
- **`utils/`**: Core utility suite providing environment detection, executable resolution, configuration analysis, and launch coordination

## Public API Surface

### Primary Entry Points
- **`JavascriptAdapterFactory`**: Factory for creating validated adapter instances
- **`JavascriptDebugAdapter`**: Main debugging session manager implementing IDebugAdapter interface
- **`JsDebugConfig`**: TypeScript interface for debugging configurations

### Utility Functions
- **`resolveNodeExecutable()`**: Cross-platform Node.js executable discovery
- **`detectTsRunners()`**: TypeScript runtime detection (tsx, ts-node)
- **`transformConfig()`**: Intelligent configuration transformation for JavaScript/TypeScript projects

## Internal Organization and Data Flow

### Adapter Lifecycle Flow
```
Factory validation → Environment setup → Adapter creation → Configuration transform → Debug session management
```

### Configuration Intelligence
The adapter employs sophisticated heuristics to automatically configure debugging sessions:
1. **Project Type Detection**: Analyzes file extensions, package.json, and tsconfig.json to determine ESM/CommonJS and TypeScript requirements
2. **Runtime Selection**: Prioritizes user configuration, then tsx, ts-node, and finally plain Node.js
3. **Path Resolution**: Handles source maps, output files, and module loading automatically

### Transport and Protocol
- **TCP-only transport**: Designed for proxy infrastructure integration
- **DAP Protocol Wrapping**: Translates between DebugMCP interfaces and VS Code's js-debug adapter
- **State Management**: Tracks adapter state transitions and debugging session lifecycle

## Important Patterns and Conventions

### Defensive Programming
- **No-throw utilities**: All functions use graceful fallbacks rather than exceptions
- **Safe filesystem operations**: Wrapped in try-catch blocks with sensible defaults
- **Environment validation**: Comprehensive checks before adapter instantiation

### Intelligent Defaults
- **Local-first resolution**: Searches project-local executables before system PATH
- **Automatic TypeScript detection**: Uses file extensions and project configuration
- **Cross-platform compatibility**: Handles Windows/Unix differences transparently

### Dependency Management
- **Vendored js-debug**: Wraps VS Code's proven JavaScript debugger
- **Minimal external dependencies**: Relies primarily on Node.js built-ins
- **Test-friendly design**: Dependency injection for filesystem operations

## Critical Capabilities

The adapter provides comprehensive JavaScript/TypeScript debugging including:
- Source map support and automatic path resolution
- TypeScript runtime integration (tsx, ts-node)
- ESM/CommonJS project handling
- Conditional breakpoints and log points
- Exception handling (caught/uncaught filtering)
- Container and workspace environment support
- Memory optimization and inspector flag normalization

This implementation serves as the bridge between DebugMCP's standardized debugging interface and the rich JavaScript/TypeScript debugging ecosystem, providing intelligent configuration and robust error handling while maintaining compatibility with existing development workflows.