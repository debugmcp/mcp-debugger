# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot-0.12.5/tests/issue_203.rs
@source-hash: 5fbdf6ec63f391d8
@generated: 2026-02-09T18:11:37Z

## Purpose
Regression test for issue #203 in parking_lot crate, specifically testing thread-local RwLock behavior during thread shutdown and drop sequences.

## Key Components

**Bar struct (L4)**
- Wrapper around `RwLock<()>` designed to test drop behavior
- Custom `Drop` implementation (L6-10) acquires write lock during destruction

**Thread-local storage (L12-14)**
- `B`: Thread-local `Bar` instance containing an RwLock
- Ensures each thread gets its own instance that will be dropped on thread exit

**Test function main() (L16-26)**
- Spawns thread that accesses thread-local RwLock then creates/uses another RwLock
- Tests interaction between thread-local drop sequence and regular RwLock usage
- Verifies no deadlock occurs during thread shutdown when Drop trait acquires locks

## Dependencies
- `parking_lot::RwLock`: High-performance reader-writer lock implementation
- `std::thread`: Standard library threading primitives

## Architectural Pattern
This is a targeted regression test following the pattern:
1. Set up problematic scenario (thread-local with locking Drop)
2. Exercise the scenario in a spawned thread
3. Ensure clean shutdown without deadlock

## Critical Behavior
The test validates that parking_lot's RwLock implementation correctly handles the edge case where:
- Thread-local destructors run during thread shutdown
- Those destructors attempt to acquire locks
- Other locks may still be held or in use during shutdown sequence

The successful completion of `join().unwrap()` confirms no deadlock occurred.