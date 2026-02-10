# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_uring.rs
@source-hash: 9f86ae83224127de
@generated: 2026-02-09T18:12:17Z

## Purpose
Test suite for Tokio's io_uring filesystem operations on Linux. Validates runtime shutdown behavior, concurrent file operations, and cancellation semantics when using the io_uring backend for async file I/O.

## Architecture & Configuration
- **Platform Requirements (L3-9)**: Linux-only, requires `tokio_unstable`, `io-uring`, `rt`, and `fs` features
- **Test Framework**: Uses standard Rust `#[test]` and `#[tokio::test]` macros

## Key Components

### Runtime Factory Functions
- **`multi_rt(n)` (L23-31)**: Creates multi-threaded runtime with `n` worker threads
- **`current_rt()` (L33-35)**: Creates current-thread runtime
- **`rt_combinations()` (L37-46)**: Provides test matrix of runtime configurations (1, 2, 8, 64, 256 threads)

### Core Tests

#### Shutdown Under Load Test (L48-85)
**`shutdown_runtime_while_performing_io_uring_ops()`**
- Tests runtime shutdown behavior while io_uring operations are in flight
- Spawns infinite loop of file open operations (L59-70)
- Forces shutdown with 300ms timeout from separate thread (L72-76)
- Runs across all runtime configurations

#### Concurrency Stress Test (L87-111) 
**`open_many_files()`**
- Opens 10,000 files across 512 temporary files using round-robin
- Uses `TaskTracker` for coordinated task management (L95-104)
- Tests io_uring scalability under high concurrent load

#### Cancellation Semantics Test (L113-146)
**`cancel_op_future()`** 
- Verifies proper cancellation of io_uring operations
- Polls file open future once, then aborts the task (L130, L142)
- Validates that cancelled operations return `JoinError::is_cancelled()`

### Utility Functions
- **`create_tmp_files(num_files)` (L148-157)**: Creates temporary files and returns `(NamedTempFile, PathBuf)` pairs

## Dependencies
- **tempfile**: Temporary file creation
- **tokio-util::TaskTracker**: Coordinated async task management  
- **futures::FutureExt**: Provides `poll_unpin()` method
- **std::sync::mpsc**: Thread communication channels

## Key Patterns
- **Runtime Polymorphism**: Tests run against multiple runtime configurations via factory functions
- **Resource Management**: Uses RAII with `NamedTempFile` for automatic cleanup
- **Controlled Concurrency**: `TaskTracker` ensures all spawned tasks complete before test ends
- **Cross-thread Testing**: Shutdown test uses separate thread to simulate external shutdown scenarios

## Critical Constraints
- **io_uring Specific**: Tests assume io_uring backend is active (not falling back to thread pool)
- **Linux Only**: Platform-specific functionality limits portability
- **Feature Gates**: Multiple Tokio features must be enabled for compilation