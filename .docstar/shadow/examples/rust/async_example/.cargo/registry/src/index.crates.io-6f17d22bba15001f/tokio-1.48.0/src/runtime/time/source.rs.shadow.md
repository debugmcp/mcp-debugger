# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/time/source.rs
@source-hash: 02e85457f988c0cf
@generated: 2026-02-09T18:03:13Z

## TimeSource - Instant to Tick Conversion for Timer System

A utility structure that converts Tokio's `Instant` time values to `u64` tick timestamps for the timer wheel implementation. Acts as the temporal foundation for Tokio's runtime timer system.

### Core Structure
- **TimeSource (L6-8)**: Contains a single `start_time` field that establishes the epoch for all time calculations
- **new() (L11-15)**: Constructor that captures current time from provided clock as the reference point

### Key Conversion Methods
- **instant_to_tick() (L22-30)**: Primary conversion from `Instant` to `u64` millisecond ticks
  - Uses saturating duration calculation to prevent underflow
  - Clamps result to `MAX_SAFE_MILLIS_DURATION` for safety
  - Handles overflow by defaulting to maximum safe value
- **deadline_to_tick() (L17-20)**: Specialized converter that adds 999,999ns to round up to next millisecond boundary
- **tick_to_duration() (L32-34)**: Reverse conversion from tick count to `Duration`
- **now() (L36-38)**: Convenience method to get current time as tick value

### Dependencies
- Imports `MAX_SAFE_MILLIS_DURATION` constant from parent module
- Uses Tokio's time types: `Clock`, `Duration`, `Instant`

### Design Patterns
- Immutable reference point design - `start_time` never changes after construction
- Saturating arithmetic to prevent panics on time overflow/underflow
- Millisecond precision with nanosecond rounding for deadline calculations

### Test Support
- **start_time() (L42-44)**: Test-only accessor for the internal start time reference