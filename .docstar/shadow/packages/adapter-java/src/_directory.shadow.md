# packages/adapter-java/src/
@generated: 2026-02-10T21:26:42Z

## Overall Purpose

The `packages/adapter-java/src` directory implements a complete Java Debug Adapter for the MCP Debugger ecosystem. It bridges the Debug Adapter Protocol (DAP) with Java's command-line debugger (jdb), enabling VS Code and other DAP-compliant clients to debug Java applications seamlessly.

## Architecture & Component Relationships

### Core Components

**Entry Point & API (`index.ts`)**
- Serves as the public API facade using barrel export pattern
- Consolidates all public exports: factory, adapter, types, utilities, and JDB components
- Single entry point for the adapter registry system

**Factory Pattern (`java-adapter-factory.ts`)**  
- Implements `IAdapterFactory` for dependency injection and dynamic instantiation
- Provides comprehensive environment validation (Java 8+, jdb availability)
- Returns detailed validation results with error reporting and environment metadata

**Main Adapter (`java-debug-adapter.ts`)**
- Core implementation extending EventEmitter and implementing `IDebugAdapter`
- Manages adapter lifecycle with strict state machine (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
- Transforms generic launch/attach configs to Java-specific configurations
- Delegates DAP protocol handling to external proxy server

**DAP Server Bridge (`jdb-dap-server.ts`)**
- Node.js TCP server implementing full DAP protocol over JSON-RPC
- Manages JDB process lifecycle and translates DAP requests to JDB commands
- Handles both launch (spawn new JVM) and attach (connect to existing JVM) modes
- Supports comprehensive debugging features: breakpoints, stepping, evaluation, introspection

**Utility Infrastructure (`utils/`)**
- **Java Discovery**: Cross-platform Java/JDB executable location with version validation
- **Process Management**: JDB wrapper with command queuing, event emission, and timeout protection  
- **Protocol Translation**: Parser converting JDB's text output to structured DAP-compliant data

## Data Flow & Integration

1. **Initialization**: Factory validates Java environment and creates adapter instances
2. **Configuration**: Adapter transforms generic configs to Java-specific launch/attach parameters
3. **Process Startup**: DAP server spawns JDB process or attaches to existing JVM
4. **Command Translation**: JDB wrapper serializes DAP requests into JDB commands
5. **Output Processing**: Parser converts JDB text responses to structured DAP events/data
6. **Event Propagation**: Parsed events flow back through adapter to DAP clients

## Public API Surface

### Primary Entry Points
- `JavaAdapterFactory`: Factory for creating and validating Java debug adapters
- `JavaDebugAdapter`: Main adapter implementation with state management
- `JavaLaunchConfig` / `JavaAttachConfig`: TypeScript configuration interfaces

### JDB Infrastructure  
- `JdbWrapper`: Process manager with EventEmitter interface for debugging operations
- `JdbParser`: Static parsing utilities for JDB output transformation
- JDB Types: Complete type system for events, stack frames, variables, threads, and configurations

### Utility Functions
- Java executable discovery with multi-strategy fallback
- Version detection and compatibility checking
- Cross-platform process management utilities

## Key Design Patterns

**Proxy Architecture**: Uses external Node.js DAP server process instead of direct jdb integration for protocol compliance and isolation

**Factory Pattern**: Enables dependency injection and dynamic adapter creation by the registry system

**Event-Driven Design**: Async debugging operations flow through EventEmitter patterns with comprehensive state management

**Multi-Layer Translation**: DAP ↔ Adapter ↔ DAP Server ↔ JDB Wrapper ↔ JDB Process, with each layer handling specific protocol concerns

**Defensive Validation**: Extensive environment checking, timeout protection, and error handling throughout the debugging pipeline

## Integration Points

- Implements `@debugmcp/shared` interfaces for adapter registry compatibility
- Supports standard DAP protocol for VS Code and other debug clients
- Integrates with Java toolchain (JDK 8+) through jdb command-line debugger
- Cross-platform support for Windows, macOS, and Linux development environments

This directory provides a complete, production-ready Java debugging solution that abstracts the complexity of jdb's text-based interface behind a modern, event-driven DAP-compliant API.