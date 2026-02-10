# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/atomic_waker.rs
@source-hash: f082e2937ae54cad
@generated: 2026-02-09T18:03:18Z

**Primary Purpose**: Test suite for tokio's `AtomicWaker` synchronization primitive, validating thread-safe waker registration, wake behavior, and panic safety.

**Key Test Functions**:

- `basic_usage()` (L21-29): Validates standard AtomicWaker workflow - register waker, call wake(), verify notification
- `wake_without_register()` (L31-40): Tests edge case where wake() is called before registration, ensuring subsequent registration doesn't trigger notification
- `failed_wake_synchronizes()` (L42-48): Stress test runner executing synchronization test 1000 times (WASM threads disabled)
- `failed_wake_synchronizes_inner()` (L50-72): Complex concurrency test using `std::thread::scope` to verify memory synchronization between competing `take_waker()` calls across threads
- `atomic_waker_panic_safe()` (L74-113): Panic safety test ensuring AtomicWaker remains in valid state after panicking waker operations

**Dependencies**:
- `crate::sync::AtomicWaker`: Primary test subject
- `tokio_test::task`: Test harness for async task simulation
- `futures::task::noop_waker_ref`: No-op waker for testing
- `std::sync::atomic::AtomicBool`: For synchronization verification

**Thread Safety Assertions**:
- `AssertSend`/`AssertSync` traits (L6-16): Compile-time verification that `AtomicWaker` and `Waker` implement Send/Sync

**Architecture Patterns**:
- Uses custom `RawWakerVTable` implementations (L82-94) to test panic scenarios
- Employs scoped threads for memory synchronization validation
- Static atomics for cross-thread communication verification

**Platform Considerations**:
- WASM-specific conditional compilation for thread-unsupported tests
- Panic unwind tests disabled on WASM (no unwinding support)

**Critical Invariants**:
- AtomicWaker must remain usable after panic in registration
- Memory synchronization must occur between concurrent take_waker operations
- Wake-before-register should not cause spurious notifications