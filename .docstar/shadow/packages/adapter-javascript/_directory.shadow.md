# packages\adapter-javascript/
@children-hash: 794c8d4c16b4b7c3
@generated: 2026-02-21T08:29:07Z

## Overall Purpose and Responsibility

The `adapter-javascript` package provides a comprehensive JavaScript/TypeScript debug adapter for the debugmcp framework. This module acts as an intelligent bridge between the Debug Adapter Protocol (DAP) and Microsoft's `vscode-js-debug` server, offering automated environment detection, runtime resolution, and configuration management for JavaScript and TypeScript debugging sessions. It handles the complexities of modern JavaScript development environments including ESM/CommonJS projects, TypeScript compilation, and cross-platform runtime discovery.

## Key Components and Integration

### Core Adapter Stack
- **JavascriptDebugAdapter** (`src/`): The primary DAP-compliant adapter class that manages debugging sessions, handles protocol communication, and provides JavaScript/TypeScript-specific debugging capabilities
- **JavascriptAdapterFactory** (`src/`): Factory implementation with environment validation (Node.js ≥14, js-debug availability) and dependency injection for adapter instantiation
- **Utilities Layer** (`src/utils/`): Intelligent configuration detection system providing cross-platform executable resolution, project type analysis, and launch configuration transformation

### Dependency Management System
- **Build Scripts** (`scripts/`): Automated vendoring system that acquires and builds Microsoft's `vscode-js-debug` DAP server through multiple strategies (local override, prebuilt download, source compilation, hybrid modes)
- **Vendor Strategy Engine** (`scripts/lib/`): Environment-driven configuration system with intelligent GitHub asset selection and cross-platform compatibility

### Quality Assurance Infrastructure
- **Test Suite** (`tests/`): Comprehensive unit tests with mock-based isolation ensuring DAP compliance, configuration detection accuracy, and cross-platform reliability
- **Build Configuration** (`vitest.config.ts`): High-standard test environment (90% coverage requirement) with TypeScript support and workspace integration

## Public API Surface

### Main Entry Points
- **`JavascriptAdapterFactory`**: Primary factory for creating debug adapter instances with environment validation
- **`JavascriptDebugAdapter`**: Complete DAP-compliant debug adapter with JavaScript/TypeScript debugging capabilities
- **Build Automation**: `scripts/build-js-debug.js` for automated js-debug server acquisition and vendoring

### Configuration Types
- **`JsDebugConfig`**: TypeScript interfaces for debugging configuration with extensible design patterns

### Utility Functions
- **`resolveNodeExecutable()`**: Cross-platform Node.js executable discovery
- **`detectTsRunners()`**: TypeScript runtime detection (tsx, ts-node) with fallback logic
- **`transformConfig()`**: Intelligent configuration transformation based on project characteristics

## Internal Data Flow and Architecture

### Initialization and Setup
1. **Environment Preparation**: Build scripts acquire js-debug server through multi-strategy vendoring system
2. **Factory Validation**: Environment checks validate Node.js version, js-debug availability, and TypeScript tooling
3. **Project Analysis**: Utilities detect project type (ESM/CommonJS), TypeScript configuration, and runtime requirements
4. **Adapter Instantiation**: Factory creates configured adapter instance with proper dependency injection

### Debugging Session Lifecycle
1. **Connection Management**: Adapter launches js-debug in TCP mode and establishes proxy connections
2. **Configuration Intelligence**: Dynamic configuration transformation based on detected project characteristics
3. **DAP Protocol Handling**: Event processing for debugging operations (breakpoints, stepping, variable inspection)
4. **State Management**: Comprehensive lifecycle management with cleanup and error recovery

## Key Patterns and Design Principles

### Intelligent Automation
- **Zero-Configuration Debugging**: Automatic project detection minimizes manual setup requirements
- **Environment-Driven Behavior**: All operations adapt to detected environment characteristics
- **Multi-Strategy Resilience**: Fallback chains ensure reliable operation across diverse deployment scenarios

### Cross-Platform Excellence
- **Platform-Agnostic Design**: Consistent behavior across Windows, macOS, and Linux environments
- **Path Handling**: Robust cross-platform path resolution and executable discovery
- **Runtime Flexibility**: Support for multiple JavaScript/TypeScript execution environments

### Production Readiness
- **Defensive Programming**: Comprehensive error handling with graceful degradation
- **High Test Coverage**: 90% coverage requirement with extensive edge case validation
- **Dependency Management**: Automated acquisition and caching of external dependencies
- **Performance Optimization**: Memoization, lazy evaluation, and efficient resource utilization

The package delivers a turnkey JavaScript/TypeScript debugging solution that abstracts away environmental complexity while providing robust, standards-compliant debugging capabilities through the Debug Adapter Protocol interface.