# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_panic.rs
@source-hash: 733d26ba7fe392ee
@generated: 2026-02-09T18:12:32Z

## Purpose
Test suite for Tokio task panic handling and error reporting, specifically verifying that panic locations are correctly attributed to user code rather than Tokio's internal implementation.

## Key Dependencies
- **tokio::runtime::Builder** (L7): Runtime construction for testing
- **tokio::task** (L8): Task spawning and local task utilities  
- **support::panic::test_panic** (L13): Custom test helper for capturing panic locations
- **futures::future** (L5): Future utilities for testing

## Test Functions

### Core Task API Panic Tests
- **block_in_place_panic_caller** (L15-28): Tests `block_in_place()` panic attribution when called inside async context without runtime
- **spawn_panic_caller** (L61-71): Tests `tokio::spawn()` panic attribution when called outside runtime context
- **local_set_spawn_local_panic_caller** (L30-42): Tests `spawn_local()` panic attribution when called without LocalSet context
- **local_set_block_on_panic_caller** (L44-59): Tests LocalSet `block_on()` panic attribution in invalid context

### Task-Local Storage Panic Tests
- **local_key_sync_scope_panic_caller** (L73-91): Tests nested `sync_scope()` panic attribution for task-local variables
- **local_key_with_panic_caller** (L93-107): Tests `with()` panic attribution when accessing uninitialized task-local
- **local_key_get_panic_caller** (L109-123): Tests `get()` panic attribution when accessing uninitialized task-local

## Test Pattern
Each test follows identical structure:
1. Calls `test_panic()` with closure that triggers expected panic
2. Asserts panic location file matches current test file using `file!()` macro
3. Returns `Result<(), Box<dyn Error>>` for test framework compatibility

## Configuration Constraints
- **L2**: Requires "full" feature, excludes WASI targets
- **L3**: Requires "unwind" panic strategy for proper panic handling
- **L1**: Enables Rust 2018 idiom warnings

## Architectural Notes
Tests validate that Tokio's error reporting correctly attributes panics to user code locations rather than internal Tokio code paths, ensuring good developer experience during debugging.