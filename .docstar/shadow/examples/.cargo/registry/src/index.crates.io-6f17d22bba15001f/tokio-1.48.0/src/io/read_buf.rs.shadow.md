# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/read_buf.rs
@source-hash: e44733e240f50e30
@generated: 2026-02-09T18:06:46Z

## ReadBuf - Safe Buffer Management for Async I/O

**Core Purpose**: Provides a safe wrapper around potentially uninitialized byte buffers for incremental reading, tracking three distinct memory regions: filled, initialized, and uninitialized.

### Key Type

**ReadBuf<'a> (L23-27)**: A "double cursor" buffer wrapper that maintains safety invariants over a `&mut [MaybeUninit<u8>]`. Tracks:
- `buf`: Raw buffer reference
- `filled`: Bytes logically filled with valid data
- `initialized`: Bytes that have been initialized at some point (≥ filled)

Memory layout: `[filled | unfilled_initialized | uninitialized]`

### Constructor Methods

- **new(L32-40)**: Creates ReadBuf from fully initialized `&mut [u8]`, marks entire buffer as initialized
- **uninit(L48-54)**: Creates ReadBuf from `&mut [MaybeUninit<u8>]`, marks everything as uninitialized

### Access Methods (Read)

- **capacity(L58-60)**: Returns total buffer length
- **filled(L64-69)**: Safe access to filled portion as `&[u8]`
- **filled_mut(L73-78)**: Mutable access to filled portion
- **initialized(L92-97)**: Access to initialized portion (includes filled)
- **initialized_mut(L103-108)**: Mutable access to initialized portion
- **remaining(L181-183)**: Unfilled capacity remaining

### Unsafe Access Methods

- **inner_mut(L125-127)**: Raw access to entire buffer as `&mut [MaybeUninit<u8>]`
- **unfilled_mut(L137-139)**: Raw access to unfilled portion
- **take(L82-86)**: Creates sub-ReadBuf from unfilled region

### Initialization & Writing

- **initialize_unfilled(L146-148)**: Zero-initializes all remaining bytes
- **initialize_unfilled_to(L158-177)**: Zero-initializes first n unfilled bytes, with bounds checking
- **assume_init(L236-241)**: Unsafe assertion that n unfilled bytes are initialized
- **put_slice(L250-274)**: Safe append operation with automatic initialization tracking

### State Management

- **clear(L189-191)**: Resets filled cursor to 0, preserves initialization
- **advance(L202-205)**: Moves filled cursor forward by n bytes
- **set_filled(L219-225)**: Directly sets filled position with bounds checking

### External Integrations

**bytes::BufMut impl (L279-302)**: Integration with bytes crate when "io-util" feature enabled
- Maps ReadBuf semantics to BufMut trait
- Provides chunk_mut for efficient bulk operations

### Utility Functions

- **slice_to_uninit_mut(L314-316)**: Unsafe cast from `&mut [u8]` to `&mut [MaybeUninit<u8>]`
- **slice_assume_init(L319-321)**: Unsafe cast from `&[MaybeUninit<u8>]` to `&[u8]`
- **slice_assume_init_mut(L324-326)**: Unsafe mutable version

### Critical Invariants

1. `filled ≤ initialized ≤ capacity`
2. Bytes in filled region are always valid data
3. Bytes in initialized region are memory-safe to read
4. Never de-initialize previously initialized bytes
5. All bounds-checked operations panic on overflow/underflow

### Architecture Notes

- Designed for async I/O patterns where buffers are incrementally filled
- Zero-copy design minimizes allocations
- Safety-first approach with clear separation of initialized/uninitialized memory
- Feature-gated integration with bytes ecosystem