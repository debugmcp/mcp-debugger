# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/time/wheel/level.rs
@source-hash: e7075a79b84d7618
@generated: 2026-02-09T17:58:27Z

## Purpose
Implements a single level of a hierarchical timing wheel for Tokio's timer system. This is a core component of the runtime's timer implementation that efficiently tracks and schedules timer entries using a 64-slot circular buffer with bitfield optimization.

## Key Structures

### Level (L6-20)
The main timing wheel level containing:
- `level: usize` - Level index in the timer hierarchy
- `occupied: u64` - Bitfield tracking which of the 64 slots contain timer entries (L16)
- `slot: [EntryList; 64]` - Array of timer entry lists, one per slot (L19)

### Expiration (L23-33)
Represents when a slot needs processing:
- `level: usize` - Level containing the slot
- `slot: usize` - Slot index within the level
- `deadline: u64` - Timestamp when slot must be processed

## Core Methods

### new(level) -> Level (L41-47)
Constructor initializing empty level with given index.

### next_expiration(&self, now: u64) -> Option<Expiration> (L51-106)
**Critical method** that finds the next slot requiring processing. Uses bitfield scanning to efficiently locate occupied slots. Handles edge case where computed deadline is in the past by adding a full level range for top-level slots (L67-87), implementing pseudo-ring buffer behavior.

### next_occupied_slot(&self, now: u64) -> Option<usize> (L108-120)
Finds next occupied slot using bitwise operations:
- Rotates occupied bitfield to align with current time slot
- Uses `trailing_zeros()` for efficient scanning
- Wraps around using modulo arithmetic

### unsafe add_entry(&mut self, item: TimerHandle) (L122-128)
Adds timer to appropriate slot and sets corresponding occupied bit. Marked unsafe due to concurrent access requirements.

### unsafe remove_entry(&mut self, item: NonNull<TimerShared>) (L130-141)
Removes timer from slot and clears occupied bit if slot becomes empty. Includes debug assertion to verify bit was set.

### take_slot(&mut self, slot: usize) -> EntryList (L143-147)
Atomically extracts all entries from a slot and clears its occupied bit.

## Helper Functions

### slot_for(duration: u64, level: usize) -> usize (L171-173)
**Key algorithm**: Maps timer duration to slot index using bit shifting: `(duration >> (level * 6)) % 64`. The factor of 6 comes from 64 = 2^6, enabling efficient hierarchical bucketing.

### slot_range(level: usize) -> u64 (L162-164)
Returns time range covered by each slot at given level: `64^level`.

### level_range(level: usize) -> u64 (L166-168)
Returns total time range covered by entire level: `64 * 64^level`.

### occupied_bit(slot: usize) -> u64 (L158-160)
Converts slot index to bitfield mask: `1 << slot`.

## Architecture Notes
- Uses power-of-2 arithmetic throughout for efficiency (LEVEL_MULT = 64)
- Bitfield optimization avoids scanning empty slots
- Hierarchical design allows efficient handling of timers across different time ranges
- Top level acts as pseudo-ring buffer to handle distant timers
- Thread-safe operations require unsafe blocks due to concurrent timer access

## Dependencies
- `crate::runtime::time::{EntryList, TimerHandle, TimerShared}` - Timer data structures
- `std::ptr::NonNull` - Memory safety for timer references

## Tests (L175-192)
Validates `slot_for` function across multiple levels and positions, ensuring correct slot mapping for hierarchical timer placement.