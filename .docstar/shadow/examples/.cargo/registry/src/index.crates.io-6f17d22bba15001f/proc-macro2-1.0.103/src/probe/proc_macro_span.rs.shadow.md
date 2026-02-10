# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/probe/proc_macro_span.rs
@source-hash: f3f9c728438060c9
@generated: 2026-02-09T18:06:23Z

## Purpose
This file serves as a **capability probe** for proc-macro2, testing whether the current Rust toolchain supports unstable `proc_macro::Span` APIs. It acts as a compilation test - if this code compiles, proc-macro2 can safely expose these same APIs as fallbacks.

## Architecture Pattern
**Probe Pattern**: Each function (L13-47) is a thin wrapper that directly delegates to the corresponding unstable `proc_macro::Span` method. This allows build-time detection of API availability without runtime overhead.

## Key Functions
- `byte_range()` (L13-15): Returns byte range of span in source
- `start()` / `end()` (L17-23): Extract start/end positions as spans
- `line()` / `column()` (L25-31): Get line/column numbers
- `file()` / `local_file()` (L33-39): Retrieve source file information
- `join()` (L41-43): Merge two spans if contiguous
- `subspan()` (L45-47): Extract sub-span from literal using range bounds

## Dependencies
- `proc_macro::{Literal, Span}` (L10): Core unstable span types
- `core::ops::{Range, RangeBounds}` (L9): For range operations
- `std::path::PathBuf` (L11): For file path handling

## Build Configuration
- Conditional feature gate `proc_macro_span` (L5) enabled only during probe builds
- Cache key inclusion for sccache (L49-51) ensures proper rebuild behavior
- `procmacro2_build_probe` cfg controls compilation context

## Critical Constraints
- All functions are simple pass-through wrappers with no additional logic
- Compilation success/failure of this file determines API availability in proc-macro2
- Functions mirror exact signatures of unstable `proc_macro` APIs