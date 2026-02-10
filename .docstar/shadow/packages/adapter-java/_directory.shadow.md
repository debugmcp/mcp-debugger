# packages/adapter-java/
@generated: 2026-02-09T18:17:05Z

## Overall Purpose and Responsibility

The `packages/adapter-java` module implements a complete Java debugging adapter for the MCP (Model Context Protocol) debugger system. It serves as a bridge between Debug Adapter Protocol (DAP) compatible editors and Java applications, translating high-level debugging requests into Java Debugger (jdb) commands and converting text-based jdb output back into structured DAP responses. This enables seamless Java debugging integration within the broader MCP debugging ecosystem.

## Architecture and Component Integration

The module follows a layered architecture with clear separation of concerns:

### Core Adapter Layer (`src/`)
- **JavaAdapterFactory**: Primary factory providing environment validation and adapter instantiation
- **JavaDebugAdapter**: Main adapter implementing IDebugAdapter interface for DAP session management
- **JdbDapServer**: Standalone Node.js server implementing actual DAP protocol over TCP connections

### Process Integration Layer (`src/utils/`)
- **JdbWrapper**: High-level async process manager abstracting jdb's synchronous CLI
- **JdbParser**: Static parsing utilities converting jdb text output to TypeScript objects
- **java-utils**: Cross-platform Java environment discovery with multi-tier fallback strategies

### Supporting Infrastructure
- **examples/**: Controlled Java test programs (HelloWorld.java) for adapter validation
- **tests/**: Comprehensive test suite covering all layers with realistic mocking
- **vitest.config.ts**: Test framework configuration for Node.js environment testing

## Data Flow and Communication Pattern

1. **Environment Discovery**: Factory validates Java/jdb availability using multi-tier fallback strategy
2. **Session Initialization**: Adapter spawns JdbDapServer process with TCP DAP connection
3. **Command Processing**: DAP requests → JdbDapServer → JdbWrapper → jdb CLI → JdbParser → structured responses
4. **Event Pipeline**: Bidirectional flow through EventEmitter-based architecture for debugging events

## Public API Surface

### Primary Entry Points
- **`JavaAdapterFactory.createAdapter()`**: Main adapter instantiation with dependency injection support
- **`JavaAdapterFactory.isEnvironmentSupported()`**: Comprehensive Java environment validation
- **`JavaAdapterFactory.getMetadata()`**: Adapter capabilities and supported file types

### Debug Session Management
- **Launch/Attach Modes**: Support for both launching new Java processes and attaching to existing ones
- **Configuration Interfaces**: `JavaLaunchConfig` and `JavaAttachConfig` for session setup
- **Breakpoint Management**: Function and exception breakpoints (conditional breakpoints limited by jdb)
- **Runtime Inspection**: Stack traces, variable inspection, thread management, execution control

### Environment Integration
- **Java Version Support**: JDK 8+ compatibility with both legacy (1.x) and modern (9+) version formats
- **Cross-Platform Support**: Windows/Unix compatibility with platform-specific executable discovery
- **Command Discovery**: Configurable executable finding with PATH resolution and validation

## Internal Organization Patterns

### Proxy Architecture
The adapter uses a proxy pattern where `JavaDebugAdapter` delegates DAP communication to the external `JdbDapServer` process, enabling protocol isolation and specialized handling.

### Command Queue Management
JDB's single-threaded nature is managed through promise-based async APIs in `JdbWrapper`, serializing access while providing modern async interfaces.

### Multi-Tier Fallback Strategy
Consistent pattern throughout for executable discovery: user configuration → environment variables → PATH resolution, with detailed error reporting.

### Event-Driven Design
Extensive EventEmitter usage decouples components, enabling clean separation between jdb process management, output parsing, and DAP protocol handling.

## Critical Dependencies and Constraints

- **Runtime Requirements**: JDK 8+ with Java Debugger (jdb) availability
- **Protocol Compliance**: Full Debug Adapter Protocol implementation through TCP-based server architecture  
- **State Management**: Careful state transitions (UNINITIALIZED → READY → CONNECTED → DEBUGGING)
- **Process Orchestration**: Complex child process management for both Java applications and jdb debugging sessions

The module provides a production-ready Java debugging solution that abstracts jdb's text-based interface complexity while maintaining full DAP ecosystem compatibility, enabling seamless Java debugging within MCP-compatible development environments.