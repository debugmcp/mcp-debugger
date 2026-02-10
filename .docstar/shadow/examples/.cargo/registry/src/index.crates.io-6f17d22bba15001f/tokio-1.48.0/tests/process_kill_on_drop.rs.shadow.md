# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/process_kill_on_drop.rs
@source-hash: 8ee6f60cb885191c
@generated: 2026-02-09T18:12:22Z

This test file validates Tokio's `kill_on_drop` functionality for child processes on Unix systems.

## Purpose
Tests that when a Tokio `Command` child process is dropped with `kill_on_drop(true)`, the main process is terminated but detached child processes continue running independently.

## Key Components

### Test Function: `kill_on_drop()` (L12-44)
- **Setup**: Creates bash command that forks a detached child (`sh -c 'sleep 1; echo child ran' &`) and disowns it (L15-26)
- **Main Process**: Parent bash sleeps for 5 seconds, which should be interrupted by kill_on_drop (L23-24)
- **Process Management**: Spawns with `kill_on_drop(true)` and piped stdout (L28)
- **Graceful Degradation**: Skips test if bash is not available (L29-32)
- **Kill Timing**: Waits 2 seconds then drops the child process, triggering termination (L35-38)
- **Validation**: Reads stdout and verifies only the detached child's output appears ("child ran\n"), confirming the main process was killed (L40-43)

## Dependencies
- `tokio::process::Command` - Async process spawning with kill_on_drop support
- `tokio::io::AsyncReadExt` - Async reading from stdout
- `tokio::time::sleep` - Async delays for timing coordination
- `tokio_test::assert_ok!` - Test assertion macro

## Architecture Notes
- Unix-only test (`#![cfg(all(unix, feature = "process", not(miri)))]` L1)
- Uses bash shell scripting for complex process forking scenarios
- Demonstrates process lifecycle management in async contexts
- Tests that `disown` properly detaches children from process group cleanup

## Critical Behavior
The test verifies that `kill_on_drop(true)` only affects the immediate child process, not processes that have been properly detached via shell `disown` command.