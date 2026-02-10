# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/benches/buf.rs
@source-hash: 72e6b6120b52d568
@generated: 2026-02-09T18:11:29Z

**Primary Purpose:** Benchmark suite for the `bytes` crate's `Buf` trait implementations, measuring performance of various read operations across different buffer types and configurations.

**Key Components:**

**TestBuf (L10-63)** - Custom `Buf` implementation for benchmarking with configurable read patterns:
- `buf`: Static byte slice to read from
- `readlens`: Array defining chunk sizes for sequential reads
- `pos`: Current read position, `init_pos`: Starting position for resets
- `new()` (L19-30): Constructor with buffer, read lengths, and initial position
- `reset()` (L31-35): Resets position to initial state for repeated benchmarks
- `next_readlen()` (L39-45): Calculates next read chunk size from `readlens` array or remaining bytes
- `Buf` trait implementation (L47-63): `remaining()`, `advance()`, and `chunk()` methods

**TestBufC (L67-93)** - Performance comparison wrapper around `TestBuf`:
- Uses `#[inline(never)]` on all `Buf` methods to simulate costly function calls
- Identical functionality to `TestBuf` but prevents compiler optimizations

**Benchmark Macros:**
- `bench!` macro (L95-145): Generates benchmark functions with three variants:
  - `testbuf` variant: Tests custom `TestBuf`/`TestBufC` with configurable read patterns
  - `slice` variant: Tests built-in slice `Buf` implementation
  - `option` variant: Tests `Option<[u8]>` `Buf` implementation (only for `get_u8`)
- `bench_group!` macro (L147-157): Creates complete benchmark suite for a method across all buffer types

**Benchmark Modules (L159-186):**
- Separate modules for each primitive read operation: `get_u8`, `get_u16`, `get_u32`, `get_u64`, `get_f32`, `get_f64`
- Special case `get_uint24` module benchmarks `get_uint(3)` for 24-bit integer reads

**Architecture Patterns:**
- Uses type erasure (`&mut dyn Buf`) to ensure fair comparisons across implementations
- Benchmarks multiple buffer alignments (0-7 byte offsets) to test performance across memory boundaries
- Employs `test::black_box()` to prevent compiler from optimizing away benchmark code
- Configurable read patterns via `readlens` parameter allow testing fragmented vs. contiguous reads

**Dependencies:** 
- `bytes::Buf` trait for buffer operations
- `test::Bencher` for benchmark framework (requires nightly Rust with `#![feature(test)]`)

**Critical Constraints:**
- Requires nightly Rust compiler for benchmark feature
- Buffer sizes carefully calculated to ensure valid reads at all alignment offsets
- TestBuf maintains invariant that `pos <= buf.len()` via assertion in `advance()`