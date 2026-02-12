# packages/adapter-javascript/
@generated: 2026-02-11T23:48:26Z

## Overall Purpose and Responsibility

The `packages/adapter-javascript` directory provides a complete JavaScript/TypeScript debugging adapter implementation for the DebugMCP framework. This module wraps VS Code's js-debug adapter in a standardized interface, enabling seamless debugging of Node.js applications, TypeScript projects, and various JavaScript runtimes through the Debug Adapter Protocol (DAP). It serves as the bridge between the DebugMCP framework and VS Code's powerful JavaScript debugging capabilities while maintaining platform independence and robust error handling.

## Key Components and Integration

### Core Architecture Stack
The directory is organized into four main subsystems that work together to deliver comprehensive JavaScript debugging:

1. **Build and Dependency Management (`scripts/`)**
   - Intelligent acquisition and vendoring of Microsoft's js-debug DAP server
   - Multi-strategy asset management (local development, source builds, prebuilt releases)
   - Cross-platform compatibility with robust retry logic and error handling

2. **Core Adapter Implementation (`src/`)**
   - `JavascriptDebugAdapter`: Main DAP protocol handler and debugging session manager
   - `JavascriptAdapterFactory`: Environment validation and adapter instantiation
   - Comprehensive utilities for cross-platform executable resolution and TypeScript detection

3. **Test Infrastructure (`tests/`)**
   - Complete validation suite covering unit tests, integration scenarios, and edge cases
   - Mock infrastructure for filesystem, environment, and process management
   - Cross-platform compatibility testing and error handling validation

4. **Configuration (`vitest.config.ts`)**
   - TypeScript-first testing environment with high coverage standards (90%)
   - Monorepo-aware module resolution and workspace aliasing

### Integration Flow
The components integrate through a carefully orchestrated workflow:
1. **Build Phase**: Scripts acquire and vendor the js-debug DAP server with platform-specific handling
2. **Runtime Initialization**: Factory validates environment (Node.js ≥14, dependencies) and creates adapter instances
3. **Configuration Processing**: Automatic TypeScript runtime detection and launch parameter transformation
4. **Protocol Management**: Full DAP communication through TCP transport with state tracking
5. **Quality Assurance**: Comprehensive testing validates all integration points and error scenarios

## Public API Surface

### Main Entry Points
- **`JavascriptAdapterFactory`**: Primary factory for creating and validating JavaScript debug adapter instances
- **`JavascriptDebugAdapter`**: Core debugging session management implementing IDebugAdapter interface
- **Configuration Utilities**: 
  - `transformConfig()`: Launch parameter transformation with TypeScript detection
  - `resolveNodeExecutable()`: Cross-platform Node.js executable resolution
  - `detectTsRunners()`: TypeScript runtime environment detection (tsx, ts-node)
- **Build Tooling**: `build-js-debug.js` CLI script for js-debug vendoring and dependency management

### Configuration Interface
The adapter supports flexible configuration through:
- **JsDebugConfig**: TypeScript interface for debugging configuration objects
- **Environment Variables**: JS_DEBUG_VERSION, JS_DEBUG_LOCAL_PATH, build flags
- **Automatic Detection**: ESM projects, TypeScript runtimes, container environments

## Internal Organization and Data Flow

### Architectural Patterns
- **Factory Pattern**: Centralized adapter creation with comprehensive environment validation
- **Strategy Pattern**: Multiple vendoring approaches based on development context
- **Event-Driven Architecture**: DAP protocol handling with state management and lifecycle tracking
- **Dependency Injection**: Pluggable components for testing and customization

### State Management and Lifecycle
1. **UNINITIALIZED** → Environment validation and dependency checking
2. **INITIALIZING** → Configuration transformation and runtime detection
3. **READY** → TCP transport setup and DAP server coordination
4. **CONNECTED** → Active debugging session with protocol event handling
5. **Error Recovery** → Graceful degradation and user-friendly error messaging

### Cross-Platform Abstraction
- Platform-aware executable resolution with proper extensions and PATH handling
- Container environment detection (MCP_CONTAINER, MCP_WORKSPACE_ROOT)
- Windows/Unix compatibility with shell fallbacks and path normalization

## Important Patterns and Conventions

### Robustness and Reliability
- **Comprehensive Error Handling**: Actionable error messages with platform-specific guidance
- **Retry Mechanisms**: Exponential backoff for network operations with rate limit awareness
- **Validation Pipeline**: SHA256 checksums, dependency verification, and runtime checks
- **Graceful Fallbacks**: Safe defaults when preferred tools or configurations are unavailable

### Developer Experience
- **Zero-Configuration**: Automatic TypeScript runtime detection and intelligent defaults
- **Offline Development**: Local path overrides and cached dependency management
- **Debugging Support**: Comprehensive logging and diagnostic information
- **CI/CD Integration**: Environment-driven configuration with sensible production defaults

### Quality Assurance
- **High Test Coverage**: 90% coverage requirement across all metrics
- **Cross-Platform Testing**: Windows and Unix compatibility validation
- **Integration Testing**: Real DAP protocol scenarios and error condition handling
- **Performance**: Memoized executable resolution and cached TypeScript detection

This module represents a production-ready, enterprise-grade debugging solution that seamlessly integrates JavaScript and TypeScript debugging capabilities into the DebugMCP ecosystem while maintaining exceptional reliability, cross-platform compatibility, and developer experience.