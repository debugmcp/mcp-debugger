# packages/adapter-java/src/utils/jdb-wrapper.ts
@source-hash: d38f43f42646edad
@generated: 2026-02-09T18:14:07Z

## Purpose
High-level wrapper around the Java Debugger (jdb) process, providing asynchronous command execution, event parsing, and debugger state management for the Java adapter.

## Core Classes and Interfaces

### JdbConfig (L24-46)
Configuration interface supporting both launch and attach modes:
- Launch mode: requires `mainClass`, optional `classpath`, `vmArgs`, `programArgs`
- Attach mode: requires `attach.host` and `attach.port`
- Common: `jdbPath` and `sourcePath` required

### JdbBreakpoint (L51-56)
Represents debugger breakpoints with verification status and unique identification.

### JdbWrapper (L78-618)
Main wrapper class extending EventEmitter with comprehensive debugging capabilities:

**Key Properties:**
- `process` (L79): Child process handle for jdb
- `commandQueue` (L81): Queue for serialized command execution
- `breakpoints` (L84): Map of active breakpoints by ID
- `threads` (L85): Cache of thread information
- `ready` (L86): Process initialization state

## Key Methods

### Process Management
- `spawn()` (L95-100): Launch mode initialization with mainClass validation
- `attach()` (L105-111): Attach mode initialization with timeout handling
- `startJdbProcess()` (L116-179): Common process spawning logic with event setup
- `kill()` (L544-557): Graceful process termination with SIGTERM/SIGKILL fallback

### Command Execution
- `executeCommand()` (L317-339): Queued command execution with timeout handling
- `sendCommandDirect()` (L367-379): Direct command sending for non-blocking operations (continue, step commands)
- `processNextCommand()` (L344-361): Queue processing with error handling

### Debugging Operations
- `setBreakpoint()`/`clearBreakpoint()` (L384-434): Breakpoint management with class name resolution
- `continue()`, `stepOver()`, `stepIn()`, `stepOut()` (L485-514): Execution control using direct commands
- `getStackTrace()`, `getLocals()`, `getThreads()` (L439-466): State inspection via JdbParser
- `evaluate()` (L519-524): Expression evaluation with result extraction

### Event Handling
- `onStdout()`/`onStderr()` (L223-258): Output processing and event detection
- `detectEvents()` (L263-289): Parses jdb output for stopped, started, terminated, and error events
- Emits: 'stopped', 'continued', 'output', 'terminated', 'error', 'vmStarted'

## Architecture Patterns

### Command Queue Pattern
Serializes jdb commands to handle single-threaded nature of jdb CLI, with timeout management and promise-based responses.

### Event-Driven Architecture
Uses EventEmitter to decouple jdb output parsing from consumer logic, enabling reactive debugging workflows.

### Mode Differentiation
- Launch mode (L188-215): Builds arguments with sourcepath/classpath
- Attach mode (L188-194): Uses -attach flag, excludes launch-specific arguments

## Key Dependencies
- `JdbParser`: Handles all jdb output parsing and command result extraction
- `child_process.spawn`: Process management
- `events.EventEmitter`: Event emission pattern

## Critical Implementation Details

### File-to-Class Resolution (L575-603)
Attempts package declaration parsing from source files, falls back to basename. Includes debug output emission.

### Timeout Handling
- Process initialization: configurable timeout (10s launch, 30s attach)
- Command execution: 5s default timeout per command
- Process termination: 2s graceful shutdown before force kill

### Direct vs Queued Commands
- Queued: Commands expecting prompt response (breakpoints, inspection)
- Direct: Execution control commands that don't return immediate prompt (continue, step)

## State Management
- `ready` flag prevents command execution before jdb initialization
- Thread cache updated on `getThreads()` calls
- Breakpoint map maintains verification status
- Output buffer accumulates partial responses for event detection