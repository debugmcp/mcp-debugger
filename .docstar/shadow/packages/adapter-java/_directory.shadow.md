# packages/adapter-java/
@generated: 2026-02-10T21:26:58Z

## Overall Purpose

The `packages/adapter-java` directory implements a complete Java Debug Adapter that bridges the Debug Adapter Protocol (DAP) with Java's command-line debugger (jdb). This adapter enables VS Code and other DAP-compliant editors to debug Java applications seamlessly within the MCP (Model Context Protocol) Debugger ecosystem.

## Architecture and Component Integration

The adapter follows a layered architecture with clear separation of concerns:

**Core Implementation Layer (`src/`)**
- **Entry Point**: `index.ts` serves as the public API facade using barrel export pattern
- **Factory Pattern**: `JavaAdapterFactory` handles dependency injection, environment validation, and dynamic instantiation
- **Main Adapter**: `JavaDebugAdapter` manages lifecycle state transitions and configuration transformation
- **Protocol Bridge**: `JdbDapServer` implements full DAP-over-JSON-RPC with JDB process management
- **Utility Infrastructure**: Cross-platform Java discovery, process management, and protocol translation

**Testing and Validation (`tests/`)**
- Comprehensive test suite validating environment detection, adapter creation, and JDB parsing
- Three-layer testing approach: environment validation, factory operations, and protocol handling
- Mock-based isolation ensuring hermetic test execution across platforms

**Reference Implementation (`examples/`)**
- Simple Java programs for testing debug adapter functionality
- Provides standardized test cases for breakpoints, variable inspection, and step operations
- Serves as both documentation and automated test validation

**Build Configuration**
- Vitest configuration for TypeScript testing with Node.js environment
- Coverage reporting with exclusion of build artifacts and dependencies

## Key Entry Points and Public API

### Primary Interface
- **`JavaAdapterFactory`**: Main factory implementing `IAdapterFactory` interface
  - `createAdapter()`: Creates configured debug adapter instances
  - `validateEnvironment()`: Pre-flight Java environment compatibility checking
  - `getMetadata()`: Returns adapter capabilities and version information

### Core Components
- **`JavaDebugAdapter`**: Main adapter extending EventEmitter and implementing `IDebugAdapter`
- **Configuration Types**: `JavaLaunchConfig` and `JavaAttachConfig` for debug session setup
- **JDB Infrastructure**: `JdbWrapper` for process management and `JdbParser` for protocol translation

### Utility Functions
- Java executable discovery with multi-platform support (Java 8+ requirement)
- Version detection handling both legacy (1.x) and modern (9+) format variations
- Cross-platform process management with timeout protection

## Data Flow and Integration

1. **Environment Validation**: Factory validates Java/JDB availability and version compatibility
2. **Adapter Creation**: Factory instantiates adapter with validated environment metadata
3. **Configuration Processing**: Adapter transforms generic DAP configs to Java-specific parameters
4. **Process Management**: DAP server spawns JDB process or attaches to existing JVM
5. **Protocol Translation**: JDB wrapper translates DAP requests to JDB commands and parses responses
6. **Event Propagation**: Structured debugging events flow back to DAP clients through adapter

## Key Design Patterns

**Proxy Architecture**: Uses external Node.js DAP server process for protocol compliance and isolation rather than direct jdb integration

**Event-Driven Design**: Comprehensive async debugging operations through EventEmitter patterns with strict state management

**Multi-Layer Translation**: DAP ↔ Adapter ↔ DAP Server ↔ JDB Wrapper ↔ JDB Process pipeline with protocol-specific handling at each layer

**Defensive Validation**: Extensive environment checking, timeout protection, and error handling throughout the debugging workflow

## Role in MCP Debugger Ecosystem

This adapter provides production-ready Java debugging support by implementing the `@debugmcp/shared` interfaces for seamless integration with the adapter registry system. It abstracts the complexity of jdb's text-based interface behind a modern, event-driven DAP-compliant API, enabling Java developers to debug applications directly within their preferred DAP-supporting development environments.