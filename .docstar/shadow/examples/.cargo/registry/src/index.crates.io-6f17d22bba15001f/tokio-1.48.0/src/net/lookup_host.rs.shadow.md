# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/lookup_host.rs
@source-hash: c7a21d735225e316
@generated: 2026-02-09T18:06:35Z

This file provides DNS hostname resolution functionality for Tokio's async networking module. It's a thin wrapper around the internal address resolution system, exposing a simple public API for basic DNS lookups.

## Primary Purpose
Exposes a single async function `lookup_host` that performs DNS resolution and returns an iterator of resolved socket addresses.

## Key Components
- **lookup_host function (L32-37)**: Main entry point for DNS resolution
  - Takes any type implementing `ToSocketAddrs` trait
  - Returns async `io::Result<impl Iterator<Item = SocketAddr>>`
  - Delegates to internal `addr::to_socket_addrs` function
  - Generic parameter `T` must implement `ToSocketAddrs` constraint

## Dependencies
- **Internal**: `crate::net::addr::{self, ToSocketAddrs}` - Core address resolution logic
- **Standard Library**: `std::io` for Result types, `std::net::SocketAddr` for network addresses

## Architecture Notes
- Wrapped in `cfg_net!` macro, indicating conditional compilation based on network feature flags
- Minimal wrapper pattern - exposes internal functionality with public API
- Uses trait bounds to accept flexible input types (strings, tuples, etc.)
- Iterator-based return type allows lazy evaluation of multiple resolved addresses

## Usage Pattern
Designed for basic DNS resolution use cases. Documentation explicitly states that specialized DNS libraries should be used for advanced scenarios beyond simple hostname-to-IP resolution.