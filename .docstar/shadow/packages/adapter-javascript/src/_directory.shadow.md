# packages/adapter-javascript/src/
@generated: 2026-02-09T18:16:42Z

## Overall Purpose & Responsibility

The `src` directory implements the complete JavaScript/TypeScript debugging adapter for the MCP (Model Context Protocol) ecosystem. This module provides intelligent debugging capabilities by bridging VS Code's Debug Adapter Protocol (DAP) with the underlying js-debug engine, handling automatic runtime detection, configuration transformation, and lifecycle management for JavaScript/TypeScript debugging sessions.

## Key Components & Architecture

### Public API Layer (`index.ts`)
Central barrel export providing clean public interface:
- `JavascriptAdapterFactory` - Primary factory for creating adapter instances
- `JavascriptDebugAdapter` - Core debug adapter implementation
- `JsDebugConfig` - TypeScript configuration interface
- Utility functions: `resolveNodeExecutable`, `detectTsRunners`, `transformConfig`

### Factory Pattern (`javascript-adapter-factory.ts`)
Implements adapter creation with comprehensive environment validation:
- Validates Node.js version ≥14 requirement
- Checks for bundled js-debug adapter presence
- Detects TypeScript runtime availability (tsx, ts-node)
- Provides graceful degradation with warnings vs. errors distinction

### Core Adapter (`javascript-debug-adapter.ts`)
Primary implementation handling complete debugging lifecycle:
- **State Management**: Tracks adapter states (UNINITIALIZED → READY → CONNECTED/DISCONNECTED → DISPOSED)
- **Configuration Transform**: Intelligent conversion of generic configs to js-debug specific format
- **Runtime Detection**: Automatic TypeScript runner selection and Node.js executable resolution
- **DAP Protocol**: Full Debug Adapter Protocol handling with event processing
- **Feature Support**: Comprehensive debugging capabilities declaration

### Utility Ecosystem (`utils/`)
Foundation layer providing environment intelligence:
- **Executable Resolution**: Cross-platform Node.js and TypeScript runtime discovery
- **Configuration Analysis**: ESM/CommonJS detection, TypeScript configuration parsing
- **Launch Coordination**: Barrier pattern for js-debug adapter startup synchronization
- **Filesystem Abstraction**: Injectable filesystem layer for testing and reliability

### Type System (`types/`)
Centralized type definitions for configuration contracts and debugging interfaces.

## Component Integration & Data Flow

### Initialization Flow
1. **Factory Validation**: `JavascriptAdapterFactory` validates environment prerequisites
2. **Adapter Creation**: Factory instantiates `JavascriptDebugAdapter` with validated environment
3. **Runtime Discovery**: Utils detect Node.js executable and TypeScript runners
4. **Configuration Transform**: Adapter converts generic debug config to js-debug format

### Debugging Session Flow
1. **Environment Setup**: Adapter resolves executable paths and builds launch command
2. **Launch Coordination**: `JsDebugLaunchBarrier` manages js-debug adapter startup
3. **Protocol Bridging**: Adapter handles DAP request/response/event flow
4. **State Tracking**: Maintains session state and emits lifecycle events

### Cross-Component Dependencies
- **Factory → Adapter**: Creates and validates adapter instances
- **Adapter → Utils**: Leverages utilities for environment detection and configuration
- **Utils → Types**: Uses type definitions for configuration contracts
- **All → FileSystem**: Shared filesystem abstraction for consistent behavior

## Key Entry Points & Public Surface

### Primary Factory
- `JavascriptAdapterFactory`: Main entry point for creating debug adapters
  - `validate()`: Environment validation with detailed error/warning reporting
  - `createAdapter()`: Instantiates configured debug adapter

### Core Debug Interface
- `JavascriptDebugAdapter`: Implements `IDebugAdapter` interface
  - `initialize()`: Adapter setup and validation
  - `transformLaunchConfig()`: Configuration transformation for js-debug compatibility
  - `sendDapRequest()`: DAP protocol request handling
  - `connect()`/`disconnect()`: Session lifecycle management

### Utility Functions
- `resolveNodeExecutable()`: Node.js executable discovery
- `detectTsRunners()`: TypeScript runtime detection with caching
- `transformConfig()`: Configuration transformation utilities

## Architecture Patterns

### Factory Pattern
Clean separation between adapter creation (factory) and operation (adapter) with comprehensive validation.

### State Machine
Explicit state transitions with event emission for lifecycle tracking and debugging.

### Dependency Injection
Filesystem abstraction enables hermetic testing and cross-platform reliability.

### Caching Strategy
Intelligent memoization for expensive operations (executable discovery, TypeScript detection) with explicit cache management.

### Error Resilience
Comprehensive error handling with graceful degradation, user-friendly error messages, and no-throw utility design.

## Critical Design Constraints

- **TCP Mode Requirement**: Adapter must operate in TCP mode for MCP proxy compatibility
- **Synchronous Transform**: Configuration transformation must be synchronous despite async dependencies
- **ESM Compatibility**: Uses explicit `.js` extensions and `import.meta.url` for module resolution
- **Cross-platform Support**: Handles Windows executable suffixes and PATH variations
- **Container Awareness**: Detects MCP_CONTAINER environment for workspace handling

This module serves as the complete JavaScript/TypeScript debugging solution within the MCP ecosystem, providing intelligent environment detection, robust error handling, and seamless integration with VS Code's debugging infrastructure.