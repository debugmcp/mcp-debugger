# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/windows/waitaddress.rs
@source-hash: 9ab190cd9aaaf89b
@generated: 2026-02-09T18:03:22Z

## Purpose
Windows-specific thread parking implementation using WaitOnAddress/WakeByAddressSingle APIs for efficient thread synchronization in parking_lot_core. Provides low-level parking primitives that avoid kernel transitions when possible.

## Core Components

### WaitAddress Struct (L17-20)
Windows API wrapper containing function pointers to WaitOnAddress and WakeByAddressSingle syscalls. Uses non-standard naming to match Windows API conventions.

### Key Methods

**create() (L24-38)**: Factory method that dynamically loads synchronization DLL and retrieves function pointers. Returns None if APIs unavailable (pre-Windows 8). Uses unsafe transmute to convert raw function pointers.

**prepare_park() (L41-43)**: Sets atomic key to 1 (parked state) using Relaxed ordering as preparation for parking.

**park() (L51-56)**: Unconditional parking loop. Spins on Acquire-ordered load until key becomes 0, calling wait_on_address with INFINITE timeout. Debug asserts successful wait.

**park_until() (L59-83)**: Timeout-aware parking with complex duration calculation. Converts Instant to milliseconds with overflow protection, handles timeout detection, and validates ERROR_TIMEOUT on wait failure.

**unpark_lock() (L86-94)**: Initiates unpark sequence by clearing key to 0 with Release ordering. Returns UnparkHandle for deferred wake operation.

**wait_on_address() (L97-107)**: Internal wrapper around WaitOnAddress syscall. Compares key against value 1, using raw pointers and size parameters.

### UnparkHandle Struct (L113-116)
Deferred unpark mechanism holding key pointer and WaitAddress reference. Allows unlocking before actual thread wake to minimize lock contention.

**unpark() (L122-124)**: Executes WakeByAddressSingle syscall to wake single waiting thread.

## Dependencies
- Windows synchronization APIs via bindings module
- AtomicUsize for lock-free state management
- Instant for timeout calculations

## Architecture Patterns
- Two-phase unpark design (mark + wake) to reduce lock hold time
- Dynamic API loading for backward compatibility
- Atomic state machine: 0 (unparked) ↔ 1 (parked)
- Unsafe transmute for syscall function pointer conversion

## Critical Invariants
- WaitAddress must have 'static lifetime for safe cross-thread usage
- Key state: 0 = unparked, 1 = parked
- Memory ordering: Relaxed for prepare, Acquire/Release for park/unpark synchronization