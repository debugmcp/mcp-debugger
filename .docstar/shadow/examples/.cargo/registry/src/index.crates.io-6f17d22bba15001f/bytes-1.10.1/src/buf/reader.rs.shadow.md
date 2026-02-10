# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/src/buf/reader.rs
@source-hash: cda8bc221a1de06c
@generated: 2026-02-09T18:06:18Z

## Primary Purpose
Provides an adapter that bridges the `bytes` crate's `Buf` trait with standard library I/O traits (`io::Read` and `io::BufRead`), enabling `Buf` implementations to be used in contexts expecting standard readers.

## Key Components

### Reader<B> Struct (L10-13)
Generic wrapper around any type `B` that implements `Buf`. Acts as an adapter to make `Buf` types compatible with `std::io` interfaces.

### Constructor Function
- `new<B>(buf: B) -> Reader<B>` (L15-17): Creates a new Reader instance wrapping the provided buffer

### Access Methods (L19-63)
- `get_ref(&self) -> &B` (L33-35): Returns immutable reference to underlying buffer
- `get_mut(&mut self) -> &mut B` (L40-42): Returns mutable reference to underlying buffer  
- `into_inner(self) -> B` (L60-62): Consumes Reader and returns owned underlying buffer

### I/O Trait Implementations

#### io::Read Implementation (L65-72)
- `read(&mut self, dst: &mut [u8]) -> io::Result<usize>`: Reads data from the underlying `Buf` into destination slice
- Uses `cmp::min()` to determine safe read length (L67)
- Leverages `Buf::copy_to_slice()` for efficient data transfer (L69)

#### io::BufRead Implementation (L74-81)
- `fill_buf(&mut self) -> io::Result<&[u8]>` (L75-77): Returns reference to current chunk from underlying buffer
- `consume(&mut self, amt: usize)` (L78-80): Advances buffer position by specified amount using `Buf::advance()`

## Dependencies
- `crate::Buf`: Core buffer trait from bytes crate
- `std::{cmp, io}`: Standard library comparison and I/O utilities

## Architectural Patterns
- **Adapter Pattern**: Wraps `Buf` to provide `io::Read`/`io::BufRead` interface
- **Zero-copy Design**: `fill_buf()` returns direct reference to buffer chunks rather than copying data
- **Generic Design**: Works with any type implementing `Buf` trait

## Key Constraints
- Requires `B: Buf + Sized` for I/O trait implementations
- Documentation advises against direct manipulation of underlying buffer through accessor methods