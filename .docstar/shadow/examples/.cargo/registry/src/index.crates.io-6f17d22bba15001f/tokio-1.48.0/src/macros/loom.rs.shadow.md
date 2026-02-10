# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/loom.rs
@source-hash: bee8a86b0b96697c
@generated: 2026-02-09T18:06:32Z

**Primary Purpose**: Conditional compilation utility macro for Tokio's Loom integration testing framework.

**Key Macro**:
- `if_loom!` (L1-8): Conditional compilation macro that executes code only when the `loom` feature flag is enabled. Takes arbitrary token trees as input and wraps them in a `#[cfg(loom)]` conditional compilation block.

**Architecture Pattern**: 
This is a feature-gating macro using Rust's conditional compilation attributes. The macro provides a clean interface for including Loom-specific code (concurrent testing utilities) without affecting production builds.

**Usage Context**: 
Loom is a testing framework for concurrent Rust code that provides deterministic testing of multi-threaded programs. This macro allows Tokio to include Loom-specific instrumentation and testing code only when explicitly testing with Loom.

**Dependencies**: 
- Relies on the `loom` cfg feature flag being set during compilation
- No external crate dependencies in this file

**Critical Design Decision**: 
Uses token tree (`$($t:tt)*`) pattern to accept arbitrary Rust code, making it maximally flexible for wrapping any Loom-specific constructs or function calls.