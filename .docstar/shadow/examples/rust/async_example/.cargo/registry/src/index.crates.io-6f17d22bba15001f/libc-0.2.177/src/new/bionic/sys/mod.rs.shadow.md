# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/new/bionic/sys/mod.rs
@source-hash: 0fc3d4ff1c37a21f
@generated: 2026-02-09T17:58:12Z

## Primary Purpose
Module aggregator for Android Bionic system-level functionality within the libc crate. Serves as a re-export hub for socket-related system calls and constants specific to Android's Bionic C library.

## Module Structure
- **socket module** (L1): Contains socket-related system calls, constants, and types for Android Bionic
- **Re-export all** (L2): Makes all public items from the socket module available through this parent module

## Architecture Pattern
Follows Rust's standard module organization pattern where `sys/mod.rs` acts as a namespace aggregator. This allows consumers to import socket functionality via `sys::*` rather than requiring explicit `sys::socket::*` imports.

## Dependencies
- Internal dependency on `socket` submodule for Android Bionic socket implementation

## Context
Part of libc crate's platform-specific abstraction layer for Android Bionic, providing a clean interface to low-level system socket operations while maintaining cross-platform compatibility through conditional compilation.