# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/process_issue_2174.rs
@source-hash: 1acd35cbeb0c168c
@generated: 2026-02-09T18:12:21Z

## Purpose
Regression test for Tokio issue #2174, specifically testing the behavior of process stdin/stdout handling when a child process is killed while writes are in progress. Tests platform-specific kqueue behavior differences on FreeBSD vs other Unix systems.

## Key Components

**Test Function: `issue_2174` (L19-46)**
- Spawns a child `sleep` process with piped stdin and null stdout
- Creates a write loop that continuously writes 8KB chunks to stdin
- Kills the child process while writes are ongoing
- Expects the write task to fail when the pipe is broken

**Platform Constraints (L1, L10)**
- Requires `process` feature flag
- Unix-only, excludes FreeBSD and Miri due to known kqueue behavior differences
- Uses conditional compilation to skip FreeBSD where `EVFILT_WRITE` behavior differs

## Dependencies
- `tokio::process::Command` - Child process management
- `tokio::io::AsyncWriteExt` - Async write operations
- `tokio::time` - Sleep functionality
- `tokio_test::assert_err!` - Error assertion macro

## Test Pattern
1. **Setup (L22-28)**: Spawn child process with piped stdin
2. **Background Task (L32-37)**: Infinite write loop in spawned task
3. **Timing (L40)**: Allow buffer to fill with 1-second sleep
4. **Trigger (L43)**: Kill child process to break pipe
5. **Verification (L45)**: Assert that write task fails

## Critical Behavior
The test validates that broken pipe detection works correctly across different Unix platforms, with FreeBSD being excluded due to documented kqueue `EVFILT_WRITE` filter differences that prevent reliable error detection.