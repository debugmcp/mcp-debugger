# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/io/mod.rs
@source-hash: 9f7f85d298193291
@generated: 2026-02-09T18:03:03Z

## Purpose
Module organizing Tokio's async I/O runtime components. Serves as the main entry point and coordination layer for the I/O driver subsystem that handles async file and network operations.

## Key Components

### Module Structure
- **driver** (L5-7): Core I/O event loop driver providing `Driver`, `Handle`, and `ReadyEvent` types
- **registration** (L9-10): I/O resource registration system via `Registration` type
- **registration_set** (L12-13): Collection management for multiple I/O registrations via `RegistrationSet`
- **scheduled_io** (L15-16): I/O operation scheduling and state management via `ScheduledIo`
- **metrics** (L18-19): Performance monitoring and statistics collection via `IoDriverMetrics`

### Global State
- **EXPOSE_IO** (L22): Static pointer exposure domain for `ScheduledIo` instances, enabling safe pointer-based operations across async boundaries

## Dependencies
- **crate::util::ptr_expose::PtrExposeDomain** (L21): Utility for safe pointer exposure in async contexts

## Architectural Patterns
- Module-based organization with clear separation of concerns
- Public crate-level exports for internal Tokio runtime use
- Static domain for managing pointer lifetimes in async scenarios
- Conditional compilation support for feature gates (rt, net, io-uring)

## Critical Details
- Uses `cfg_attr` to allow dead code when certain feature combinations are disabled (L1-4)
- All exports are `pub(crate)` - internal to Tokio crate only
- Designed for integration with Tokio's broader async runtime architecture