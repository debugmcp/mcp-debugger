# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/tests/test_iter.rs
@source-hash: 665e1837c1294d76
@generated: 2026-02-09T18:11:24Z

## Purpose
Test suite for iterator functionality in the `bytes` crate, specifically testing the `IntoIter` type that provides iteration over byte buffers.

## Test Functions

### `iter_len()` (L5-12)
Tests iterator length reporting for non-empty byte buffers:
- Creates `Bytes` from static string "hello world" (11 bytes)
- Wraps in `IntoIter` to get iterator interface
- Validates `size_hint()` returns exact bounds `(11, Some(11))`
- Validates `len()` returns correct count of 11

### `empty_iter_len()` (L14-21) 
Tests iterator length reporting for empty byte buffers:
- Creates empty `Bytes` instance
- Wraps in `IntoIter` 
- Validates `size_hint()` returns zero bounds `(0, Some(0))`
- Validates `len()` returns 0

## Dependencies
- `bytes::buf::IntoIter` - Iterator type for byte buffers
- `bytes::Bytes` - Core immutable byte buffer type

## Key Testing Pattern
Both tests follow identical structure: create buffer → wrap in iterator → validate size reporting methods. Tests focus on the contract that iterators must accurately report their remaining length through both `size_hint()` and `len()` methods.