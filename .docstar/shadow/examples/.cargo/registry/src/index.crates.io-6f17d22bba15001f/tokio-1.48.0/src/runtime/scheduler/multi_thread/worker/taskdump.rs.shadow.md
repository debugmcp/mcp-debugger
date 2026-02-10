# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/worker/taskdump.rs
@source-hash: bb0931a4af0d973c
@generated: 2026-02-09T18:02:17Z

## Purpose
Task dumping and tracing utilities for the multi-threaded Tokio runtime scheduler. Enables diagnostic collection of task state across worker threads for debugging and monitoring purposes.

## Key Components

### Handle::trace_core (L10-58)
Primary task tracing coordination method. Implements leader-election pattern for distributed task collection:
- **Input**: Takes ownership of worker's Core state
- **Coordination**: Uses barrier synchronization with 250ms timeout (L19) to elect leader worker
- **Leader responsibilities**: Collects tasks from all queues, generates trace dump, stores result
- **Follower behavior**: Waits for leader completion, returns core unchanged
- **Safety**: Uses unsafe `trace_multi_thread` call with queue synchronization guarantees (L41-43)

### Shared::steal_all (L60-78) 
Task aggregation utility for trace collection:
- **Purpose**: Centralizes all tasks from remote worker queues into single local queue
- **Mechanism**: Iterates through all remote steal queues, draining them into consolidated queue
- **Metrics**: Creates temporary WorkerMetrics and Stats for steal operations (L65-66)
- **Return**: Returns populated local queue containing all stolen tasks

## Key Dependencies
- `trace_multi_thread`: Unsafe core tracing function from task::trace module
- `dump::Dump` and `dump::Task`: Result serialization types
- `super::queue::Local`: Task queue implementation with steal capabilities
- `WorkerMetrics` and `Stats`: Performance tracking during task operations

## Architectural Patterns
- **Leader election**: Prevents duplicate work across worker threads
- **Barrier synchronization**: Ensures atomic tracing across distributed workers  
- **Timeout handling**: Graceful degradation when coordination fails
- **Task stealing**: Lock-free work redistribution for trace collection

## Critical Invariants
- Only leader worker performs actual tracing to avoid race conditions
- Trace collection requires all workers to participate or timeout
- Unsafe tracing operation requires matching synced/injection queue pairing
- Core state must be returned to caller regardless of trace success/failure