# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/scheduler/multi_thread/handle/taskdump.rs
@source-hash: 13249d26250b922a
@generated: 2026-02-09T18:02:13Z

**Purpose**: Implements task dump functionality for the multi-threaded runtime scheduler handle, providing diagnostic capabilities to capture runtime state.

**Key Implementation**:
- `Handle::dump()` (L6-25): Async method that coordinates with trace status to generate runtime dumps
  - Waits for exclusive trace access via `start_trace_request()` (L10)
  - Polls for dump results in retry loop (L12-19)
  - Uses `notify_all()` (L16) to wake workers and trigger dump collection
  - Waits on `result_ready` notification for completion (L17)
  - Releases trace lock via `end_trace_request()` (L22)

**Dependencies**:
- `super::Handle`: Multi-thread scheduler handle type
- `crate::runtime::Dump`: Runtime dump result type
- Relies on `self.shared.trace_status` for coordination state

**Coordination Pattern**: 
- Uses async locking mechanism to serialize dump requests
- Implements producer-consumer pattern where handle requests dumps and workers produce them
- Notification-based synchronization ensures dump completion before returning

**Critical Behavior**:
- Blocking operation that waits for worker threads to collect task state
- Ensures only one dump operation occurs at a time across the runtime
- Must notify all workers to participate in dump collection process