# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_builder.rs
@source-hash: 4b72b7cf286c0330
@generated: 2026-02-09T18:12:29Z

## Primary Purpose
Test suite for Tokio's `task::Builder` functionality, specifically validating task spawning with and without names across different execution contexts. Only compiled when `tokio_unstable` and `tracing` features are enabled.

## Key Dependencies
- `std::rc::Rc` (L3): Used for testing non-Send data in local tasks
- `tokio::task::{Builder, LocalSet}` (L4-5): Core components under test
- `tokio::test` (L6): Async test framework

## Test Functions

### Named Task Tests
- `spawn_with_name` (L9-18): Tests basic async task spawning with name using `Builder::new().name("name").spawn()`
- `spawn_blocking_with_name` (L20-29): Tests blocking task spawning with name using `spawn_blocking()`  
- `spawn_local_with_name` (L31-45): Tests local task spawning with name using `LocalSet` and non-Send `Rc` data

### Unnamed Task Tests
- `spawn_without_name` (L47-55): Tests basic async task spawning without name
- `spawn_blocking_without_name` (L57-65): Tests blocking task spawning without name
- `spawn_local_without_name` (L67-80): Tests local task spawning without name using `LocalSet`

## Test Patterns
All tests follow the pattern:
1. Create `Builder::new()` (optionally with `.name()`)
2. Spawn task with appropriate method (`spawn`, `spawn_blocking`, `spawn_local`)
3. Await result and assert success with `"task executed"` value

## Architectural Notes
- Feature gating ensures tests only run in unstable builds with tracing enabled (L1)
- Local task tests use `Rc<&str>` to validate non-Send type handling
- All spawned tasks return simple string literals for validation
- Tests verify both the spawning mechanism and result retrieval work correctly