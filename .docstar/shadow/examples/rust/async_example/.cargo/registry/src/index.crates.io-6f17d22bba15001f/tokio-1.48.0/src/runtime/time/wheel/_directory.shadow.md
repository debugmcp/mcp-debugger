# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/time/wheel/
@generated: 2026-02-09T18:16:10Z

## Hierarchical Timing Wheel Implementation

**Purpose**: This module implements Tokio's core timer scheduling engine using a hierarchical timing wheel data structure. It provides efficient O(1) timer insertion and amortized O(1) expiration processing for timers ranging from milliseconds to approximately 2 years in the future.

## Architecture Overview

The timing wheel uses a 6-level hierarchy where each level contains 64 slots, creating a tree-like structure that can efficiently handle timers across different time scales:

- **Level 0**: Handles timers 0-63ms in the future (1ms per slot)
- **Level 1**: Handles timers 64ms-4s in the future (64ms per slot)
- **Level 2**: Handles timers 4s-4.2min in the future (~4s per slot)
- **Level 3**: Handles timers 4.2min-4.5hr in the future (~4min per slot)
- **Level 4**: Handles timers 4.5hr-12 days in the future (~4hr per slot)
- **Level 5**: Handles timers 12 days-2+ years in the future (~12 days per slot)

## Key Components

### Wheel (mod.rs)
The main coordinator that:
- Manages the 6-level hierarchy and elapsed time tracking
- Provides timer insertion/removal API with level selection logic
- Drives time advancement through `poll()` method
- Handles cascading of timers between levels as time advances
- Maintains a pending queue for immediately ready timers

### Level (level.rs)
Individual timing wheel level implementation featuring:
- 64-slot circular buffer with bitfield optimization (`occupied: u64`)
- Efficient slot scanning using bitwise operations and `trailing_zeros()`
- Safe timer entry/removal with automatic occupied bit management
- Next expiration calculation with wraparound handling

## Public API Surface

**Core Operations**:
- `Wheel::new()` - Creates new timing wheel
- `Wheel::insert(TimerHandle)` - Schedules timer (unsafe, requires pinning)
- `Wheel::remove(TimerShared)` - Cancels timer (unsafe)
- `Wheel::poll()` - Advances time and returns expired timers
- `Wheel::poll_at()` - Returns next required polling time

**Time Management**:
- `Wheel::elapsed()` - Current wheel time in milliseconds
- `Wheel::set_elapsed()` - Updates wheel time (with monotonicity checks)

## Internal Organization & Data Flow

1. **Timer Insertion**: Level selection algorithm uses XOR and bit manipulation to determine appropriate level based on time distance
2. **Time Advancement**: `poll()` method advances elapsed time and triggers expiration processing
3. **Expiration Processing**: Expired slots are processed level by level, with timers either moved to pending queue (Level 0) or cascaded to lower levels
4. **Bitfield Optimization**: Each level uses a 64-bit mask to quickly identify occupied slots, avoiding unnecessary scanning

## Key Patterns & Conventions

- **Hierarchical Bucketing**: Uses power-of-2 arithmetic (64 = 2^6) for efficient slot calculation
- **Bitwise Operations**: Extensive use of bit manipulation for performance-critical operations
- **Unsafe Blocks**: Timer operations are unsafe due to concurrent access requirements and intrusive data structures
- **Cascade Handling**: Careful reprocessing logic prevents infinite loops during level-to-level timer movement
- **Monotonic Time**: Strong invariants ensure time only advances forward

## Critical Performance Features

- O(1) timer insertion through direct slot calculation
- Efficient expiration scanning via bitfield optimization
- Amortized O(1) expiration processing with occasional cascading overhead
- Memory-efficient intrusive linked lists for timer storage
- Support for both heap and slab allocation patterns

This module forms the heart of Tokio's timer system, enabling efficient scheduling of async tasks and timeouts across the entire range of practical timing requirements.