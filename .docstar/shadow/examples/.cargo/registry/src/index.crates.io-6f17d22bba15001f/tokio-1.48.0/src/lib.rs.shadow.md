# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/lib.rs
@source-hash: a7dc99dd769fc57e
@generated: 2026-02-09T18:12:20Z

## Primary Purpose

Root library module for Tokio 1.48.0, an event-driven, non-blocking I/O runtime for asynchronous Rust applications. This file serves as the main entry point, providing comprehensive documentation, feature flag configuration, module organization, and macro re-exports.

## Key Components

### Compilation Configuration (L1-21, L464-500)
- Clippy allowances and lint warnings for code quality enforcement
- Platform compatibility checks requiring 32+ bit pointer width
- Feature flag validation for WASM targets and unstable features
- Conditional compilation for `io-uring` and `taskdump` features requiring `tokio_unstable`

### Module Organization (L510-601)
Conditionally exposed modules based on feature flags:
- **fs** (L510-512): File system operations (`cfg_fs!`)
- **io** (L516): Core async I/O traits (always available)
- **net** (L517): Network primitives (TCP/UDP/Unix sockets)
- **process** (L521-523): Child process management (`cfg_process!`)
- **runtime** (L533-538): Task scheduler and execution context
- **signal** (L540-549): OS signal handling with internal fallback
- **sync** (L551-556): Synchronization primitives
- **task** (L558-561): Task spawning and management
- **time** (L563-565): Timer and timeout utilities

### Internal Utilities (L567-601)
- **trace** module (L567-599): Task tracing infrastructure with conditional `taskdump` support
- **util** module (L601): Internal utilities
- **blocking** module (L531): Blocking task execution support

### Macro Re-exports (L657-698)
Conditional macro exports based on feature availability:
- `main` and `test` attributes with runtime-specific variants
- Private `select!` macro implementation details
- Fallback macros for disabled runtime features

### Platform-Specific Handling (L642-655)
- Documentation generation support for Unix platforms
- OS abstraction layer configuration

### Stream Module Placeholder (L603-640)
Documents the intentional exclusion of `Stream` utilities, directing users to `tokio-stream` crate due to timing of `Stream` trait standardization.

## Architecture Decisions

- **Feature-gated compilation**: Extensive use of conditional compilation to minimize binary size
- **Modular design**: Clear separation of concerns with optional modules
- **Documentation-first approach**: Comprehensive inline documentation explaining design decisions
- **Platform abstraction**: Conditional OS-specific code handling
- **Backwards compatibility**: Careful feature flag management for stable API surface

## Critical Dependencies

- `tokio-macros`: Procedural macros for `#[tokio::main]` and `#[tokio::test]`
- Platform-specific OS modules via `std::os`
- Feature-conditional internal modules

## Runtime Constraints

- Minimum 32-bit pointer width requirement
- WASM platform restrictions (limited feature set without `tokio_unstable`)
- Platform-specific feature availability (Linux-only `taskdump` on specific architectures)