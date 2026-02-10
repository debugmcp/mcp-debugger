# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/tracing_task.rs
@source-hash: dd431377140311b6
@generated: 2026-02-09T18:12:37Z

## Purpose
Test suite for Tokio task instrumentation and tracing integration. Validates that task spawning, lifecycle events, and metadata are properly captured by the tracing system under the `tokio_unstable` feature flag.

## Key Test Functions

### Basic Span Creation Tests
- `task_spawn_creates_span()` (L13-37): Verifies that `tokio::spawn()` creates a "runtime.spawn" span with proper enter/exit lifecycle
- `task_spawn_loc_file_recorded()` (L39-57): Ensures spawn location file path is captured in span fields
- `task_builder_loc_file_recorded()` (L78-98): Same as above but using `task::Builder` API

### Named Task Tests  
- `task_builder_name_recorded()` (L59-76): Tests that custom task names set via `task::Builder::new().name()` are properly recorded in span fields

### Size Tracking Tests
- `task_spawn_sizes_recorded()` (L100-125): Validates that future size is captured in `size.bytes` field for regular futures
- `task_big_spawn_sizes_recorded()` (L127-173): Tests size tracking for large futures that get auto-boxed, verifying both `size.bytes` (boxed size) and `original_size.bytes` (unboxed size) are recorded

## Helper Functions
- `expect_task_named()` (L175-186): Utility to create span expectations for named tasks with proper field matching

## Dependencies
- **tokio**: Task spawning and builder APIs
- **tracing-mock**: Mock subscriber for testing span creation and field recording
- **futures**: Ready future for simple test cases

## Architecture Notes
- All tests use mock tracing subscribers to verify exact span creation sequences
- Tests rely on `tokio_unstable` feature and 64-bit atomics support
- Span lifecycle includes enter/exit on creation and again on drop
- Large future auto-boxing threshold testing uses 20KB futures
- All spawned tasks use `futures::future::ready(())` for simplicity

## Key Invariants
- Task spans always named "runtime.spawn" with target "tokio::task"
- Location file path captured via `file!()` macro
- Size tracking differentiates between original and boxed future sizes
- Named tasks include `task.name` field with debug formatting