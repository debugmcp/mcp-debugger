# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_driver.rs
@source-hash: 4ede377e0b218876
@generated: 2026-02-09T18:12:18Z

## Purpose
Test file for Tokio's IO driver behavior, specifically testing edge cases around task dropping during reactor notifications and runtime configuration validation.

## Key Components

### Task<T> Struct (L16-32)
- Custom task wrapper implementing `ArcWake` for testing purposes
- Contains a `Mutex<Pin<Box<T>>>` future (L17)
- `wake_by_ref` implementation is intentionally no-op (L21-23) to simulate executor shutdown scenarios
- `new()` constructor boxes and pins the provided future (L27-31)

### test_drop_on_notify() (L34-88)
Primary test for a previously existing deadlock scenario in the reactor:
- Creates single-threaded runtime with all features enabled (L50-53)
- Sets up TCP listener task that continuously accepts connections (L58-69)
- Uses custom Task wrapper with no-op waker to simulate shutting-down executor
- Manually polls task once to start listener, then drops task handle (L71-81)
- Connects external TCP client to trigger reactor notification (L84)
- Forces reactor turn to complete the test scenario (L87)

**Critical Behavior**: Tests that dropping a task during reactor notification doesn't cause deadlock

### panics_when_io_disabled() (L90-105)
Validation test ensuring proper error handling:
- Creates runtime without IO enabled
- Attempts to use `tokio::net::TcpListener::from_std()` 
- Expects specific panic message about missing `enable_io` call
- Uses `#[should_panic]` attribute to verify error condition

## Dependencies
- `tokio::net::TcpListener` - Async TCP listener
- `tokio::runtime` - Runtime builder and management
- `tokio_test` - Test utilities (`assert_ok`, `assert_pending`)
- `futures::task` - Custom waker implementation support
- Standard library networking and concurrency primitives

## Configuration
- Conditional compilation: requires "full" feature, excludes WASI target (L3)
- Miri-ignored tests due to socket limitations (L35, L94)

## Test Architecture Pattern
Uses custom executor simulation via no-op `ArcWake` implementation to test reactor edge cases that would be difficult to reproduce with normal executor behavior.