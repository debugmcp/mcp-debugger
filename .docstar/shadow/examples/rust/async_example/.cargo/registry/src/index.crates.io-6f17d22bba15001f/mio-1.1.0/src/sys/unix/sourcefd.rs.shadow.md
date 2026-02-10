# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/unix/sourcefd.rs
@source-hash: f9f9b0c671599089
@generated: 2026-02-09T18:03:18Z

## Purpose

Unix-specific adapter for integrating raw file descriptors (`RawFd`) into Mio's event system. Provides a bridge allowing any FD-backed resource to be registered with Mio's event polling infrastructure.

## Core Components

**SourceFd struct (L97)**: Thin wrapper around a borrowed `RawFd` that implements the `event::Source` trait. Takes `&RawFd` to avoid ownership transfer - lifecycle management remains with the caller.

**event::Source implementation (L99-121)**: Delegates all operations to the registry's selector:
- `register()` (L100-107): Registers FD with selector for event monitoring
- `reregister()` (L109-116): Updates registration parameters for existing FD
- `deregister()` (L118-120): Removes FD from event monitoring

## Platform Handling

Uses conditional compilation for FD type imports:
- Most Unix targets (L2-3): `std::os::fd::RawFd`
- HermitCore target (L6-7): `std::os::hermit::io::RawFd`

## Dependencies

- `crate::{event, Interest, Registry, Token}` (L9): Core Mio event system components
- Platform-specific `RawFd` types for Unix file descriptor handling

## Architecture Pattern

**Adapter Pattern**: Wraps raw file descriptors to provide Mio-compatible event source interface without taking ownership. Enables integration of any FD-backed resource (sockets, files, pipes) into Mio's event loop.

**Zero-cost Abstraction**: Minimal overhead wrapper that directly forwards operations to underlying selector implementation.

## Usage Context

Intended for ephemeral use - construct `SourceFd` immediately before registration calls rather than long-term storage. Commonly used to integrate standard library networking types or custom FD-backed resources into Mio event loops.