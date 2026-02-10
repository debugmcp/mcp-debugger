# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/signal-hook-registry-1.4.6/tests/unregister_signal.rs
@source-hash: 5baeebbde2bd7e63
@generated: 2026-02-09T18:11:46Z

## Integration Test for Signal Unregistration

**Primary Purpose**: Integration test verifying the deprecated `unregister_signal` function correctly removes signal handlers without interfering with other signal registrations.

**Test Structure**:
- `register_unregister()` test function (L18-59): Comprehensive test of signal registration/unregistration lifecycle
- Uses `Arc<AtomicUsize>` counter (L20) to track handler invocations across multiple registrations
- Closure-based handler (L22-27) increments counter atomically

**Key Dependencies**:
- `signal_hook_registry`: Core functionality for `register()` and deprecated `unregister_signal()`
- `libc`: Signal constants (`SIGTERM`, `SIGINT`) and `raise()` for signal generation
- `std::sync::atomic`: Thread-safe counter for handler execution tracking

**Test Scenarios Validated**:
1. **Multiple registrations** (L30-32): Same handler registered twice for SIGTERM, once for SIGINT
2. **Handler execution counting** (L34-38): Verifies both SIGTERM handlers execute (count = 2)
3. **Bulk unregistration** (L40-47): `unregister_signal(SIGTERM)` removes all SIGTERM handlers at once
4. **Idempotent unregistration** (L44): Second unregister call returns false (nothing to remove)
5. **Signal isolation** (L49-51): SIGINT handler remains unaffected by SIGTERM unregistration
6. **Re-registration capability** (L53-58): Can register new handlers for previously unregistered signals

**Critical Behavior**: The deprecated `unregister_signal()` function removes ALL handlers for a given signal type in a single call, not just the most recent registration.

**Unsafe Operations**: All signal operations (`register()`, `libc::raise()`) properly wrapped in unsafe blocks due to signal handling being inherently unsafe.