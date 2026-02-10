# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/loom/std/atomic_u64_native.rs
@source-hash: 559e6fd21e678b90
@generated: 2026-02-09T18:02:47Z

## Purpose and Responsibility

Platform-specific atomic module providing native 64-bit atomic operations for Tokio's internal loom abstraction layer. This file serves as the standard library implementation variant when loom testing is not active.

## Key Components

- **Re-export (L1)**: Exposes `std::sync::atomic::{AtomicU64, Ordering}` as crate-internal types
- **Type Alias (L4)**: `StaticAtomicU64` aliased to `AtomicU64` for consistent naming across loom variants

## Architectural Context

This module is part of Tokio's loom abstraction system, which provides a unified interface for atomic operations that can switch between:
- Standard library atomics (this file) for production builds
- Loom's model-checked atomics for concurrency testing

The `StaticAtomicU64` alias maintains API consistency across different loom configurations while using native atomic operations when loom testing is disabled.

## Dependencies

- Standard library's `std::sync::atomic` module for core atomic primitives

## Critical Notes

- Native 64-bit atomics may not be available on all target platforms
- This implementation assumes the target supports lock-free 64-bit atomic operations
- The `pub(crate)` visibility restricts usage to within the tokio crate