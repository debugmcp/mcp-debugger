# examples/rust/async_example/src/main.rs
@source-hash: 41f1cf23315cb999
@generated: 2026-02-10T00:41:06Z

## Primary Purpose
Demonstration program showcasing async/await patterns and concurrent task management in Rust using Tokio runtime. Designed specifically for debugging async code with examples of different concurrency patterns.

## Key Functions

**main() (L11-40)** - Entry point decorated with `#[tokio::main]` that demonstrates:
- Sequential async operations with `fetch_data().await` 
- Concurrent task spawning using `tokio::spawn()` for 3 parallel tasks
- Task synchronization with `tokio::join!()` macro
- Sequential async loop processing

**fetch_data(id: u32) -> String (L42-47)** - Simple async function that simulates data retrieval with 100ms delay using `tokio::time::sleep()`. Returns formatted string "Data_{id}". Contains explicit breakpoint comment for debugging.

**async_task(task_id: u32) -> u32 (L49-58)** - Concurrent task worker that simulates variable-duration work based on task_id (task_id * 100ms delay). Returns task_id * 10 as result.

**process_item(item: u32) (L60-64)** - Sequential processor with fixed 50ms delay, demonstrates async loops and item-by-item processing.

## Dependencies
- `tokio::time::{sleep, Duration}` for async timing primitives
- Tokio runtime (implied by `#[tokio::main]`)

## Architectural Patterns
- **Mixed Concurrency**: Demonstrates both sequential (`await`) and parallel (`spawn` + `join!`) async patterns
- **Error Handling**: Basic pattern matching on `tokio::join!` results to handle task failures
- **Debugging-Friendly**: Explicit print statements and breakpoint comments for runtime inspection

## Critical Characteristics
- Uses variable delays to create realistic async scheduling scenarios
- Task spawning creates true parallelism (not just concurrency)
- Sequential processing in loop maintains order dependencies
- All async functions are properly awaited, no dangling futures