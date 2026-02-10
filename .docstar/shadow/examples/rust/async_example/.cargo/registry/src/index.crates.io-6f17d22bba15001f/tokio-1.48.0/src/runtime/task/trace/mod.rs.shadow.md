# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/trace/mod.rs
@source-hash: 4cd4af95d455d99a
@generated: 2026-02-09T17:58:24Z

## Purpose
Task execution tracing infrastructure for Tokio runtime, capturing backtraces during async task execution to enable debugging and profiling capabilities.

## Key Components

### Context (L28-34)
Thread-local tracing context containing:
- `active_frame`: Current execution frame for unwinding bounds
- `collector`: Storage for captured traces

Key methods:
- `new()` (L72-77): Creates empty context
- `try_with_current()` (L81-86): Safe access to thread-local context
- `with_current_frame()` (L88-93): Access to active frame with panic on missing thread-local
- `is_tracing()` (L107-114): Checks if current task is being traced

### Frame (L37-43)
Intrusive doubly-linked list node representing execution frame:
- `inner_addr`: Frame location pointer
- `parent`: Optional parent frame reference

### Trace (L50-54)
Execution trace containing vector of backtraces. Primary interface:
- `capture()` (L121-135): Captures traces during function execution, returns result + trace
- `root()` (L139-141): Creates Root future wrapper
- `backtraces()` (L143-145): Access to captured backtraces

### Root<T> (L60-64)
Pin-projected future wrapper that establishes tracing boundaries. Implements `Future` (L238-266) with frame management during polling.

### Core Functions

#### trace_leaf() (L158-213)
Critical tracing function that:
- Captures backtrace when called within Trace::capture context
- Uses frame filtering between trace_leaf and root boundaries
- Yields task execution (returns Poll::Pending) when tracing occurs
- Handles scheduler wakeup logic for yielded tasks

#### Runtime Tracing Functions
- `trace_current_thread()` (L269-288): Traces single-threaded runtime tasks
- `trace_multi_thread()` (L301-325): Traces multi-threaded runtime tasks (unsafe)
- `trace_owned()` (L334-359): Helper for tracing owned task collections

## Architecture Patterns

### Thread-Local Context Management
Uses Tokio's runtime context system for accessing tracing state, with careful safety around frame linked list integrity.

### Intrusive Linked List
Frame management uses unsafe pointer manipulation to maintain execution stack relationships during async polling.

### Cooperative Tracing
Tasks voluntarily yield execution when traced, ensuring scheduler fairness through deferred wakeups.

## Dependencies
- `backtrace` crate for stack unwinding
- Tokio runtime scheduler components
- Pin projection via `pin_project_lite`

## Safety Constraints
- Frame linked lists must remain valid during context access
- Multi-threaded tracing requires exclusive queue access
- Proper restoration of active frames during Root polling

## Type Aliases
- `Backtrace` = `Vec<BacktraceFrame>` (L24)
- `SymbolTrace` = `Vec<Symbol>` (L25)