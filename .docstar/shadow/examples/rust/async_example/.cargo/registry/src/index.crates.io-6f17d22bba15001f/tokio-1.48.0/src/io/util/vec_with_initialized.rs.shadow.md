# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/vec_with_initialized.rs
@source-hash: f8673705967021b5
@generated: 2026-02-09T18:02:54Z

## Purpose and Responsibility
This utility module optimizes Vec<u8> operations for async I/O by tracking initialized bytes across multiple read operations. It prevents unnecessary re-initialization of memory when a vector's capacity is reused, improving performance for buffered I/O scenarios.

## Key Components

### VecU8 trait (L11)
Unsafe marker trait that abstracts over `Vec<u8>` and `&mut Vec<u8>`. Implementors must guarantee the vector reference remains stable across calls.
- Implementations: `Vec<u8>` (L13), `&mut Vec<u8>` (L14)

### VecWithInitialized<V> (L26-32)
Core wrapper struct combining a vector with initialization state tracking:
- `vec: V` - The underlying vector (Vec<u8> or &mut Vec<u8>)
- `num_initialized: usize` - Tracks initialized bytes in unused capacity (between len and capacity)  
- `starting_capacity: usize` - Original capacity for optimization decisions

**Safety invariant**: First `num_initialized` bytes of the vector's allocation must always be initialized.

#### Key Methods:
- `new()` (L46-54): Constructor initializing num_initialized to vector length
- `reserve()` (L56-65): Ensures capacity while maintaining initialization tracking
- `get_read_buf()` (L72-94): Creates ReadBuf spanning entire capacity, marking appropriate bytes as initialized
- `apply_read_buf()` (L96-115): Updates vector state from ReadBuf results, including length and initialization count
- `try_small_read_first()` (L119-124): Optimization heuristic to avoid over-allocation at EOF

### ReadBufParts (L127-133)
Transfer object capturing ReadBuf state for applying back to VecWithInitialized:
- `ptr: *const u8` - Pointer for validation
- `len: usize` - New vector length  
- `initialized: usize` - Count of initialized bytes

### Utility Functions
- `into_read_buf_parts()` (L136-142): Extracts ReadBuf state without borrowing conflicts
- `take()` (L36-39): Moves out the vector, resetting initialization tracking

## Architectural Patterns
- **RAII**: Automatic initialization state management
- **Zero-copy optimization**: Reuses initialized memory across read operations
- **Type-level safety**: Unsafe trait ensures vector stability guarantees
- **Conditional compilation**: Features gated behind "io-util" flag

## Dependencies
- `crate::io::ReadBuf` - Tokio's read buffer abstraction
- `std::mem::MaybeUninit` - For uninitialized memory handling

## Critical Invariants
1. `num_initialized` always between `vec.len()` and `vec.capacity()`
2. First `num_initialized` bytes of allocation must remain initialized
3. Vector reference stability across VecU8 trait method calls
4. ReadBufParts pointer must match original vector for validation