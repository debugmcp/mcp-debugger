# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/read_to_end.rs
@source-hash: df1f1e8210c8fc67
@generated: 2026-02-09T18:02:51Z

## Purpose
Implements async read-to-end functionality for reading all bytes from an `AsyncRead` into a `Vec<u8>` buffer. Part of Tokio's IO utilities providing efficient streaming reads until EOF.

## Key Components

### ReadToEnd Future (L12-25)
Pin-projected future struct that encapsulates the read-to-end operation:
- `reader: &'a mut R` - Mutable reference to the async reader
- `buf: VecWithInitialized<&'a mut Vec<u8>>` - Specialized wrapper around target buffer
- `read: usize` - Tracks total bytes read (may be less than buf.len() if buffer wasn't empty initially)
- `_pin: PhantomPinned` - Makes future !Unpin for async trait compatibility

### Constructor Function (L27-37)
`read_to_end<R: AsyncRead + Unpin>(reader, buffer) -> ReadToEnd` - Creates the future with zero initial read count.

### Core Reading Logic (L39-55)
`read_to_end_internal()` - Main polling loop that:
- Repeatedly calls `poll_read_to_end` until EOF (0 bytes read)
- Accumulates total bytes read in `num_read`
- Returns final count on completion or error

### Adaptive Buffer Strategy (L60-130)
`poll_read_to_end()` implements sophisticated buffer management:
- **Small Read Optimization (L76-98)**: When buffer is near capacity (≥32 bytes), first attempts small 32-byte read to check for EOF, avoiding unnecessary allocation
- **Direct Read Path (L99-110)**: When buffer has space, reads directly into vector
- **Dynamic Allocation**: Reserves additional space (NUM_BYTES=32) as needed
- **Safe Buffer Handling**: Uses `ReadBuf` abstraction for memory safety with uninitialized memory

### Future Implementation (L132-143)
Implements `Future` trait by delegating to `read_to_end_internal()` with proper pin projection.

## Dependencies
- `VecWithInitialized` - Custom wrapper for efficient Vec operations with uninitialized memory
- `ReadBuf` - Tokio's safe buffer abstraction
- `pin_project_lite` - For pin projection macro

## Performance Characteristics
- Adaptive allocation strategy prevents over-allocation for small reads
- Small read optimization can be 4,500x faster for tiny data sources
- Efficiently handles both small and large data streams
- Zero-copy when possible through direct vector reads

## Critical Invariants
- Buffer length tracking must account for pre-existing data
- Pin safety maintained through PhantomPinned
- Memory safety through ReadBuf abstraction
- EOF detection through 0-byte read return