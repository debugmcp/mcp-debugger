# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/time/wheel/mod.rs
@source-hash: f9c19416b4d452cd
@generated: 2026-02-09T17:58:26Z

## Hierarchical Timing Wheel for Timer Management

**Purpose**: Implements a 6-level hierarchical timing wheel data structure for efficient timer scheduling and expiration in Tokio's async runtime. Provides O(1) insertion and amortized O(1) expiration processing for timers up to 2 years in the future with millisecond precision.

### Core Structure
- `Wheel` (L25-43): Main timing wheel with elapsed time tracking, 6-level hierarchy, and pending expiration queue
- `NUM_LEVELS = 6` (L48): Creates 6 levels of 64 slots each for ~2 year range
- `MAX_DURATION` (L51): Maximum timer duration constant derived from level configuration

### Key Methods

**Timer Management**:
- `new()` (L55-61): Creates wheel with zeroed elapsed time and empty levels
- `insert()` (L90-115): Unsafe insertion of `TimerHandle` into appropriate level, returns expiration time or error
- `remove()` (L118-135): Unsafe removal handling both pending and wheel-scheduled timers
- `elapsed()` (L65-67): Returns milliseconds since wheel creation

**Time Advancement & Processing**:
- `poll()` (L143-167): Main driver that advances time and returns expired timers, processes cascade effects
- `poll_at()` (L138-140): Returns next required polling instant
- `process_expiration()` (L219-252): Moves expired entries between levels or to pending queue
- `set_elapsed()` (L254-265): Updates elapsed time with monotonicity assertion

### Level Selection Algorithm
- `level_for()` (L272-273, L277-293): Determines storage level based on time distance using bit manipulation
- Uses XOR and leading zero counting for efficient level calculation
- Handles edge cases for very distant timers via `MAX_DURATION` capping

### Dependencies & Relationships
- Imports `TimerHandle`, `TimerShared` from runtime time module
- Uses `level::Level` for individual wheel level management  
- Integrates with `EntryList` for pending timer queue
- Relies on `STATE_DEREGISTERED` constant from entry module

### Critical Invariants
- All times are monotonic: `elapsed <= when` enforced in multiple locations
- Unsafe operations require caller to ensure timer pinning and proper deregistration
- Entry reprocessing handled carefully to avoid infinite loops during cascading (L221-229)
- Debug assertions validate level expiration ordering (L185, L107-112)

### Architecture Notes
- Uses intrusive linked lists for memory efficiency
- Supports both heap and slab-allocated timer storage via generic design
- Hierarchical design trades constant insertion cost for occasional cascading overhead
- Test module (L295-334) validates level selection algorithm correctness