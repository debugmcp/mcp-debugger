# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/process/mod.rs
@source-hash: 19b6f2ecb42a47f3
@generated: 2026-02-09T18:06:51Z

## Primary Purpose
Provides async process management for Tokio runtime - an async wrapper around `std::process::Command` with future-aware process spawning, waiting, and I/O operations.

## Key Components

### Core Types
- **Command** (L273-277): Main struct wrapping `std::process::Command` with additional `kill_on_drop` flag
- **Child** (L1175-1213): Async handle to spawned process with optional stdin/stdout/stderr streams
- **ChildStdin/ChildStdout/ChildStderr** (L1481-1502): Async I/O streams implementing `AsyncWrite`/`AsyncRead`

### Internal Management
- **SpawnedChild** (L279-284): Internal struct returned by platform-specific `imp::build_child()`
- **ChildDropGuard** (L1105-1129): Drop guard ensuring process kill on drop if configured
- **FusedChild** (L1159-1163): State machine tracking child process (running vs completed)

### Key Methods

#### Command Builder Pattern (L286-1093)
- `new()` (L317): Creates new command for program
- `arg()/args()` (L382, L406): Add arguments  
- `env()/envs()/env_clear()` (L444, L479, L524): Environment management
- `stdin()/stdout()/stderr()` (L579, L606, L633): Configure I/O streams
- `kill_on_drop()` (L664): Configure automatic process termination
- Unix-specific: `uid()/gid()` (L686, L697), `pre_exec()` (L749), `process_group()` (L790)

#### Process Execution (L862-1072)
- `spawn()` (L863): Start process, returns `Child` handle
- `spawn_with()` (L934): Custom spawn function (unstable)  
- `status()` (L1002): Execute and wait for exit status
- `output()` (L1065): Execute and capture stdout/stderr

#### Child Process Management (L1215-1475)
- `wait()` (L1379): Wait for process completion (cancel-safe)
- `try_wait()` (L1413): Non-blocking exit status check
- `kill()/start_kill()` (L1326, L1247): Terminate process
- `wait_with_output()` (L1446): Wait and collect all output

## Platform Abstractions
- **Unix module** (L229-236): Platform-specific implementation via `unix/mod.rs`
- **Windows module** (L238-240): Platform-specific implementation via `windows.rs`
- **Kill trait** (L245): Abstraction for process termination

## Important Patterns

### Resource Management
- Processes continue running after `Child` drop unless `kill_on_drop` is enabled
- Automatic stdin closure in `wait()` to prevent deadlocks (L1382)
- Platform-specific zombie process reaping on Unix

### Async Integration
- All I/O operations are async and integrate with Tokio runtime
- Cooperative task scheduling via `coop::poll_proceed()` (L1140)
- Tracing integration via `trace_leaf()` (L1138)

### Error Handling
- `WouldBlock` errors on Unix when process limits are reached
- I/O errors from pipe setup and process spawning

## Dependencies
- `std::process` types as foundation
- Tokio I/O traits (`AsyncRead`, `AsyncWrite`)
- Platform-specific modules for actual implementation
- Internal `kill` module for termination logic

## Critical Invariants
- Process reaping must occur to avoid zombie processes on Unix
- Stdin handles should be closed before waiting to prevent deadlocks
- `FusedChild` ensures exit status is cached after first completion
- `ChildDropGuard` prevents double-killing of processes