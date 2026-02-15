# packages\adapter-javascript\src/
@children-hash: c87a765b31525f99
@generated: 2026-02-15T09:01:49Z

## Purpose and Responsibility

This directory contains the complete implementation of the `@debugmcp/adapter-javascript` package, which provides JavaScript and TypeScript debugging capabilities for the DebugMCP framework. It wraps and standardizes VS Code's js-debug adapter to provide intelligent, auto-configuring debug sessions for JavaScript/TypeScript applications across diverse project environments.

## Key Components and Architecture

### Core Debug Adapter Infrastructure
- **JavascriptDebugAdapter** (javascript-debug-adapter.ts): Main adapter implementation that manages debugging sessions, wraps the vendored VS Code js-debug adapter, and handles state transitions through the DAP protocol
- **JavascriptAdapterFactory** (javascript-adapter-factory.ts): Factory class that validates environment prerequisites (Node.js version, vendored dependencies) and creates adapter instances
- **index.ts**: Public API entry point providing clean barrel exports of all components

### Intelligent Configuration System
The **utils/** directory provides a sophisticated configuration detection pipeline:
- **config-transformer.ts**: Orchestrates project analysis to detect ESM modules, TypeScript configurations, and output patterns
- **typescript-detector.ts**: Locates TypeScript runtime executables (tsx, ts-node) with local-first resolution
- **executable-resolver.ts**: Cross-platform Node.js executable path resolution
- **js-debug-launch-barrier.ts**: Coordinates debugger launch timing and readiness

### Type Definitions
- **types/js-debug-config.ts**: TypeScript type definitions for debugging configurations (currently a flexible placeholder for future expansion)

## Public API Surface

### Main Entry Points
```typescript
// Factory and adapter classes
JavascriptAdapterFactory: Factory for creating debug adapter instances
JavascriptDebugAdapter: Core debug adapter implementation

// Configuration utilities
resolveNodeExecutable(): Cross-platform Node.js path resolution
detectTsRunners(): TypeScript runtime detection with caching
transformConfig(): Primary configuration transformation orchestrator

// Types
JsDebugConfig: Configuration interface for JavaScript debugging
```

### Core Capabilities
- Automatic TypeScript/JavaScript project detection and configuration
- Cross-platform executable resolution (Node.js, tsx, ts-node)
- ESM and CommonJS project support with appropriate loader configuration
- Source map handling and output file pattern detection
- TypeScript path mapping support
- Comprehensive DAP protocol feature support including conditional breakpoints and exception handling

## Internal Organization and Data Flow

### Initialization Flow
1. **Factory Validation**: JavascriptAdapterFactory validates Node.js version, checks vendored js-debug availability, and detects TypeScript runtimes
2. **Adapter Creation**: Factory instantiates JavascriptDebugAdapter with validated environment
3. **Configuration Transform**: Adapter uses utils pipeline to auto-detect project characteristics and transform launch configurations
4. **Launch Coordination**: JsDebugLaunchBarrier synchronizes debugger startup with DAP events

### Configuration Detection Pipeline
1. **Project Analysis**: Examines package.json, tsconfig.json, and file extensions to determine project type
2. **Runtime Selection**: Chooses appropriate runtime (node, tsx, ts-node) based on project characteristics and availability
3. **Loader Configuration**: Automatically configures TypeScript loaders, source map support, and ESM handling
4. **Path Resolution**: Resolves executable paths, output directories, and source file locations

### State Management
- **Adapter States**: UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING
- **Connection Handling**: TCP-only transport mode for proxy infrastructure integration
- **Thread Tracking**: Maintains current debugging thread state for DAP event processing

## Important Patterns and Conventions

### Cross-Platform Compatibility
- Platform-aware executable resolution with proper extension handling (.exe, .cmd on Windows)
- Consistent path normalization across operating systems
- Environment variable respect (PATH, NODE_OPTIONS, MCP_CONTAINER, MCP_WORKSPACE_ROOT)

### Error Handling and Resilience
- No-throw filesystem operations throughout the utility layer
- Graceful degradation with sensible fallbacks when detection fails
- User-friendly error translation for common issues (missing dependencies, version mismatches)

### Performance and Caching
- Module-level caching for expensive detection operations (Node.js paths, TypeScript runners)
- Synchronous operations where possible to meet interface constraints
- Lazy evaluation patterns to minimize unnecessary work

### Dependency Architecture
- **Vendored Integration**: Wraps VS Code's js-debug adapter (vsDebugServer.cjs/js) found in vendor directory
- **Framework Integration**: Implements DebugMCP's IDebugAdapter interface with standardized lifecycle management
- **Utility Separation**: Clean separation between core adapter logic and reusable detection utilities

This package serves as a comprehensive, intelligent JavaScript/TypeScript debugging solution that minimizes manual configuration while providing robust support for diverse project environments and deployment scenarios.