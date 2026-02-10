# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/mod.rs
@source-hash: b223651ad1aa5e4f
@generated: 2026-02-09T18:06:35Z

**Primary Purpose:** Module aggregator for Tokio's macro system, organizing and conditionally exposing various macro implementations based on feature flags.

**Architecture:** Uses Rust's conditional compilation system with custom `cfg_*!` macros to selectively include macro modules based on enabled features.

**Key Modules:**
- `cfg` (L4): Configuration macros for conditional compilation
- `loom` (L7): Concurrency testing framework integration macros  
- `pin` (L10): Pin projection and manipulation macros
- `thread_local` (L13): Thread-local storage macros
- `addr_of` (L16): Safe address-of operations macros
- `trace` (L19-21): Tracing/instrumentation macros (trace feature only)
- `select` (L24-25): Async select! macro implementation (macros feature only)
- `join` (L27-28): Async join! macro implementation (macros feature only)
- `try_join` (L30-31): Async try_join! macro implementation (macros feature only)
- `support` (L35-36): Hidden re-exports for macro implementation internals

**Feature Dependencies:**
- Core macros (cfg, loom, pin, thread_local, addr_of) always available
- `trace` module gated by `cfg_trace!` macro
- High-level async macros (select, join, try_join) gated by `cfg_macros!` macro

**Design Patterns:**
- All macro modules use `#[macro_use]` for automatic re-export
- Conditional compilation isolates optional functionality
- `#[doc(hidden)]` support module prevents end-user documentation exposure
- `#![allow(unused_macros)]` suppresses warnings when "full" feature disabled

**Critical Notes:**
- Without "full" feature, unused macro warnings are suppressed (L1)
- Support module contains implementation details not meant for direct use
- Feature-gated modules may not be available depending on compilation flags