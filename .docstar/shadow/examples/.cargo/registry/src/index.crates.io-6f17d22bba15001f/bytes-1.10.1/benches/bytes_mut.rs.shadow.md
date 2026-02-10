# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/bytes-1.10.1/benches/bytes_mut.rs
@source-hash: 1326fe6224b26826
@generated: 2026-02-09T18:11:29Z

## Purpose & Responsibility

Performance benchmarking suite for the `BytesMut` type from the bytes crate, measuring allocation, deref, cloning, and writing operations against standard `Vec<u8>` alternatives.

## Key Benchmark Categories

### Allocation Benchmarks (L9-30)
- `alloc_small` (L10-16): Small capacity allocation (12 bytes, 1024 iterations)
- `alloc_mid` (L19-23): Medium capacity allocation (128 bytes)  
- `alloc_big` (L26-30): Large capacity allocation (4096 bytes)

### Dereferencing Benchmarks (L32-90)
- `deref_unique` (L33-42): Dereferencing unique BytesMut (1024 iterations)
- `deref_unique_unroll` (L45-61): Loop-unrolled version (8x unroll factor)
- `deref_shared` (L64-74): Dereferencing shared BytesMut after `split_off`
- `deref_two` (L77-90): Alternating deref of small (8b) and large (1024b) buffers

### Clone & Split Operations (L92-129)
- `clone_frozen` (L93-103): Cloning frozen Bytes from BytesMut
- `alloc_write_split_to_mid` (L106-112): Write then split_to pattern
- `drain_write_drain` (L115-129): Cyclic write/split pattern with Vec collection

### Writing Benchmarks (L131-232)
- `fmt_write` (L132-145): std::fmt::Write trait implementation
- `bytes_mut_extend` (L148-162): Using Extend trait
- `put_slice_bytes_mut` (L167-181): BufMut::put_slice on BytesMut
- `put_u8_bytes_mut` (L184-198): BufMut::put_u8 on BytesMut

### Comparative Vec<u8> Benchmarks (L200-266)
- `put_slice_vec` (L201-215): BufMut::put_slice on Vec<u8>
- `put_u8_vec` (L218-232): BufMut::put_u8 on Vec<u8>  
- `put_slice_vec_extend` (L235-249): Native Vec::extend_from_slice
- `put_u8_vec_push` (L252-266): Native Vec::push

## Dependencies & Architecture

- Uses nightly `test` feature and external test crate (L1-7)
- Imports `BufMut` trait and `BytesMut` from bytes crate (L6)
- Consistent use of `test::black_box` to prevent optimization elimination
- Unsafe `set_len(0)` operations for buffer reuse without deallocation (L142, L159, etc.)

## Performance Testing Patterns

- Capacity pre-allocation to avoid reallocation overhead
- `b.bytes` assignments to measure throughput in bytes/op
- Buffer reuse via unsafe length reset for realistic performance measurement
- Comparison matrix: BytesMut vs Vec<u8> for equivalent operations