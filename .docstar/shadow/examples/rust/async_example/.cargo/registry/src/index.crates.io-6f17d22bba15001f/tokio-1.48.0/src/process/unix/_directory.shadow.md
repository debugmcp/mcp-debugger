# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/process/unix/
@generated: 2026-02-09T18:16:16Z

## Overall Purpose

Unix-specific async child process management for Tokio. This module provides the foundational infrastructure for spawning, monitoring, and reaping child processes on Unix systems, addressing the unique challenges of Unix process lifecycle management where child processes cannot be directly registered with epoll/kqueue and require signal-based or pidfd-based notification mechanisms.

## Key Components and Relationships

### Process Management Strategy (mod.rs)
The module employs a **dual-strategy architecture** for child process monitoring:

1. **Signal-based reaping** (default): Uses SIGCHLD signals with acknowledgment of signal coalescing limitations
2. **Pidfd-based reaping** (Linux-specific): Modern approach using process file descriptors for race-free monitoring

The `Child` enum acts as a strategy dispatcher, with `build_child()` serving as an intelligent factory that attempts pidfd reaping first on Linux systems before falling back to signal-based reaping.

### Core Orchestration (reap.rs)
The `Reaper<W, Q, S>` struct serves as the **central orchestrator**, coordinating:
- Process waiting operations through the `Wait` trait
- SIGCHLD signal stream management 
- Orphan queue integration for cleanup

**Critical race condition prevention**: Registers signal interest BEFORE checking process status to prevent deadlocks where a child exits between status polling and signal registration.

### Advanced Linux Support (pidfd_reaper.rs)
For Linux systems, `PidfdReaper` provides:
- Race-free process monitoring using pidfd file descriptors
- Graceful degradation when pidfd is unavailable
- Integration with Tokio's async I/O via `PollEvented`
- Static capability caching to avoid repeated syscall failures

### Orphan Process Management (orphan.rs)
The `OrphanQueueImpl` provides **centralized zombie prevention**:
- Thread-safe queue for detached processes
- Lazy SIGCHLD signal registration (only when orphans exist)
- Lock-free draining with `try_lock()` to avoid contention
- Reverse iteration for efficient removal during cleanup

## Public API Surface

### Main Entry Points
- **`build_child()`**: Primary factory function for creating async child process wrappers
- **`Child`**: Main async process handle implementing `Future` for exit status waiting
- **`Pipe`** and **`ChildStdio`**: Async I/O wrappers for process stdin/stdout/stderr
- **`stdio()`**: Factory for creating `ChildStdio` from raw file descriptors

### Core Traits
- **`Wait`**: Abstraction for process waiting operations (`id()`, `try_wait()`)
- **`Kill`**: Process termination interface
- **`OrphanQueue`**: Interface for enqueueing orphaned processes

## Internal Organization and Data Flow

1. **Process Creation**: `build_child()` attempts pidfd reaper creation, falls back to signal-based reaper
2. **Async Waiting**: `Reaper` coordinates SIGCHLD signals with `try_wait()` polling
3. **I/O Management**: `Pipe` wrappers provide async traits over raw file descriptors
4. **Cleanup**: Drop implementations ensure processes are either properly reaped or moved to orphan queue
5. **Zombie Prevention**: `OrphanQueueImpl` periodically reaps detached processes on SIGCHLD delivery

## Important Patterns and Conventions

### Architecture Patterns
- **Strategy Pattern**: Child enum switches between signal/pidfd reaping strategies based on system capabilities
- **Singleton Pattern**: GlobalOrphanQueue provides static access to centralized orphan management
- **Factory Pattern**: Intelligent process creation with automatic capability detection and fallback

### Error Handling
- **Graceful Degradation**: Pidfd unavailability is handled as a configuration choice, not a failure
- **Race Resilience**: Signal registration precedes status checking to prevent timing issues
- **Resource Safety**: RAII patterns ensure proper cleanup even when processes are dropped unexpectedly

### Threading Considerations
- **Lock Contention Avoidance**: Uses `try_lock()` patterns to prevent blocking
- **Signal Safety**: Carefully coordinates SIGCHLD handling across multiple child processes
- **Static Caching**: Avoids repeated system capability checks through static state management

The module successfully abstracts the complexity of Unix process management while providing efficient, race-free async process monitoring that integrates seamlessly with Tokio's async runtime.