# packages\adapter-javascript\src/
@children-hash: 2db5686613b08252
@generated: 2026-02-21T08:28:47Z

## Overall Purpose and Responsibility

This directory contains the core implementation of the `@debugmcp/adapter-javascript` package, which provides JavaScript and TypeScript debugging capabilities through the debugmcp framework. It serves as a specialized adapter that integrates Microsoft's js-debug adapter with the Debug Adapter Protocol (DAP), offering intelligent project configuration detection, runtime resolution, and debugging session management for JavaScript/TypeScript applications.

## Key Components and Architecture

### Core Adapter Implementation
- **JavascriptDebugAdapter**: The main adapter class managing debug session lifecycle, DAP protocol handling, and state management. Wraps Microsoft's js-debug adapter and provides JavaScript/TypeScript-specific debugging features including TypeScript compilation, runtime detection, and configuration transformation.

- **JavascriptAdapterFactory**: Factory implementation that validates environment prerequisites (Node.js version ≥14, js-debug availability, TypeScript runners) and creates adapter instances with proper dependency injection.

### Intelligent Configuration System
- **Utils Package**: Sophisticated utility layer providing:
  - Cross-platform executable resolution for Node.js and TypeScript runtimes
  - Automatic project type detection (ESM vs CommonJS, TypeScript configuration)
  - Configuration transformation with source map and output file handling
  - Launch coordination through barrier patterns

- **Type Definitions**: TypeScript interfaces and types for debugging configuration, currently using flexible placeholder patterns designed for future expansion.

## Public API Surface

### Main Entry Points
- **JavascriptAdapterFactory**: Primary factory for creating debug adapter instances
- **JavascriptDebugAdapter**: Complete debug adapter implementation with DAP protocol support
- **JsDebugConfig**: TypeScript type for debugging configuration objects

### Utility Functions
- **resolveNodeExecutable**: Cross-platform Node.js executable path resolution
- **detectTsRunners**: TypeScript runtime detection (tsx, ts-node) with intelligent fallback
- **transformConfig**: Configuration analysis and transformation for project-specific debugging

## Internal Organization and Data Flow

### Initialization Flow
1. **Factory Validation**: Environment checks for Node.js version, js-debug availability, and TypeScript tooling
2. **Adapter Creation**: Factory instantiates JavascriptDebugAdapter with validated dependencies
3. **Configuration Detection**: Utils analyze project structure, package.json, tsconfig.json for optimal debugging setup
4. **Runtime Resolution**: Intelligent selection of appropriate JavaScript/TypeScript execution environment

### Debugging Session Management
1. **Connection Establishment**: Adapter launches js-debug in TCP mode and manages proxy connections
2. **Configuration Transformation**: Dynamic adaptation of launch configs based on project characteristics
3. **DAP Protocol Handling**: Event processing for debugging states (breakpoints, stepping, variable inspection)
4. **State Management**: Comprehensive lifecycle management with proper cleanup and error handling

## Architecture Patterns and Conventions

### Design Principles
- **Defensive Programming**: All filesystem operations use safe error handling with graceful fallbacks
- **Cross-Platform Compatibility**: Platform-aware executable resolution and path handling throughout
- **Intelligent Defaults**: Automatic configuration detection minimizes manual setup requirements
- **Extensible Architecture**: Factory pattern and utility abstractions support future language features

### Key Features
- **TypeScript Support**: Automatic detection of TypeScript projects with appropriate runtime selection
- **ESM/CommonJS Compatibility**: Smart project type detection with proper configuration adaptation
- **Source Map Integration**: Automatic source map configuration for debugging compiled code
- **Multi-Runtime Support**: Seamless switching between Node.js, tsx, and ts-node execution environments

### Performance Optimizations
- **Caching Strategy**: Memoization of expensive operations (executable resolution, TypeScript detection)
- **Synchronous Operations**: Optimized for interface constraints while maintaining comprehensive feature detection
- **Lazy Evaluation**: On-demand configuration analysis to minimize startup overhead

This module represents a complete JavaScript/TypeScript debugging solution that abstracts away the complexity of environment configuration while providing robust debugging capabilities through the standardized Debug Adapter Protocol interface.