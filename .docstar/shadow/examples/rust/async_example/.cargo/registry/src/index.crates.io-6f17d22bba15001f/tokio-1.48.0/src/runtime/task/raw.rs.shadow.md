# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/raw.rs
@source-hash: ad933ef9c71b5579
@generated: 2026-02-09T18:03:18Z

## Primary Purpose
Low-level raw task representation and vtable system for Tokio's async runtime. Provides type-erased task handling with dynamic dispatch for task lifecycle operations while maintaining memory layout control.

## Key Components

### RawTask (L11-13)
Core handle containing a non-null pointer to task header. Implements Copy trait (L321) for efficient passing. Primary interface for task manipulation without type information.

**Key Methods:**
- `new<T, S>()` (L202-223): Creates task from future T and scheduler S, allocates Cell structure
- `poll()` (L253-256): Executes task via vtable dispatch with mutual exclusion requirement
- `schedule()` (L258-261): Schedules task for execution via scheduler
- `dealloc()` (L263-268): Deallocates task memory via vtable
- `try_read_output()` (L272-275): Attempts to read completed task output with type safety constraints
- Queue operations: `get_queue_next()` (L304-309), `set_queue_next()` (L316-318) for injection queue usage

### Vtable (L15-49)
Function pointer table enabling dynamic dispatch over type-erased tasks. Contains unsafe function pointers for all task lifecycle operations plus memory layout offset information.

**Function Pointers:**
- `poll`, `schedule`, `dealloc`: Core lifecycle operations
- `try_read_output`: Output retrieval with waker support
- `drop_join_handle_slow`, `drop_abort_handle`: Handle cleanup
- `shutdown`: Scheduler shutdown handling

**Layout Offsets:**
- `trailer_offset`, `scheduler_offset`, `id_offset`: Memory layout information
- `spawn_location_offset` (conditional): Debug location tracking

### Memory Layout Calculation

#### OffsetHelper<T, S> (L74-109)
Zero-sized type providing compile-time offset calculations via associated constants. Enables vtable promotion to static references.

#### Layout Functions (L111-199)
- `get_trailer_offset()` (L116-136): Calculates Trailer field position using repr(C) algorithm
- `get_core_offset()` (L143-152): Calculates Core<T, S> field position
- `get_id_offset()` (L159-174): Calculates Id field position
- `get_spawn_location_offset()` (L182-199): Debug location field position (tokio_unstable)

All implement manual repr(C) layout calculation with proper alignment handling.

### Vtable Implementation Functions (L323-366)
Type-specialized unsafe functions that vtable pointers reference:
- `poll<T, S>()` (L323-326): Creates Harness and polls
- `schedule<S>()` (L328-335): Extracts scheduler and schedules Notified task
- `dealloc<T, S>()` (L337-340): Creates Harness and deallocates
- `try_read_output<T, S>()` (L342-351): Type-safe output reading with Poll casting
- Handle drop functions (L353-361): Harness-based cleanup
- `shutdown<T, S>()` (L363-366): Harness shutdown

## Dependencies
- `Header`, `Core`, `Trailer` from task core module
- `Cell`, `Harness`, `State`, `Id`, `Schedule` from task module
- `Notified`, `Task` for scheduling
- Standard library: `NonNull`, `Future`, `Poll`, `Waker`

## Critical Invariants
- All vtable functions require proper type parameters T: Future, S: Schedule
- Memory layout must match Cell<T, S> structure exactly
- Queue operations require synchronized access
- poll() requires mutual exclusion
- try_read_output() dst parameter must match Poll<super::Result<T::Output>>

## Architectural Patterns
- Type erasure via function pointers with compile-time type information embedded
- Manual memory layout calculation for cross-type compatibility
- Zero-cost abstractions via compile-time offset computation
- Unsafe interfaces with documented safety requirements