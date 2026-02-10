# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/writer.rs
@source-hash: b137608cb40944a5
@generated: 2026-02-09T18:06:18Z

## Writer Adapter for BufMut to io::Write Bridge

This module provides a bridge adapter that allows any `BufMut` implementation to be used with Rust's standard `io::Write` interface. The primary purpose is to enable seamless integration between the bytes crate's buffer mutation API and standard I/O operations.

### Core Components

**Writer<B> struct (L10-13)**: Generic wrapper that holds a `BufMut` implementor and provides `io::Write` functionality. The struct is parameterized over type `B` which must implement `BufMut`.

**Constructor function new<B> (L15-17)**: Simple factory function that creates a new `Writer` instance by wrapping the provided buffer.

### Key Methods

**Reference access methods (L19-54)**:
- `get_ref()` (L33-35): Returns immutable reference to underlying buffer
- `get_mut()` (L52-54): Returns mutable reference to underlying buffer  
- `into_inner()` (L72-74): Consumes wrapper and returns owned underlying buffer

**io::Write implementation (L77-88)**: 
- `write()` (L78-83): Writes data by calculating available space using `remaining_mut()`, taking minimum of available space and source length, then using `put_slice()` to write data
- `flush()` (L85-87): No-op implementation since `BufMut` doesn't require explicit flushing

### Dependencies

- `crate::BufMut`: Core buffer mutation trait from bytes crate
- `std::{cmp, io}`: Standard library for comparisons and I/O traits

### Architectural Pattern

This follows the adapter pattern, allowing `BufMut` implementations to participate in standard Rust I/O ecosystems. The `write()` implementation is capacity-aware, preventing buffer overruns by writing only what fits in remaining space.

### Usage Context

Typically created via `BufMut::writer()` method rather than direct instantiation. Examples show integration with `io::copy()` for stream processing scenarios.