# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/copy.rs
@source-hash: 986c1eb9c063632c
@generated: 2026-02-09T18:02:50Z

## Primary Purpose
Implementation of asynchronous I/O copy operations for Tokio. Provides a buffered streaming copy mechanism that transfers data from an AsyncRead source to an AsyncWrite destination using an internal buffer to optimize throughput.

## Key Components

### CopyBuffer (L8-215)
Core state machine managing the copy operation with internal buffering:
- **Fields**:
  - `read_done` (L10): Tracks EOF from reader
  - `need_flush` (L11): Indicates pending flush requirement
  - `pos` (L12): Current buffer read position
  - `cap` (L13): Current buffer capacity/fill level
  - `amt` (L14): Total bytes copied counter
  - `buf` (L15): Heap-allocated byte buffer

- **Key Methods**:
  - `new()` (L19-28): Constructor with configurable buffer size
  - `poll_fill_buf()` (L30-49): Attempts to read data into internal buffer
  - `poll_write_buf()` (L51-73): Writes buffered data, with read-ahead optimization
  - `poll_copy()` (L75-214): Main state machine orchestrating the copy process

### Copy Future (L221-295)
Future wrapper implementing the async copy interface:
- Holds mutable references to reader and writer (L222-223)
- Contains CopyBuffer instance (L224)
- Implements Future trait with Poll-based execution (L289-294)

### Public API
- `copy()` function (L269-279): High-level async interface using 8KB default buffer

## Architecture Patterns

### State Machine Design
The copy operation uses a sophisticated polling state machine that:
1. Fills buffer from reader when space available
2. Writes buffer contents to writer
3. Handles backpressure and partial writes
4. Manages cooperative task scheduling via `coop.made_progress()`

### Optimization Strategies
- **Read-ahead buffering** (L64-68): Attempts additional reads during writer backpressure
- **Deadlock prevention** (L134-150): Forces flush when reader blocks and buffer empty
- **Zero-copy validation** (L172-176): Detects and errors on zero-byte writes
- **Buffer management** (L192-194): Resets buffer positions after complete writes

## Dependencies
- `crate::io::{AsyncRead, AsyncWrite, ReadBuf}` (L1): Core async I/O traits
- `crate::trace::trace_leaf` (L85): Tracing support
- `crate::task::coop` (L97): Cooperative task scheduling
- `super::DEFAULT_BUF_SIZE` (L277): Default 8KB buffer size

## Critical Invariants
- `pos <= cap` always (L187-190): Prevents infinite loops from incorrect writer implementations
- Buffer position tracking ensures no data loss during partial operations
- Flush semantics prevent data loss on completion (L198-211)

## Feature Gate Integration
Extensive conditional compilation blocks (L86-95, L104-113, etc.) enable cooperative scheduling only when relevant Tokio features are enabled, reducing overhead in minimal configurations.