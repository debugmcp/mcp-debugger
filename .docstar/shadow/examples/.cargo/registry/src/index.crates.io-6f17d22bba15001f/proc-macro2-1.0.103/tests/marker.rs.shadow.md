# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/tests/marker.rs
@source-hash: f16299460587d6c6
@generated: 2026-02-09T18:11:44Z

This file tests marker trait implementations for proc-macro2 types using compile-time assertions.

## Primary Purpose
Tests that proc-macro2 types correctly implement or don't implement specific marker traits (Send, Sync, UnwindSafe, RefUnwindSafe). Uses clever macro techniques to verify trait bounds at compile time without runtime overhead.

## Key Components

### `assert_impl!` macro (L7-43)
Core testing macro with two patterns:
- **Positive assertion** (L8-15): Verifies types implement specified traits using generic bounds
- **Negative assertion** (L17-42): Uses trait disambiguation to verify types DON'T implement traits

The negative assertion pattern works by creating two traits with the same method name:
- `IsNotImplemented` (L25-28): Implemented for types that DO have the marker trait
- `IsImplemented` (L31-34): Implemented for the specific type being tested
- Disambiguation call (L38) succeeds only if the type lacks the marker trait

### Main Test Assertions (L45-55)
- `Delimiter` and `Spacing`: Must be `Send + Sync` (copyable enums)
- All other proc-macro2 types: Must NOT be `Send` or `Sync` (contain spans tied to specific proc-macro contexts)

### Conditional Testing
- **semver_exempt module** (L57-62): Tests `LineColumn` type only when semver-exempt features are enabled
- **unwind_safe module** (L64-97): Tests all types implement `UnwindSafe + RefUnwindSafe` using helper macro `assert_unwind_safe!` (L72-78)

## Architecture Notes
- Uses compile-time trait resolution for zero-runtime-cost testing
- Leverages method call disambiguation to detect absence of trait implementations
- Conditional compilation ensures tests match available API surface
- Tests reflect proc-macro2's design where most types are context-dependent and not thread-safe