# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/unicode-ident-1.0.22/benches/xid.rs
@source-hash: 7eb058c1140a253f
@generated: 2026-02-09T18:12:38Z

## Purpose
Performance benchmarking suite for Unicode XID (eXtended IDentifier) character classification functions, comparing multiple implementation approaches across different ASCII/non-ASCII content ratios.

## Key Components

### String Generation
- `gen_string(p_nonascii: u32)` (L32-49): Generates 500K character test strings with specified percentage of non-ASCII characters using deterministic seeding
- Uses Bernoulli distribution for ASCII/non-ASCII selection and Uniform distributions for character ranges

### Benchmarking Framework  
- `bench(c: &mut Criterion, group_name: &str, string: String)` (L51-107): Core benchmarking function that tests 6 different implementations:
  - **baseline** (L54-60): Simple character iteration for overhead measurement
  - **unicode-ident** (L61-68): Primary library being benchmarked 
  - **unicode-xid** (L69-76): Alternative Unicode XID implementation
  - **ucd-trie** (L77-84): Trie-based implementation 
  - **fst** (L85-95): Finite State Transducer approach
  - **roaring** (L96-105): Roaring bitmap implementation

### Test Scenarios
- `bench0`, `bench1`, `bench10`, `bench100` (L109-123): Test functions for 0%, 1%, 10%, and 100% non-ASCII content ratios
- `criterion_group!` and `criterion_main!` (L125-126): Criterion benchmark registration

## Dependencies
- **External modules**: FST (L18), Roaring (L20), Trie (L22) implementations from test directory
- **Criterion**: Benchmarking framework with 10-second measurement windows
- **Rand**: Deterministic random string generation with SmallRng

## Architecture Patterns
- Comparative benchmarking across multiple algorithmic approaches (trie, FST, bitmap, direct lookup)
- Each benchmark performs 1M function calls (2 calls × 500K characters) for `is_xid_start`/`is_xid_continue`
- Uses `black_box()` to prevent compiler optimizations from skipping actual function calls
- Deterministic seeding ensures reproducible benchmark results

## Performance Methodology
The baseline measurement isolates UTF-8 to char conversion overhead. Net performance is calculated as: (implementation_time - baseline_time) / 1_million_calls for nanosecond-per-call metrics mentioned in project readme.