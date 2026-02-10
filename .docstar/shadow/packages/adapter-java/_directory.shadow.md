# packages/adapter-java/
@generated: 2026-02-10T01:20:31Z

## Overall Purpose and Responsibility

The `packages/adapter-java` directory implements a complete Java Debug Adapter for the MCP Debugger ecosystem. This module provides Debug Adapter Protocol (DAP) compliant Java debugging capabilities by bridging modern IDE debugging interfaces with Java's command-line `jdb` (Java Debugger) tool. It enables professional-grade debugging experiences for Java applications through breakpoints, step execution, variable inspection, and exception handling.

## Key Components and Integration

### Four-Tier Architecture

**1. Public API Layer (`src/index.ts`)**
- Single entry point using barrel export pattern for clean external integration
- Consolidates all public interfaces for adapter registry consumption
- Enables dependency injection and factory-based adapter instantiation

**2. Adapter Factory and Core (`src/java-adapter-factory.ts`, `src/java-debug-adapter.ts`)**
- Factory pattern for adapter creation with comprehensive environment validation
- Main adapter implementation bridging DAP protocol with JDB via proxy architecture
- Handles configuration transformation between launch/attach modes and JDB commands

**3. Protocol Bridge Server (`src/jdb-dap-server.ts`)**
- Standalone Node.js TCP server implementing full DAP specification
- Manages client connections, message framing, and real-time debugging orchestration
- Translates between structured DAP requests and text-based JDB interactions

**4. Java Integration Layer (`src/utils/`)**
- Cross-platform Java/JDB executable discovery and validation
- Process management via `JdbWrapper` for controlled command execution
- Output parsing via `JdbParser` for structured data extraction from JDB text responses

### Component Data Flow

```
External System → JavaAdapterFactory → JavaDebugAdapter → JDB-DAP Server → JdbWrapper → JDB Process
                                                                    ↓
DAP Client ←→ TCP Server ←→ Command Queue ←→ JdbParser ←→ Raw JDB Output
```

### Testing and Validation Infrastructure (`tests/`)
- **Environment Layer**: Java installation detection and compatibility validation
- **Factory Layer**: Adapter instantiation and configuration testing  
- **Runtime Layer**: Real-time JDB output parsing and debugging workflow validation
- **Example Programs** (`examples/`): Simple Java test applications for integration testing

## Public API Surface

### Primary Entry Points

**Factory Interface:**
- `JavaAdapterFactory.createAdapter()`: Main adapter instantiation with environment validation
- `JavaAdapterFactory.validate()`: Pre-flight checks for Java/JDB availability
- `JavaAdapterFactory.getMetadata()`: Adapter capabilities and version information

**Core Debugging Services:**
- Breakpoint management (line, function, exception breakpoints)
- Execution control (continue, step-over, step-into, step-out)
- State introspection (threads, stack traces, variable inspection)
- Process lifecycle (launch applications, attach to running processes, terminate)

**Configuration Support:**
- **Launch Mode**: Main class execution with classpath and JVM argument management
- **Attach Mode**: Remote debugging via host:port or local PID attachment
- Automatic source path discovery and main class extraction

### Development and Testing Tools

**Vitest Configuration**: Node.js test environment with TypeScript support and comprehensive coverage reporting
**Example Programs**: Minimal Java applications designed for debugging scenario validation
**Mock Infrastructure**: Complete isolation framework for testing without external Java dependencies

## Internal Organization and Data Flow

### State Management Architecture
- Strict state machine transitions ensuring reliable debugging session lifecycle
- Thread-aware debugging with active context tracking
- Event-driven architecture with real-time status reporting

### Cross-Platform Java Integration
- Multi-strategy executable discovery (JAVA_HOME, PATH, explicit configuration)
- Platform-specific command resolution with Windows compatibility
- Version compatibility enforcement (Java 8+ requirement)

### Protocol Translation Layer
- Complete DAP specification implementation hiding JDB complexity
- Asynchronous command queuing with timeout protection
- Real-time event translation from text output to structured DAP events

## Important Patterns and Conventions

### Factory and Dependency Injection
- Clean separation between instantiation/validation (factory) and operation (adapter)
- Environment validation occurs before adapter creation to ensure reliable operation
- Supports dynamic loading by adapter registry systems

### Error Handling and Resilience
- Multi-stage validation from environment detection through runtime operation
- Detailed error context with actionable troubleshooting information
- Graceful degradation and cleanup on failure conditions

### Performance Optimization
- Executable discovery caching to minimize filesystem operations
- Non-blocking command execution for responsive debugging experience
- Efficient output parsing with buffered event detection

## Role in Larger System

This module serves as the Java language implementation within the MCP Debugger's multi-language adapter ecosystem. It transforms the text-based, command-line JDB interface into a standardized, IDE-compatible debugging experience while maintaining cross-platform compatibility and production-level reliability. The adapter integrates seamlessly with modern development environments through its DAP compliance and factory-based instantiation pattern.