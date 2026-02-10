# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/blocking/schedule.rs
@source-hash: a3402f8acb6faebd
@generated: 2026-02-09T18:03:08Z

## Purpose
Implements a no-op scheduler for Tokio's blocking thread pool. This scheduler handles "tasks" that are actually blocking operations rather than async futures, requiring special handling compared to regular async task scheduling.

## Key Components

### BlockingSchedule struct (L12-16)
- Primary scheduler implementation for blocking operations
- Contains optional `Handle` for test utilities (L14) and `TaskHarnessScheduleHooks` for task lifecycle callbacks (L15)
- Uses conditional compilation extensively with `test-util` feature flag

### Constructor: new() (L20-38)
- Creates new BlockingSchedule instance from runtime Handle
- **Test-util specific behavior**: Inhibits clock auto-advance for CurrentThread scheduler (L25) to prevent time from advancing during blocking operations
- Extracts and clones task termination callback hooks from runtime handle (L35)

### task::Schedule Implementation (L41-66)

#### release() method (L42-55)
- Called when blocking task completes
- **Test-util behavior**: Re-enables clock auto-advance (L47) and unparks the driver (L48) for CurrentThread scheduler
- Always returns `None` - tasks are not rescheduled (L54)

#### schedule() method (L57-59)
- **Critical**: Always panics with `unreachable!()` (L58)
- Design assumption: blocking tasks should never be scheduled through normal async mechanisms

#### hooks() method (L61-65)
- Returns task harness hooks for lifecycle management
- Clones termination callback for proper cleanup handling

## Architecture Notes

**Memory Management Strategy**: Tasks are "forgotten" in `bind` (not shown) and re-materialized in `release` to avoid storing task references during blocking operations.

**Conditional Compilation**: Extensive use of `#[cfg(feature = "test-util")]` throughout for test-specific clock management behavior.

**Scheduler Integration**: Different handling for CurrentThread vs MultiThread schedulers, with clock manipulation only relevant for single-threaded runtime.

## Dependencies
- `crate::runtime::task`: Task types and scheduling traits
- `crate::runtime::Handle`: Runtime handle for accessing scheduler internals
- `crate::runtime::scheduler`: Scheduler implementations (test-util only)