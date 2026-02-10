# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/config.rs
@source-hash: d82bcf36deccb574
@generated: 2026-02-09T18:06:37Z

## Config Struct (L8-54)

Configuration structure for Tokio runtime behavior, defining scheduling parameters, lifecycle callbacks, and performance tuning options.

**Core Scheduling Parameters:**
- `global_queue_interval` (L10): Optional tick count before checking global/remote task queue
- `event_interval` (L13): Mandatory tick count before yielding to driver for timer/I/O processing
- `disable_lifo_slot` (L42): Boolean flag to disable per-worker LIFO slot optimization

**Worker Lifecycle Callbacks:**
- `before_park` (L16): Optional callback when worker thread parks (blocks waiting for work)
- `after_unpark` (L19): Optional callback when worker thread unparks (resumes execution)

**Task Lifecycle Callbacks:**
- `before_spawn` (L22): Optional callback executed before each task spawn
- `after_termination` (L25): Optional callback executed after each task termination
- `before_poll` (L29): Unstable callback before each task poll operation
- `after_poll` (L33): Unstable callback after each task poll operation

**System Configuration:**
- `seed_generator` (L46): RNG seed generator for deterministic runtime behavior
- `metrics_poll_count_histogram` (L49): Optional histogram builder for poll time metrics
- `unhandled_panic` (L53): Unstable panic handling strategy configuration

**Dependencies:**
- `crate::runtime::{Callback, TaskCallback}` (L5): Callback type definitions
- `crate::util::RngSeedGenerator` (L6): Random number generation utilities
- `crate::runtime::{HistogramBuilder, UnhandledPanic}` (L49, L53): Metrics and panic handling types

**Architectural Notes:**
- Uses conditional compilation for unstable features (`tokio_unstable`)
- LIFO slot optimization noted as future enhancement (L40-41)
- All fields are `pub(crate)` indicating internal runtime use only
- Structure supports both single-threaded and multi-threaded scheduler configurations