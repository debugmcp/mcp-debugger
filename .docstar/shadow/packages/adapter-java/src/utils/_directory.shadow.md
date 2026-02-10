# packages/adapter-java/src/utils/
@generated: 2026-02-09T18:16:16Z

## Purpose
Java debugging utilities module providing comprehensive Java runtime discovery, debugger management, and output parsing for the Java adapter package. This module bridges the gap between the Debug Adapter Protocol (DAP) and the Java Debugger (jdb) command-line tool, enabling structured debugging workflows.

## Key Components and Relationships

### Java Environment Detection (`java-utils.ts`)
Core infrastructure for discovering and validating Java tools across platforms:
- **Java Runtime Discovery**: Multi-tier fallback strategy (user preference → JAVA_HOME → PATH) for finding Java executables
- **Version Management**: Extracts and parses Java version information from both legacy (1.8.x) and modern (9+) formats
- **Debugger Tool Location**: Parallel discovery system for Java Debugger (jdb) executable
- **Cross-platform Support**: Windows .exe handling and consistent PATH resolution

### JDB Output Parsing (`jdb-parser.ts`)
Static parsing utilities that convert unstructured jdb text output into structured data:
- **Event Detection**: Parses debugger events (breakpoints, steps, termination) from text streams
- **Stack Trace Parsing**: Extracts structured stack frames with method and location information  
- **Variable Inspection**: Converts local variable dumps into typed variable representations
- **Thread Management**: Parses thread listings and maps names to consistent numeric IDs

### JDB Process Wrapper (`jdb-wrapper.ts`)
High-level orchestration layer managing the jdb process lifecycle and command execution:
- **Process Management**: Handles jdb spawning in both launch and attach modes
- **Command Queue**: Serializes jdb commands to handle single-threaded CLI nature
- **Event Bridge**: Converts parsed jdb output into EventEmitter events for DAP consumption
- **State Tracking**: Maintains debugger state (breakpoints, threads, execution status)

## Data Flow Architecture

1. **Initialization**: `java-utils.ts` discovers Java/jdb executables using environment detection
2. **Process Launch**: `jdb-wrapper.ts` spawns jdb process with discovered executables and user configuration
3. **Command Execution**: Wrapper queues and executes jdb commands, collecting text responses
4. **Output Processing**: `jdb-parser.ts` converts text responses into structured TypeScript objects
5. **Event Emission**: Wrapper emits structured events consumed by the broader Java adapter

## Public API Surface

### Primary Entry Points
- **`findJavaExecutable(preferredPath?)`**: Main Java discovery function with fallback strategies
- **`findJdb(preferredPath?)`**: Java Debugger discovery with same fallback pattern
- **`getJavaVersion(javaPath)`**: Version extraction from Java executable
- **`JdbWrapper.spawn(config)`**: Launch mode debugger initialization
- **`JdbWrapper.attach(config)`**: Attach mode debugger initialization

### Configuration Interfaces
- **`JdbConfig`**: Comprehensive configuration for both launch/attach debugging modes
- **`JdbBreakpoint`**: Breakpoint representation with verification tracking
- **`JdbStoppedEvent`**: Structured debugger stop event information

### Debugging Operations
- **Command Execution**: `executeCommand()` for synchronous operations, `sendCommandDirect()` for execution control
- **Breakpoint Management**: `setBreakpoint()`, `clearBreakpoint()` with class resolution
- **State Inspection**: `getStackTrace()`, `getLocals()`, `getThreads()` for runtime introspection
- **Execution Control**: `continue()`, `stepOver()`, `stepIn()`, `stepOut()` for program flow

## Internal Organization

### Command Queue Pattern
The wrapper serializes all jdb interactions through a command queue, handling the single-threaded nature of the jdb CLI while providing promise-based async APIs to consumers.

### Event-Driven Communication
Uses EventEmitter pattern to decouple jdb output processing from consumer logic, emitting events like 'stopped', 'continued', 'output', 'terminated', and 'error'.

### Caching and State Management
- **Executable Discovery**: WhichCommandFinder caches resolved paths to avoid repeated filesystem operations
- **Thread Information**: Cached thread data reduces redundant jdb queries
- **Breakpoint Tracking**: Maintains verification status and unique identification across debugging sessions

## Critical Design Patterns

### Multi-tier Fallback Strategy
Consistent across Java and jdb discovery - user preference, environment variables, then PATH resolution with comprehensive error reporting including "tried paths" for debugging.

### Cross-platform Compatibility
Windows-specific handling throughout, including .exe extension variants and proper path resolution.

### Timeout Management
Consistent 5-second timeouts for process operations with graceful degradation and proper cleanup to prevent hanging operations.

### Type Inference and Parsing
Robust regex-based parsing with fallback patterns handles jdb's varied output formats, including type inference for Java primitives and objects.

This module serves as the foundational layer enabling Java debugging capabilities, abstracting away platform differences and jdb's text-based interface to provide a clean, structured API for the broader Java adapter system.