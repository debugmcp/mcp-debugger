# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/probe/
@generated: 2026-02-09T18:16:05Z

## Purpose
This directory implements **feature probing** for proc-macro2, containing compile-time tests that detect whether the current Rust toolchain supports various unstable and recently-stabilized `proc_macro::Span` APIs. The probe results determine which fallback implementations proc-macro2 should provide to maintain API consistency across Rust versions.

## Architecture Pattern
**Probe-Based Feature Detection**: Each file acts as a compilation test - if the code compiles successfully, proc-macro2 knows the corresponding APIs are available in the current toolchain. All functions are thin delegation wrappers that mirror the exact signatures of their `proc_macro::Span` counterparts.

## Key Components

### Core Probe (`proc_macro_span.rs`)
- **Scope**: Tests availability of comprehensive unstable `proc_macro::Span` APIs
- **APIs Covered**: Byte ranges, position extraction, line/column numbers, file operations, span joining/sub-spanning
- **Gating**: Conditional compilation under `proc_macro_span` feature flag

### Stabilized API Probes
- **`proc_macro_span_file.rs`**: Tests Rust 1.88+ file-related span methods (`file()`, `local_file()`)
- **`proc_macro_span_location.rs`**: Tests Rust 1.88+ location-related span methods (`start()`, `end()`, `line()`, `column()`)

## Public API Surface
The probe functions mirror the intended public API of proc-macro2's span functionality:
- **Positioning**: `start()`, `end()`, `line()`, `column()`, `byte_range()`
- **File Operations**: `file()`, `local_file()`  
- **Span Manipulation**: `join()`, `subspan()`

## Internal Organization
1. **Compilation Detection**: Build system attempts to compile each probe file
2. **Feature Mapping**: Successful compilation enables corresponding proc-macro2 features
3. **API Delegation**: When available, proc-macro2 delegates to native `proc_macro` implementations
4. **Fallback Selection**: Failed probes trigger proc-macro2's custom implementations

## Build Integration
- **Cache Integration**: Includes sccache keys for proper rebuild detection
- **Conditional Compilation**: Uses `procmacro2_build_probe` cfg for build-time context
- **Version Targeting**: Individual probes target specific Rust version capabilities (1.88+)

## Critical Design Constraints
- Zero runtime overhead - all functions are direct pass-through wrappers
- Exact API mirroring - signatures must match `proc_macro::Span` methods precisely  
- Compilation-based detection - code compilation success/failure drives feature availability
- Version awareness - separate probes for different Rust version capabilities