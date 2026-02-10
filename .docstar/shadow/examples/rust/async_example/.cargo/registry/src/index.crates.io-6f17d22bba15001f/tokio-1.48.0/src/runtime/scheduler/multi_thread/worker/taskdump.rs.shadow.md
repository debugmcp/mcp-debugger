# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/worker/taskdump.rs
@source-hash: bb0931a4af0d973c
@generated: 2026-02-09T17:57:18Z

## Task Tracing and Debugging Support for Multi-threaded Runtime

This module provides task dumping and tracing functionality for Tokio's multi-threaded scheduler, enabling runtime introspection and debugging capabilities.

### Primary Components

**Handle::trace_core() (L11-57)**
- Coordinates distributed task tracing across multiple worker threads
- Implements barrier synchronization using `trace_status.trace_start` with 250ms timeout (L19-20)
- Uses leader election pattern: one worker becomes leader and performs actual tracing (L28-32)
- Non-leader workers block on `trace_status.trace_end` barrier (L30)
- Leader worker collects tasks from all queues and generates trace dump (L36-48)

**Shared::steal_all() (L62-78)**
- Aggregates tasks from all remote worker queues into single local queue for tracing
- Iterates through `self.remotes` and steals tasks using `steal_into()` method (L68-75)
- Creates temporary WorkerMetrics and Stats for steal operations (L65-66)

### Key Dependencies
- `super::{Core, Handle, Shared}` - Core scheduler components
- `crate::runtime::task::trace::trace_multi_thread` - Unsafe tracing function requiring synchronized access
- `crate::runtime::dump` - Task dump data structures
- `std::time::Duration` - Timeout management

### Architectural Patterns
- **Barrier Synchronization**: Coordinates tracing across multiple threads using two-phase barriers
- **Leader Election**: Single worker performs tracing to avoid data races
- **Task Aggregation**: Collects distributed tasks into centralized location for analysis
- **Graceful Degradation**: Returns early if shutdown or timeout occurs (L14-16, L23-25)

### Critical Safety Constraints
- `trace_multi_thread()` marked unsafe, requires same `synced` parameter used to create `injection` queue (L41-43)
- Tracing only occurs when not in shutdown state (`core.is_shutdown` check L14)
- Timeout mechanism prevents indefinite blocking on worker coordination