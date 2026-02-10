# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/lib.rs
@source-hash: f38ce5bea80ce7bd
@generated: 2026-02-09T18:11:40Z

## Primary Purpose
Main entry point for Mio, a fast, low-level I/O library for Rust providing non-blocking APIs and event notification for high-performance I/O applications. This is the root module that re-exports core types and organizes platform-specific functionality.

## Core Architecture
- **Event-driven I/O**: Based on `Poll` instances that monitor OS events and collect them into `Events` containers
- **Cross-platform**: Unified API with platform-specific implementations via the `sys` module
- **Feature-gated**: Uses conditional compilation to enable/disable functionality based on cargo features

## Key Exports and Types
- **Poll (L70)**: Core event loop type for monitoring I/O readiness
- **Registry (L70)**: Interface for registering event sources with the poller
- **Events (L68)**: Collection container for readiness events from the OS
- **Interest (L69)**: Flags specifying what types of events to monitor (readable/writable)
- **Token (L71)**: Unique identifier for associating events with registered sources
- **Waker (L73)**: Cross-thread signaling mechanism (non-WASI only)

## Module Organization
- **event (L57)**: Event types and traits, always available
- **net (L63-65)**: Network primitives (TCP/UDP), feature-gated on "net"
- **io_source (L59-61)**: I/O source abstractions, conditionally compiled
- **sys (L52)**: Platform-specific implementations (private)

## Platform Extensions
- **unix (L75-89)**: Unix-specific extensions including pipe support
- **hermit (L91-97)**: HermitCore OS extensions  
- **windows (L99-105)**: Windows-specific extensions including named pipes
- All platform modules require "os-ext" feature

## Feature System
- **os-poll**: Core polling functionality (without this, Poll panics)
- **os-ext**: Platform-specific extensions
- **net**: Network socket types
- Feature documentation module (L107-131) provides runtime feature status

## Documentation Modules
- **guide (L133-276)**: Comprehensive getting-started tutorial with working examples
- **features (L107-131)**: Runtime feature documentation

## Compilation Constraints
- **WASM restriction (L43-44)**: Explicitly prevents compilation on unsupported WASM targets
- **Strict linting (L1-12)**: Enforces documentation, Debug implementations, and prohibits dead code
- **Platform conditionals**: Extensive use of cfg attributes for cross-platform compatibility

## Dependencies
Internal modules: macros, interest, poll, sys, token, waker (platform-dependent)
External: Standard library only, no external crate dependencies visible