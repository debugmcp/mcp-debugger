# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/time_wasm.rs
@source-hash: cb025e0fdaeb0d98
@generated: 2026-02-09T18:12:35Z

## Purpose
Test file for Tokio time functionality on WebAssembly (WASM) targets. Validates that time-related APIs properly panic when used in unsupported WASM environments (non-WASI).

## Test Functions

**instant_now_panics** (L8-10)
- Verifies that `tokio::time::Instant::now()` panics on WASM32 targets
- Uses `#[should_panic]` attribute to expect panic behavior

**runtime_without_time_does_not_panic** (L14-19)
- Feature-gated test (`rt` enabled, `time` disabled)
- Confirms that basic runtime creation and execution works without time features
- Creates current-thread runtime and runs empty async block

**runtime_with_time_does_not_panic** (L24-29)
- Feature-gated test (both `rt` and `time` enabled)
- Currently marked with `#[should_panic]` with TODO comment about removing once time is supported
- Tests runtime creation with time features enabled

**sleep_panics_on_unknown_unknown** (L34-40)
- Feature-gated test (both `rt` and `time` enabled)
- Verifies that `tokio::time::sleep()` panics when time is explicitly enabled via `enable_time()`
- Tests 1ms sleep duration within async runtime context

## Architecture & Patterns
- Uses `wasm_bindgen_test` framework for WASM-specific testing
- Conditional compilation with `#[cfg]` attributes for feature and target gating
- Target-specific behavior validation (WASM32 non-WASI only via L2)
- Panic-driven testing to validate unsupported functionality

## Dependencies
- `wasm_bindgen_test`: WASM testing framework
- `tokio`: Runtime and time utilities being tested
- `core::time::Duration`: Standard library time primitives

## Critical Constraints
- Only runs on `wasm32` architecture excluding `wasi` target OS
- Time functionality expected to be unsupported and panic in current WASM implementation
- Feature flags control which tests execute based on enabled Tokio features