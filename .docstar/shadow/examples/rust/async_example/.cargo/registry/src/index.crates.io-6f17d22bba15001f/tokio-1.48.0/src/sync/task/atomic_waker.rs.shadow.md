# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/task/atomic_waker.rs
@source-hash: e859b923919f6c11
@generated: 2026-02-09T18:03:28Z

## Primary Purpose

`AtomicWaker` (L27-30) is a lock-free synchronization primitive for coordinating task waking in async Rust. It allows multiple threads to safely register and wake tasks without traditional locking, using atomic operations to manage concurrent access to a single `Waker` instance.

## Key Architecture

The implementation uses a two-bit state machine with an `AtomicUsize` (L28) and `UnsafeCell<Option<Waker>>` (L29):

- **State Constants** (L132-138): 
  - `WAITING = 0`: Idle state, no operations in progress
  - `REGISTERING = 0b01`: Producer thread is setting a new waker
  - `WAKING = 0b10`: Consumer thread is taking/waking the current waker

## Core Methods

- **`new()`** (L142-147): Creates new instance in `WAITING` state with no waker
- **`register_by_ref(&self, waker: &Waker)`** (L171-173): Registers a waker by reference, delegates to `do_register`
- **`do_register<W: WakerRef>(&self, waker: W)`** (L175-298): Core registration logic with complex state transitions and panic handling
- **`wake(&self)`** (L303-309): Wakes the registered task by calling `take_waker()` then `wake()`
- **`take_waker(&self) -> Option<Waker>`** (L313-342): Atomically extracts the waker for manual waking

## Critical Implementation Details

**Registration Flow** (L183-298):
1. Attempts `WAITING -> REGISTERING` transition (L185)
2. If successful, stores new waker with panic protection (L189-207)  
3. Attempts `REGISTERING -> WAITING` transition (L216-218)
4. If concurrent wake occurred (`REGISTERING | WAKING`), immediately wakes the stored waker (L228-266)

**Wake Flow** (L317-341):
1. Sets `WAKING` bit with `fetch_or` (L317)
2. If was `WAITING`, extracts waker and resets to `WAITING` (L318-326)
3. If concurrent operation detected, returns `None` (L328-340)

## Memory Safety & Concurrency

- **Multi-consumer, single-producer**: Multiple threads can wake, but registration should be synchronized (L35-46)
- **Lock-free design**: Uses compare-exchange operations to avoid traditional locks
- **Panic safety**: Extensive panic handling in `do_register` to maintain state consistency (L179-272)
- **Memory ordering**: Uses `Acquire`/`Release`/`AcqRel` for proper synchronization (L185, L218, L317, L323)

## Traits & Safety

- **`WakerRef` trait** (L360-383): Abstraction over owned `Waker` and `&Waker` for unified handling
- **Send + Sync** (L357-358): Safe for concurrent access across threads  
- **Unwind traits** (L32-33): Safe during panic unwinding
- **Default + Debug** (L345-355): Standard derive-equivalent implementations

## Dependencies

- `crate::loom`: Provides `UnsafeCell`, `AtomicUsize`, and `hint::spin_loop` for testing/production abstraction
- `std::task::Waker`: Core async task waking primitive
- `std::panic`: Panic handling utilities for maintaining consistency during unwinding

## Usage Pattern

Consumers call `register_by_ref()` before checking computation results, producers call `wake()` after producing results. The primitive handles the race condition where wake occurs before register by making wake a no-op in that case.