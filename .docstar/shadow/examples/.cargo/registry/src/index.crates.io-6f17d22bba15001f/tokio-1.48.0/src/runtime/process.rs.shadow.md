# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/process.rs
@source-hash: b6bd15937ae2ab45
@generated: 2026-02-09T18:06:36Z

**Purpose**: Process driver responsible for cleaning up orphaned child processes on Unix platforms within Tokio's async runtime.

**Core Components**:
- `Driver` struct (L13-16): Wrapper around signal driver that adds orphan cleanup functionality
  - `park: SignalDriver`: Underlying signal driver for parking/wakeup operations
  - `signal_handle: SignalHandle`: Handle for signal operations used in orphan cleanup

**Key Functions**:
- `new()` (L22-29): Constructor that creates driver instance from SignalDriver, extracting signal handle
- `park()` (L31-34): Parks current thread and triggers orphan cleanup via `GlobalOrphanQueue::reap_orphans()`
- `park_timeout()` (L36-39): Parks with timeout and triggers orphan cleanup
- `shutdown()` (L41-43): Delegates shutdown to underlying signal driver

**Dependencies**:
- `crate::process::unix::GlobalOrphanQueue`: Unix-specific orphan process cleanup (L5)
- `crate::runtime::signal::{Driver, Handle}`: Signal handling infrastructure (L7)
- `crate::runtime::driver`: Runtime driver abstractions (L6)

**Architecture Pattern**: 
Decorator pattern - wraps SignalDriver to add process cleanup behavior. The driver ensures orphaned child processes are reaped after each park operation, preventing zombie processes.

**Critical Behavior**: 
Every park operation (blocking or timeout) triggers orphan cleanup, ensuring timely process resource cleanup. Conditional compilation allows dead code when "rt" feature is disabled (L1).