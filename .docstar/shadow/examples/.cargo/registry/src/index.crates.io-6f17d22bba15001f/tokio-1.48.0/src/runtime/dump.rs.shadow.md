# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/dump.rs
@source-hash: f8ffbdb4c1f6f395
@generated: 2026-02-09T18:06:47Z

## Purpose
Provides runtime state snapshots and task execution tracing for Tokio async runtime debugging and introspection. This module enables capturing backtraces and execution traces of running tasks.

## Core Data Structures

### Dump (L14-16)
Primary container for runtime snapshots. Contains a `Tasks` collection representing all task states at snapshot time.
- `new(tasks: Vec<Task>)` (L288): Internal constructor
- `tasks()` (L295): Returns reference to contained tasks

### Tasks (L22-24) 
Collection wrapper for task snapshots with iterator access.
- `iter()` (L302): Iterator over individual Task objects

### Task (L30-33)
Individual task snapshot containing ID and execution trace.
- `new(id: Id, trace: Trace)` (L308): Internal constructor  
- `id()` (L326): Returns task ID (tokio_unstable feature only)
- `trace()` (L331): Returns execution trace reference

### Trace (L188-190)
Execution trace of a task's last poll operation. Wraps internal `super::task::trace::Trace`.
- `resolve_backtraces()` (L202): Returns resolved backtrace collection - **CPU expensive operation**
- `capture<F,R>(f: F)` (L266): Static method to capture execution trace during function execution
- `root<F>(f: F)` (L279): Creates root boundary for stack trace capture
- `Display` impl (L336): Formats trace for output

## Backtrace Infrastructure

### BacktraceSymbol (L50-57)
Debug symbol information with optional name, address, file location.
- `from_backtrace_symbol()` (L60): Converts from `backtrace::BacktraceSymbol`
- Accessor methods: `name_raw()`, `name_demangled()`, `addr()`, `filename()`, `lineno()`, `colno()` (L73-105)

### BacktraceFrame (L112-116) 
Single stack frame containing instruction pointer, symbol address, and associated symbols.
- `from_resolved_backtrace_frame()` (L119): Converts from `backtrace::BacktraceFrame`
- `ip()`, `symbol_address()` (L134, L139): Memory address accessors
- `symbols()` (L148): Iterator over frame symbols

### Backtrace (L157-159)
Complete backtrace containing ordered frames from innermost to outermost.
- `frames()` (L164): Iterator over backtrace frames

### Address (L39-40)
Thread-safe wrapper for raw void pointers with manual `Send + Sync` implementation (L43-44). Used to safely store memory addresses without dereferencing.

## Dependencies
- `crate::task::Id`: Task identifier type
- `crate::runtime::task::trace`: Internal tracing implementation  
- `backtrace` crate: External backtrace capture library
- `std::path::Path`: File path handling

## Architecture Notes
- Uses type erasure pattern - public API wraps internal trace types
- Backtrace resolution is explicitly expensive and should be done in `spawn_blocking`
- Support for nested trace capture with root boundaries
- Feature-gated task ID access requires `tokio_unstable`