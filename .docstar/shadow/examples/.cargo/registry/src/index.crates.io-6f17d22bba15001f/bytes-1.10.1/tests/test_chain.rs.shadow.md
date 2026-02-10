# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/tests/test_chain.rs
@source-hash: e9f094539bb42b31
@generated: 2026-02-09T18:11:28Z

**Primary Purpose**: Test suite for the `bytes` crate's chain functionality, validating buffer chaining operations for both reading (`Buf::chain`) and writing (`BufMut::chain_mut`).

**Key Test Functions**:
- `collect_two_bufs` (L8-14): Tests basic `Buf::chain` functionality by chaining two `Bytes` objects and copying the combined data
- `writing_chained` (L17-34): Tests `BufMut::chain_mut` by writing sequential bytes across two chained mutable byte arrays  
- `iterating_two_bufs` (L37-43): Validates iterator functionality over chained buffers
- `vectored_read` (L47-134): Comprehensive test of `chunks_vectored` method on chained buffers with incremental `advance` operations
- `chain_growing_buffer` (L137-147): Tests chaining with growable buffers (`Vec`) that can expand beyond initial capacity
- `chain_overflow_remaining_mut` (L150-156): Tests edge case where chained `Vec` buffers report `usize::MAX` remaining capacity
- `chain_get_bytes` (L159-177): Tests zero-copy semantics of `copy_to_bytes` on chained buffers, verifying pointer addresses remain unchanged

**Dependencies**:
- `bytes::{Buf, BufMut, Bytes}` - Core buffer types and traits
- `std::io::IoSlice` (feature-gated) - For vectored I/O operations

**Key Patterns**:
- Buffer chaining allows treating multiple separate buffers as a single logical buffer
- Tests validate both read operations (chain) and write operations (chain_mut)
- Vectored I/O testing ensures efficient scatter-gather operations
- Zero-copy semantics are preserved where possible (validated via pointer comparisons)
- Edge cases around capacity overflow and buffer growth are thoroughly tested

**Critical Invariants**:
- Chained buffers maintain sequential byte ordering across boundaries
- `advance()` operations correctly traverse buffer boundaries
- Memory allocation is minimized (zero-copy where possible)
- Capacity calculations handle overflow scenarios correctly