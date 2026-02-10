# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/smallvec-1.15.1/benches/bench.rs
@source-hash: d82015eae942ee5c
@generated: 2026-02-09T18:11:53Z

## SmallVec Benchmark Suite

Performance testing module comparing SmallVec against standard Vec operations using Rust's built-in benchmark framework.

### Core Architecture

**Vector Abstraction (L12-20)**: `Vector<T>` trait provides unified interface for benchmarking Vec and SmallVec implementations with methods: `new`, `push`, `pop`, `remove`, `insert`, `from_elem`, `from_elems`.

**Trait Implementations**:
- `Vec<T>` implementation (L22-50): Standard Vec wrapper with capacity pre-allocation
- `SmallVec<[T; VEC_SIZE]>` implementation (L52-80): SmallVec wrapper using inline array storage

### Configuration Constants
- `VEC_SIZE: usize = 16` (L9): Inline capacity for SmallVec, also used for "small" benchmark variants
- `SPILLED_SIZE: usize = 100` (L10): Size that exceeds inline capacity, forcing heap allocation

### Benchmark Generation System

**Macro Infrastructure (L82-91)**: `make_benches!` generates benchmark functions by combining generic test implementations with specific vector types.

**Benchmark Sets**:
- SmallVec benchmarks (L93-115): 28 benchmark functions testing various operations
- Vec benchmarks (L117-139): Equivalent set for standard Vec comparison

### Generic Benchmark Implementations

**Core Operations**:
- `gen_push<V>` (L141-154): Sequential push operations with inlined prevention
- `gen_insert_push<V>` (L156-169): Insert at incrementing positions during growth
- `gen_insert<V>` (L171-187): Insert at position 0 to maximize shift operations
- `gen_remove<V>` (L189-202): Remove from position 0 repeatedly
- `gen_extend<V>` (L204-210): Extend from range iterator
- `gen_from_iter<V>` (L212-218): Create from pre-built Vec via `From` trait
- `gen_from_slice<V>` (L220-226): Create using custom `from_elems` method
- `gen_extend_from_slice<V>` (L228-235): Extend using `extend_from_slice`
- `gen_pushpop<V>` (L237-251): Push/pop pairs to test stack-like usage
- `gen_from_elem<V>` (L253-258): Create with repeated element

**SmallVec-Specific Benchmarks**:
- `bench_insert_many` (L261-277): Tests `insert_many` method with iterator
- `bench_insert_from_slice` (L280-288): Tests `insert_from_slice` method
- `bench_macro_from_list` (L291-300): SmallVec creation via `smallvec!` macro
- `bench_macro_from_list_vec` (L303-312): Equivalent Vec creation for comparison

### Key Design Patterns

**Inline Prevention**: All benchmark functions use `#[inline(never)]` helper functions to prevent compiler optimizations that would skew results.

**Size Variants**: Each operation is tested with both small (16 elements) and spilled (100 elements) sizes to measure performance characteristics across inline/heap boundary.

**Realistic Workloads**: Insert benchmarks specifically target position 0 to simulate worst-case shifting scenarios, while push/pop tests simulate stack usage patterns.