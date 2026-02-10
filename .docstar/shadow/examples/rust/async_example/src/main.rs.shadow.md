# examples/rust/async_example/src/main.rs
@source-hash: 41f1cf23315cb999
@generated: 2026-02-09T18:13:51Z

## Purpose
Educational Rust example demonstrating async/await patterns with Tokio runtime for debugging and development learning. Shows concurrent task execution, future handling, and async control flow patterns.

## Key Functions
- **main** (L12-40): Tokio async entry point orchestrating sequential and concurrent async operations
  - Sequential: fetch_data call with await
  - Concurrent: spawns 3 tasks using tokio::spawn, waits with tokio::join!
  - Loop: processes items sequentially in async loop
- **fetch_data** (L42-47): Simple async function simulating data retrieval with 100ms delay
- **async_task** (L49-58): Concurrent task function with variable delay based on task_id (task_id * 100ms), returns task_id * 10
- **process_item** (L60-64): Sequential processing function with 50ms delay per item

## Dependencies
- **tokio**: Async runtime providing spawn, join!, main macro, and time utilities
- **tokio::time**: Duration and sleep for async delays

## Execution Flow
1. Single async call to fetch_data (sequential)
2. Spawn 3 concurrent tasks with different delays (100ms, 200ms, 300ms)
3. Join all concurrent tasks, handle success/failure cases
4. Sequential loop processing 3 items (50ms each)

## Debugging Features
- Print statements at task boundaries for execution tracing
- Strategic delay points for runtime inspection
- Explicit breakpoint comment (L43) for async context debugging
- Result handling patterns for concurrent task outcomes

## Architectural Notes
- Uses tokio::spawn for true concurrency vs sequential awaiting
- Demonstrates both concurrent (tokio::join!) and sequential (for loop) async patterns
- Error handling via pattern matching on join results
- Task isolation through separate spawn contexts