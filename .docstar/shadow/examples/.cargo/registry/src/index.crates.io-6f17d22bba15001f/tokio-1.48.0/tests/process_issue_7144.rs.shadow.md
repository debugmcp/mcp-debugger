# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/process_issue_7144.rs
@source-hash: 8df554037c33ed5b
@generated: 2026-02-09T18:12:20Z

## Process Signal Handling Regression Test

**Purpose**: Regression test for issue #7144 - validates concurrent process spawning and signal handling doesn't cause race conditions or deadlocks in Tokio's process management.

**Platform Requirements**: Linux-only test (`target_os = "linux"`) requiring `process` feature and `strace` system utility.

### Key Functions

- **`issue_7144()` (L9-18)**: Main test orchestrator that spawns 20 concurrent tasks to stress-test process handling under concurrent load
- **`test_one()` (L20-28)**: Individual test case that:
  - Spawns detached `strace` process monitoring a 5-second sleep
  - Waits 100ms then sends SIGINT signal via `libc::kill`
  - Waits for process termination

### Dependencies
- `tokio::process::Command`: Async process spawning
- `tokio::time`: Async sleep functionality  
- `libc`: Direct system call access for signal delivery

### Test Pattern
Concurrent stress test pattern - multiple tasks performing identical process lifecycle operations simultaneously to expose race conditions in:
- Process spawning (`Command::spawn`)
- Signal delivery (`libc::kill`) 
- Process cleanup (`wait`)

### Critical Implementation Details
- Uses `unsafe` block (L26) for direct signal delivery via libc
- Process ID extraction via `t.id().unwrap()` assumes successful spawn
- 100ms delay ensures process is running before signal delivery
- All operations use `.unwrap()` assuming success in test environment