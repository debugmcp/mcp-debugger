# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_panic.rs
@source-hash: 44eccced52472164
@generated: 2026-02-09T18:12:24Z

**Primary Purpose**
Test suite for panic handling in tokio runtime components, verifying that panics occur at expected source locations for proper error reporting and debugging.

**Key Test Functions**
- `current_handle_panic_caller` (L15-25): Tests panic location tracking when `Handle::current()` is called without an active runtime context
- `into_panic_panic_caller` (L27-47): Tests panic location tracking when calling `into_panic()` on a non-panic `JoinError` 
- `builder_worker_threads_panic_caller` (L49-59): Tests panic location for invalid worker thread count (0) in runtime builder
- `builder_max_blocking_threads_panic_caller` (L61-71): Tests panic location for invalid max blocking threads (0) in runtime builder  
- `builder_global_queue_interval_panic_caller` (L73-83): Tests panic location for invalid global queue interval (0) in runtime builder

**Helper Functions**
- `current_thread` (L85-90): Creates a single-threaded tokio runtime with all features enabled

**Dependencies**
- `futures::future` for async primitives
- `tokio::runtime::{Builder, Handle, Runtime}` for runtime management
- `support::panic::test_panic` (L13) for panic capture and location extraction

**Test Pattern**
All tests follow the same pattern:
1. Use `test_panic()` to capture panic location from a closure that triggers invalid tokio operations
2. Verify the panic occurred in this test file using `file!()` macro
3. Return `Result<(), Box<dyn Error>>` for test framework compatibility

**Platform Constraints**
- Requires "full" tokio feature set (L2)
- Excluded on WASI targets due to lack of panic recovery (L3)
- Requires "unwind" panic strategy (L4)

**Critical Invariants**
Each test validates that tokio's panic messages correctly attribute the panic source location to user code rather than internal tokio implementation, ensuring meaningful stack traces for debugging.