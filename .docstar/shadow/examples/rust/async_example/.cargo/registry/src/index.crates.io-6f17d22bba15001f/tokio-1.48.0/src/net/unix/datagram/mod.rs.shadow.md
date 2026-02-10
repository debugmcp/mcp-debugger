# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/unix/datagram/mod.rs
@source-hash: fc48924e5d1e5514
@generated: 2026-02-09T17:58:11Z

## Purpose
Module declaration file for Unix datagram socket types in Tokio's networking layer. Serves as the entry point for Unix domain datagram socket functionality.

## Structure
- **socket module** (L3): Private crate module containing Unix datagram socket implementation details

## Dependencies
- Part of `tokio::net::unix::datagram` module hierarchy
- Provides internal access to socket implementation via `pub(crate)` visibility

## Architecture
Simple module aggregator pattern - exposes internal socket module to other parts of the crate while keeping it private from external consumers. This allows internal Tokio components to access datagram socket internals while maintaining clean public API boundaries.