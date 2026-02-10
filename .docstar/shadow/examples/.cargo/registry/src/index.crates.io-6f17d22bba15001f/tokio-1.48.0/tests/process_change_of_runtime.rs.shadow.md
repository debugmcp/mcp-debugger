# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/process_change_of_runtime.rs
@source-hash: ee7b0cb0fc15e416
@generated: 2026-02-09T18:12:20Z

## Purpose
Test file verifying correct behavior of Tokio's async process spawning across different runtime contexts. Validates that process commands work when spawned in one runtime and awaited in another, while ensuring proper error handling when spawned outside any runtime.

## Key Test Functions
- `process_spawned_and_wait_in_different_runtime()` (L12-23): Tests cross-runtime process lifecycle - spawns a child process in one Runtime instance, then waits for completion in a separate Runtime instance. Verifies process handles remain valid across runtime boundaries.
- `process_spawned_outside_runtime()` (L25-34): Negative test ensuring `Command::spawn()` panics with specific error message when called outside any Tokio runtime context.

## Dependencies
- `tokio::process::Command` (L9): Async process spawning wrapper
- `tokio::runtime::Runtime` (L9): Manual runtime creation for test isolation
- `std::process::Stdio` (L8): Standard I/O configuration

## Architecture Patterns
- Uses `Runtime::new().unwrap().block_on()` pattern for synchronous test execution of async code
- Employs Unix `true` command as minimal, reliable test subprocess
- Configures stdio pipes (`stdin(Stdio::piped())`, `stdout(Stdio::null())`) for controlled I/O

## Platform Constraints
- Unix-only tests (L6): Excludes FreeBSD and Miri interpreter
- Requires "process" feature flag (L1)

## Test Strategy
Cross-runtime validation ensures process handles maintain proper reactor associations and can be transferred between runtime contexts, while panic test validates proper error reporting for misuse scenarios.