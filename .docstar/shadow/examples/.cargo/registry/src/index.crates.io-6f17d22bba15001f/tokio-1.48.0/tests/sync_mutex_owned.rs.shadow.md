# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/sync_mutex_owned.rs
@source-hash: 8542243a3870c87d
@generated: 2026-02-09T18:12:36Z

## Purpose
Test suite for Tokio's `Mutex` owned locking functionality, specifically testing `lock_owned()` and `try_lock_owned()` methods that return guards with ownership of the Arc rather than borrowing it.

## Platform Compatibility
- **WASM Support (L4-10)**: Conditional compilation for WebAssembly targets, using `wasm_bindgen_test` for WASM environments and `tokio::test` for native platforms
- **Feature Gating (L2)**: Requires `sync` feature to compile

## Key Dependencies
- **tokio::sync::Mutex (L12)**: The async mutex being tested
- **tokio_test (L13-14)**: Testing utilities (`spawn`, `assert_pending`, `assert_ready`)
- **std::sync::Arc (L16)**: For shared ownership of mutex instances

## Test Functions

### `straight_execution()` (L18-39)
- **Purpose**: Validates basic owned lock acquisition and modification across multiple scopes
- **Pattern**: Sequential lock acquisition using `Arc<Mutex<T>>.lock_owned()` with immediate readiness
- **Verification**: Ensures data modifications persist between lock acquisitions

### `readiness()` (L41-56)
- **Purpose**: Tests contention behavior and task wakeup mechanics
- **Key Behavior**: Second task remains pending while first holds lock, gets woken when lock is dropped
- **Critical Assertion (L54)**: Verifies task wakeup notification system works correctly

### `aborted_future_1()` (L60-87)
- **Purpose**: Ensures mutex unlocks properly when future holding lock is aborted mid-execution
- **Scenario**: Timeout aborts future after acquiring lock but before completion
- **Critical Property**: Mutex must not remain locked after future abortion
- **Attributes**: Full feature required, Miri ignored due to timing sensitivity

### `aborted_future_2()` (L89-117)
- **Purpose**: Tests cleanup when future waiting for lock is aborted
- **Scenario**: Timeout aborts future while it's blocked waiting to acquire lock
- **Verification**: Subsequent lock acquisition succeeds, proving no resource leak

### `try_lock_owned()` (L119-130)
- **Purpose**: Tests non-blocking lock acquisition semantics
- **Validation**: First attempt succeeds, second fails while held, third succeeds after release

### `debug_format()` (L132-137)
- **Purpose**: Verifies Debug trait implementation for owned lock guards
- **Pattern**: Uses conditional test macro for platform compatibility

## Architectural Patterns
- **Owned Guards**: All tests focus on `lock_owned()` vs regular `lock()`, enabling guard to outlive the Arc
- **Scoped Testing**: Uses block scopes to control guard lifetimes precisely
- **Async Cancellation Safety**: Extensive testing of cleanup behavior under various abortion scenarios
- **Cross-Platform Testing**: Conditional compilation ensures tests work in both native and WASM environments