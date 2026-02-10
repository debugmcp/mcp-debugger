# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/process_issue_42.rs
@source-hash: 1620a38736e7a92e
@generated: 2026-02-09T18:12:20Z

**Primary Purpose:**
Regression test for issue #42 in the tokio-process crate, specifically testing concurrent process spawning and waiting to ensure no race conditions or starvation occur in the process readiness event handling.

**Test Function:**
- `issue_42()` (L12-39): Async test that stress-tests concurrent process spawning and waiting

**Key Architecture & Test Strategy:**
- Two-level parallelism: 10 outer tasks, each spawning 10 processes (100 total processes per test run)
- Uses `echo` command with formatted output to create identifiable processes (L22-23)
- All stdio streams nulled out (L24-26) to avoid I/O overhead
- `kill_on_drop(true)` (L27) ensures cleanup if test fails
- `join_all()` used at both levels (L34, L38) to ensure all processes complete

**Dependencies:**
- `futures::future::join_all` for coordinating multiple async operations
- `tokio::process::Command` for spawning child processes
- `tokio::task` for async task spawning
- `std::process::Stdio` for stdio configuration

**Platform Constraints:**
- Unix-only test (`#![cfg(unix)]` L3)
- Requires "full" feature (`#![cfg(feature = "full")]` L2)
- Disabled under Miri (`#![cfg(not(miri))]` L4)

**Critical Test Logic:**
The test specifically targets a race condition where consuming a readiness event for one process could starve another process's event handling. The high concurrency (100 processes across 10 tasks) is designed to trigger this condition if it exists.