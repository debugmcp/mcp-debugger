# packages\adapter-go\src/
@children-hash: ff772f2ab3b7bcfd
@generated: 2026-02-24T01:55:06Z

## Overview

The `adapter-go` source directory provides a complete Go debugging solution for the MCP debugger system, implementing Debug Adapter Protocol (DAP) support through Delve (dlv) debugger integration. This module enables debugging Go applications with full breakpoint, variable inspection, and execution control capabilities.

## Architecture & Component Integration

The module follows a layered architecture with clear separation of concerns:

**Factory Pattern Layer**: `GoAdapterFactory` serves as the primary entry point, implementing the `IAdapterFactory` interface for dependency injection and adapter instantiation. It handles environment validation and provides metadata about Go debugging capabilities.

**Adapter Implementation Layer**: `GoDebugAdapter` implements the core `IDebugAdapter` interface, managing the complete debugging lifecycle from environment setup through DAP protocol communication with Delve.

**Utility Layer**: The `utils` directory provides cross-platform toolchain discovery and validation, abstracting away platform-specific differences in locating Go and Delve executables.

**Entry Point**: `index.ts` exposes the public API and implements the dynamic loading pattern required by the MCP debugger system.

## Key Components & Data Flow

1. **Initialization**: Factory validates Go environment (Go 1.18+, Delve with DAP support) and creates adapter instances
2. **Configuration**: Adapter transforms generic debug configurations into Go-specific launch configs with Delve parameters
3. **Connection Management**: Adapter spawns and manages Delve DAP server processes, handling protocol events and state transitions
4. **Debugging Operations**: Full DAP feature support including breakpoints, variable evaluation, stack traces, and goroutine management

## Public API Surface

**Main Entry Points**:
- `GoAdapterFactory` - Primary factory for creating Go debug adapters with environment validation
- `GoDebugAdapter` - Core adapter implementation with DAP protocol support
- `findGoExecutable()` & `findDelveExecutable()` - Cross-platform toolchain discovery utilities
- Default export configuration - Enables dynamic loading by MCP debugger system

**Key Interfaces**:
- `GoLaunchConfig` - Go-specific debugging configuration with Delve options
- Support for debug modes: debug, test, exec, replay, core
- Comprehensive environment validation with detailed error reporting

## Internal Organization

**Caching Strategy**: Implements intelligent caching of executable paths (1-minute TTL) to balance performance with development workflow flexibility.

**Error Handling**: Provides contextual error messages with installation instructions for missing tools, version compatibility issues, and runtime debugging failures.

**State Management**: Tracks adapter lifecycle through well-defined state transitions (UNINITIALIZED → INITIALIZING → READY → CONNECTED → DEBUGGING) with event emission for external monitoring.

**Platform Support**: Handles Windows/macOS/Linux differences transparently through the utilities layer, supporting standard installation locations and cross-platform executable discovery.