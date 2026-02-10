# packages/adapter-java/src/
@generated: 2026-02-09T18:16:40Z

## Java Debug Adapter Package

This package implements a complete Java debugging solution for the MCP (Model Context Protocol) debugger system, providing Debug Adapter Protocol (DAP) compliance for Java applications through the Java Debugger (jdb).

## Overall Purpose and Architecture

The package serves as a bridge between DAP-compatible editors (like VS Code) and the Java ecosystem, translating high-level debugging requests into jdb commands and converting jdb's text-based output back into structured DAP responses. It follows a layered architecture with clear separation of concerns:

1. **Adapter Layer** - DAP protocol implementation and session management
2. **Process Layer** - JDB process orchestration and command execution  
3. **Parsing Layer** - Text-to-structured data conversion
4. **Utility Layer** - Java environment discovery and validation

## Key Components and Integration

### Core Adapter Infrastructure
- **`JavaAdapterFactory`** - Factory for dynamic adapter creation with environment validation
- **`JavaDebugAdapter`** - Main adapter implementing the IDebugAdapter interface, managing DAP sessions and delegating to the JDB DAP server
- **`JdbDapServer`** - Standalone Node.js server that implements the actual DAP protocol, handling TCP connections and message routing

### JDB Integration Stack (`utils/`)
- **`JdbWrapper`** - High-level process manager providing async APIs over jdb's synchronous CLI
- **`JdbParser`** - Static parsing utilities converting jdb text output to TypeScript objects
- **`java-utils`** - Cross-platform Java/jdb discovery with multi-tier fallback strategies

## Data Flow and Communication

1. **Initialization**: Factory validates Java environment (JDK 8+) and jdb availability
2. **Session Setup**: Adapter spawns JdbDapServer process, which creates TCP connection to DAP client
3. **Command Processing**: DAP requests flow through server → wrapper → jdb CLI → parser → structured events
4. **Event Pipeline**: JDB output is parsed into events and forwarded back through the DAP protocol

## Public API Surface

### Primary Entry Points
- **`index.ts`** - Main module exports exposing factory, adapter, and configuration types
- **Factory Pattern**: `JavaAdapterFactory.createAdapter()` for dependency injection integration
- **Configuration Interfaces**: `JavaLaunchConfig` and `JavaAttachConfig` for debug session setup

### Core Operations
- **Environment Validation**: Multi-stage validation with detailed diagnostics
- **Debug Session Management**: Launch/attach modes with comprehensive configuration options
- **Breakpoint Management**: Function and exception breakpoints (conditional breakpoints not supported due to jdb limitations)
- **Runtime Inspection**: Stack traces, variable inspection, thread management
- **Execution Control**: Continue, step over/in/out, and program flow control

## Internal Organization Patterns

### Proxy Architecture
The adapter uses a proxy pattern where `JavaDebugAdapter` delegates actual DAP communication to the external `JdbDapServer` process, enabling isolation and specialized protocol handling.

### Command Queue Pattern
JDB's single-threaded nature is managed through a command queue in `JdbWrapper`, providing promise-based async APIs while serializing access to the underlying process.

### Event-Driven Design
Extensive use of EventEmitter pattern decouples components, with events flowing from jdb output → parser → wrapper → server → adapter → session manager.

### Multi-tier Fallback Strategy
Consistent throughout the package for executable discovery: user preference → environment variables → PATH resolution, with comprehensive error reporting and cross-platform support.

## Critical Dependencies and Constraints

- **Java Requirements**: JDK 8+ with jdb (Java Debugger) availability
- **Platform Support**: Cross-platform with Windows-specific handling (.exe extensions, path resolution)
- **Protocol Compliance**: Full DAP implementation through TCP-based server architecture
- **State Management**: Careful state transitions (UNINITIALIZED → READY → CONNECTED → DEBUGGING)

The package provides a robust, production-ready Java debugging solution that abstracts away the complexities of jdb's text-based interface while maintaining full compatibility with the Debug Adapter Protocol ecosystem.