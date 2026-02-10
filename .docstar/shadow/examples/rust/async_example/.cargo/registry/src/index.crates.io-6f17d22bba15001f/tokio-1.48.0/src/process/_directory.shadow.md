# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/process/
@generated: 2026-02-09T18:16:34Z

## Overall Purpose

This directory provides Unix-specific async child process management for Tokio, implementing the complex infrastructure needed to spawn, monitor, and reap child processes on Unix systems. It addresses the fundamental challenge that Unix child processes cannot be directly registered with epoll/kqueue and instead require specialized signal-based or file descriptor-based notification mechanisms for async monitoring.

## Key Components and Architecture

The module employs a **dual-strategy architecture** that intelligently selects the best available process monitoring approach:

### Process Management Strategies
- **Signal-based reaping** (universal Unix): Uses SIGCHLD signals with careful handling of signal coalescing limitations
- **Pidfd-based reaping** (modern Linux): Leverages process file descriptors for race-free monitoring when available

### Core Orchestration Components
- **`Reaper<W, Q, S>`**: Central orchestrator coordinating process waiting, SIGCHLD signal streams, and orphan cleanup
- **`Child` enum**: Strategy dispatcher that abstracts the underlying reaping mechanism
- **`PidfdReaper`**: Linux-specific implementation providing race-free process monitoring
- **`OrphanQueueImpl`**: Centralized zombie prevention system for detached processes

## Public API Surface

### Main Entry Points
- **`build_child()`**: Primary factory function that intelligently creates async child process wrappers, attempting pidfd reaping first on Linux before falling back to signal-based reaping
- **`Child`**: Main async process handle implementing `Future` for exit status waiting
- **`Pipe` and `ChildStdio`**: Async I/O wrappers for process stdin/stdout/stderr streams
- **`stdio()`**: Factory for creating `ChildStdio` from raw file descriptors

### Core Abstractions
- **`Wait` trait**: Abstraction for process waiting operations (`id()`, `try_wait()`)
- **`Kill` trait**: Process termination interface
- **`OrphanQueue` trait**: Interface for enqueueing orphaned processes

## Internal Organization and Data Flow

1. **Intelligent Process Creation**: `build_child()` detects system capabilities and selects optimal monitoring strategy
2. **Race-Free Monitoring**: Signal interest is registered BEFORE checking process status to prevent deadlocks
3. **Async Coordination**: `Reaper` coordinates SIGCHLD signals with `try_wait()` polling for efficient async waiting
4. **Resource Management**: Drop implementations ensure processes are either properly reaped or safely transferred to orphan queue
5. **Zombie Prevention**: Centralized orphan queue periodically reaps detached processes on SIGCHLD delivery

## Important Patterns and Conventions

### Design Patterns
- **Strategy Pattern**: Transparent switching between signal/pidfd reaping based on system capabilities
- **Factory Pattern**: Intelligent process creation with automatic capability detection and graceful fallback
- **Singleton Pattern**: GlobalOrphanQueue provides centralized orphan management

### Critical Safety Mechanisms
- **Race Condition Prevention**: Careful signal registration ordering prevents timing-based deadlocks
- **Lock Contention Avoidance**: Uses `try_lock()` patterns to prevent blocking in signal handlers
- **Graceful Degradation**: Pidfd unavailability is handled as configuration choice, not failure
- **Resource Safety**: RAII patterns ensure proper cleanup even when processes are dropped unexpectedly

This module successfully abstracts the inherent complexity of Unix process lifecycle management, providing a clean async interface that integrates seamlessly with Tokio's runtime while handling the low-level details of signal management, race condition prevention, and zombie process cleanup.