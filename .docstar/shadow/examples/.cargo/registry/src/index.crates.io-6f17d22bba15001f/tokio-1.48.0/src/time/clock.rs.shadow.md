# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/time/clock.rs
@source-hash: 0e87fa8d0efb1f13
@generated: 2026-02-09T18:06:52Z

## Clock - Time Source Abstraction

**Primary Purpose:** Provides a configurable time source abstraction for Tokio's time utilities, supporting both real-time and controllable test time depending on feature flags.

### Architecture & Feature-Based Compilation

The file uses conditional compilation to provide two distinct implementations:

**Production Mode (cfg_not_test_util, L9-28):**
- Simple `Clock` struct (L13) that delegates to `std::time::Instant::now()`
- Global `now()` function (L15-17) wraps std instant in Tokio's `Instant`
- `Clock::new()` (L20-22) ignores pausing parameters
- `Clock::now()` (L24-26) delegates to global `now()`

**Test Mode (cfg_test_util, L30-320):**
- Complex `Clock` struct (L66-68) with mutex-protected internal state
- Static `DID_PAUSE_CLOCK` optimization flag (L77) avoids mutex overhead when clock never paused
- `Inner` state (L80-92) tracks pausing capability, base time, unfrozen timestamp, and auto-advance inhibition

### Key Components

**Clock State Management (L236-258):**
- `Clock::new()` initializes with configurable pausing and optional start-paused state
- Uses mutex-protected inner state for thread-safe time manipulation

**Time Control API (L130-219):**
- `pause()` (L130-137) freezes time at current instant, requires current_thread runtime
- `resume()` (L149-165) unfreezes time, restores normal advancement
- `advance()` (L208-219) jumps time forward by duration, async function that yields control

**Runtime Integration (L38-62):**
- `with_clock()` helper provides safe access to current runtime's clock
- Different implementations for rt/non-rt features
- Handles missing runtime context gracefully

**Time Retrieval (L222-234, L308-318):**
- Global `now()` checks static flag before acquiring mutex
- `Clock::now()` calculates current time from base + elapsed (if unfrozen)
- Falls back to std time when no runtime context available

### Auto-Advance Control (L282-295)
- `inhibit_auto_advance()` / `allow_auto_advance()` use reference counting
- `can_auto_advance()` checks if time is frozen and not inhibited
- Prevents automatic time progression during specific operations

### Dependencies & Integration
- Integrates with Tokio's runtime handle system
- Uses `crate::loom::sync::Mutex` for testing framework compatibility
- Coordinates with timer driver for auto-advance functionality
- Exports time control functions for public testing API

### Critical Constraints
- Pausing requires `current_thread` runtime (single-threaded)
- Time manipulation panics on invalid states or missing runtime context
- Duration overflow protection in advance operations
- Thread-safe through mutex protection in test mode