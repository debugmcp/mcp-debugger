# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_read_buf.rs
@source-hash: 6dc454751af0e9cc
@generated: 2026-02-09T18:12:17Z

## Primary Purpose
Test suite for Tokio's `ReadBuf` functionality, verifying buffer reading operations and edge cases in async I/O contexts.

## Key Test Functions

### `read_buf()` (L11-36)
Tests basic `AsyncRead` implementation with `ReadBuf`:
- **Mock Reader `Rd`** (L13-27): Simple async reader that increments counter and writes "hello world" to buffer
- **Core Test Logic** (L29-35): Verifies that `read_buf()` correctly reads data, updates counter, and returns proper byte count
- **Assertions**: Confirms single read operation, 11 bytes read, and correct data content

### `issue_5588()` (L38-94)
Regression test for ReadBuf buffer management edge cases (requires "io-util" feature):
- **Steps to Zero Test** (L43-62): Verifies `ReadBuf` behavior when buffer capacity is consumed incrementally via `advance_mut()`
- **Direct to Zero Test** (L64-73): Tests immediate buffer capacity consumption
- **Uninit Buffer Tests** (L75-94): Validates `ReadBuf::uninit()` with `MaybeUninit` arrays and mixed operations (`advance_mut`, `put_u8`, `put_slice`)

## Key Dependencies
- `tokio::io::{AsyncRead, AsyncReadExt, ReadBuf}` - Core async I/O traits and buffer type
- `tokio_test::assert_ok` - Test assertion utility
- `bytes::BufMut` - Buffer mutation trait (for issue_5588 test)
- `std::{io, pin::Pin, task::{Context, Poll}}` - Standard async/await infrastructure

## Architecture Notes
- Uses custom `AsyncRead` implementation to control test behavior
- Extensively tests buffer state transitions and capacity tracking
- Validates both initialized and uninitialized buffer scenarios
- Tests regression for specific issue #5588 related to buffer chunk management