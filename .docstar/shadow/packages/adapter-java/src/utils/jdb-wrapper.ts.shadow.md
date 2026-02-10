# packages/adapter-java/src/utils/jdb-wrapper.ts
@source-hash: 98ffcd0dc9cb4cde
@generated: 2026-02-10T01:19:05Z

## JdbWrapper - Java Debugger Process Manager

**Primary Purpose:** High-level wrapper for the Java Debugger (jdb) command-line tool, managing the debugging process, command execution, and event handling for Java applications.

### Core Architecture

**JdbWrapper Class (L78-620)** extends EventEmitter to provide async debugging interface:
- **Process Management:** Spawns/attaches to jdb process with stdio pipes (L79, L120-123)
- **Command Queue System:** Serializes jdb commands through queue mechanism (L81-82, L344-361)
- **Event-Driven Design:** Emits debugging events (stopped, continued, terminated, error)

### Key Configuration & Interfaces

**JdbConfig Interface (L24-46):** Comprehensive configuration supporting both launch and attach modes
- Launch mode: `mainClass`, `classpath`, `vmArgs`, `programArgs`
- Attach mode: `attach.host`, `attach.port`, `attach.timeout`

**JdbBreakpoint Interface (L51-56):** Represents debugger breakpoints with verification status

**QueuedCommand Interface (L61-66):** Internal command queuing with timeout handling

### Core Operations

**Process Initialization:**
- `spawn()` (L95-100): Launch mode with main class execution
- `attach()` (L105-111): Attach to running JVM with debug agent
- `startJdbProcess()` (L116-179): Common initialization logic with timeout handling

**Command Execution:**
- `executeCommand()` (L317-339): Queued command execution with timeout
- `sendCommandDirect()` (L367-379): Direct command sending for non-blocking operations
- `processNextCommand()` (L344-361): Command queue processor

**Debugging Operations:**
- `setBreakpoint()`/`clearBreakpoint()` (L384-434): Breakpoint management
- `continue()`, `stepOver()`, `stepIn()`, `stepOut()` (L485-514): Execution control
- `getStackTrace()`, `getLocals()`, `getThreads()` (L439-466): State inspection

### Event Processing & Output Handling

**Output Processing:**
- `onStdout()`/`onStderr()` (L223-258): Buffer management and event detection
- `detectEvents()` (L263-289): Parses jdb output for debugging events using JdbParser
- `handleCommandComplete()` (L294-312): Command completion detection via prompt

**State Management:**
- Breakpoints map (L84): Tracks active breakpoints by ID
- Threads map (L85): Caches thread information
- Ready flag (L86): Process initialization state

### Utility Functions

**Class Name Resolution (L577-605):** 
- Reads Java source files to extract package declarations
- Constructs fully qualified class names for jdb commands
- Provides diagnostic output for debugging

### Dependencies

- **JdbParser (L13-17):** Parsing utilities for jdb output formats
- **Node.js child_process:** Process spawning and management
- **EventEmitter:** Event-driven architecture foundation

### Critical Behavior Notes

- **Attach vs Launch Mode:** Different argument handling (L188-218) - attach mode cannot use sourcepath/classpath
- **Command Timing:** Uses direct sending for execution commands (resume, step) that don't return prompts immediately
- **Process Lifecycle:** Automatic cleanup on process exit with timeout-based forced termination
- **Error Handling:** Comprehensive timeout and error propagation throughout command execution