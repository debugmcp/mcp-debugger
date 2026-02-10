# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/future/mod.rs
@source-hash: 527c1ed5106c8f95
@generated: 2026-02-09T18:06:31Z

## Primary Purpose
Module organization hub for Tokio's future-related functionality. Acts as a conditional compilation orchestrator, selectively exposing future utilities based on enabled features.

## Key Components

### Conditional Modules
- **maybe_done (L6)**: Future utility available when "macros" or "process" features are enabled
- **try_join (L9-10)**: Process-specific future joining functionality, exports `try_join3` utility
- **block_on (L14-15)**: Synchronous future blocking utility for sync feature
- **trace (L19-21)**: Instrumented future wrapper for tracing support

### Feature-Dependent Exports
- **Future trait (L21)**: When tracing enabled, uses `InstrumentedFuture` as `Future`
- **Future trait (L26)**: When tracing disabled but runtime enabled, uses standard library's `Future`

## Architecture Patterns
- **Feature-gated compilation**: Extensive use of `cfg_*!` macros for conditional compilation
- **Facade pattern**: Module serves as a feature-aware facade for different future implementations
- **Selective visibility**: All exports use `pub(crate)` for internal Tokio access only

## Dependencies
- Standard library `std::future::Future` (conditionally)
- Internal Tokio configuration macros (`cfg_process!`, `cfg_sync!`, `cfg_trace!`, etc.)

## Critical Design Decisions
- Future trait abstraction switches between instrumented and standard versions based on tracing feature
- Process and sync features gate specific functionality to reduce binary size when unused
- Unreachable pub lint suppression (L1) when macros feature disabled