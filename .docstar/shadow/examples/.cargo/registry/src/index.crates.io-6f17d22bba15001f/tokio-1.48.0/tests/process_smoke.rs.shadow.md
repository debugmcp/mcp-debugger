# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/process_smoke.rs
@source-hash: f54f848a2c69d469
@generated: 2026-02-09T18:12:21Z

## Purpose
Integration test file for tokio's process spawning functionality. Tests basic process execution, status handling, and process lifecycle management across Windows and Unix platforms.

## Key Components

### Test Function: `simple()` (L7-34)
- **Purpose**: Validates basic process spawning, waiting, and cleanup behavior
- **Cross-platform logic**: Uses `cmd /c` on Windows, `sh -c` on Unix (L11-17)
- **Process execution**: Spawns a process that exits with code 2 (L19)
- **ID validation**: Verifies process ID is available and positive before exit (L21-22)
- **Wait behavior**: Tests that `.wait()` is fused - can be called multiple times after process completion (L24-29)
- **Lifecycle verification**: Confirms process ID becomes unavailable after exit (L32)
- **Cleanup**: Demonstrates safe cleanup with `drop(child.kill())` (L33)

## Dependencies
- `tokio::process::Command`: Core async process spawning API
- `tokio_test::assert_ok`: Test utility for unwrapping Results in async context

## Platform Constraints
- Disabled on WASI (cannot run system commands)
- Disabled under Miri (memory checker limitations)
- Requires "full" feature flag for complete tokio functionality

## Test Patterns
- Cross-platform command execution strategy
- Process lifecycle state verification
- Fused future behavior validation (multiple waits on completed process)
- Resource cleanup demonstration