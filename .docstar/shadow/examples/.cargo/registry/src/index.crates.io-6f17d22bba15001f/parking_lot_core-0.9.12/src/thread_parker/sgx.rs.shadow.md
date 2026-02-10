# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/parking_lot_core-0.9.12/src/thread_parker/sgx.rs
@source-hash: 969a706a15b96bfd
@generated: 2026-02-09T18:06:24Z

## Purpose
SGX (Intel Software Guard Extensions) specific implementation of thread parking primitives for the parking_lot_core crate. Provides thread synchronization using Intel SGX's secure enclave user calls and TCS (Thread Control Structure) handles.

## Key Components

**ThreadParker (L24-27)**
- Core parking structure with atomic boolean state and TCS handle
- `parked: AtomicBool` - tracks whether thread is currently parked
- `tcs: Tcs` - Intel SGX Thread Control Structure for this thread

**ThreadParkerT Implementation (L29-86)**
- `new()` (L35-40) - initializes with current TCS and unparked state
- `prepare_park()` (L43-45) - atomically sets parked flag using Relaxed ordering
- `timed_out()` (L48-50) - checks if still parked using Relaxed ordering
- `park()` (L53-58) - infinite wait loop using SGX `usercalls::wait` with EV_UNPARK event
- `park_until()` (L61-78) - timeout-aware parking with nanosecond precision, handles timeout/would-block errors
- `unpark_lock()` (L81-85) - clears parked state and returns UnparkHandle with TCS

**UnparkHandle (L88)**
- Wrapper around TCS for cross-thread unpark operations

**UnparkHandleT Implementation (L90-104)**
- `unpark()` (L92-103) - sends EV_UNPARK event to target thread via `usercalls::send`, gracefully handles InvalidInput errors for already-exited threads

**Utility Function**
- `thread_yield()` (L107-109) - delegates to standard library thread yielding

## Dependencies
- Intel SGX specific: `std::os::fortanix_sgx` for TCS and usercalls
- Standard atomic operations and time handling
- SGX constants: `EV_UNPARK`, `WAIT_INDEFINITE`

## Architecture Notes
- Marked as cheap to construct (`IS_CHEAP_TO_CONSTRUCT: bool = true`)
- Uses acquire/release memory ordering for parking state coordination
- Error handling distinguishes timeout vs other failures
- Debug assertions validate SGX usercall results
- Lock-free design using atomic state transitions