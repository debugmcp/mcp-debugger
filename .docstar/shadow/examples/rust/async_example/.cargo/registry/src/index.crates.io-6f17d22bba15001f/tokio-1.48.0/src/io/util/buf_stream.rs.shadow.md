# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/buf_stream.rs
@source-hash: c2087f024e12c393
@generated: 2026-02-09T18:02:48Z

## Primary Purpose

BufStream provides bidirectional buffering for async I/O streams that implement both AsyncRead and AsyncWrite. It combines BufReader and BufWriter into a single wrapper to optimize both read and write operations by reducing syscall overhead.

## Key Components

### Core Structure
- **BufStream<RW>** (L19-23): Main struct wrapping a `BufReader<BufWriter<RW>>` composition
  - Uses `pin_project!` macro for safe Pin projection
  - Generic over `RW` type that must implement `AsyncRead + AsyncWrite`

### Constructor Methods
- **new()** (L29-33): Creates BufStream with default buffer capacities
- **with_capacity()** (L39-50): Creates BufStream with custom reader/writer buffer sizes

### Access Methods
- **get_ref()** (L55-57): Returns immutable reference to underlying I/O object
- **get_mut()** (L62-64): Returns mutable reference to underlying I/O object  
- **get_pin_mut()** (L69-71): Returns pinned mutable reference for async contexts
- **into_inner()** (L76-78): Consumes BufStream, returning wrapped object (loses buffered data)

### Conversion Implementations
- **From<BufReader<BufWriter<RW>>>** (L81-85): Direct conversion from matching composition
- **From<BufWriter<BufReader<RW>>>** (L87-119): Complex conversion that restructures nested buffers by destructuring and reconstructing with inverted nesting order

### Async Trait Implementations
- **AsyncWrite** (L121-149): Delegates all write operations to inner BufReader
- **AsyncRead** (L151-159): Delegates read operations to inner BufReader
- **AsyncSeek** (L179-187): Provides seeking with buffer discarding behavior
- **AsyncBufRead** (L189-197): Exposes buffered reading interface

## Dependencies

- `crate::io::util::{BufReader, BufWriter}`: Core buffering types
- `pin_project_lite`: For safe Pin projections
- Standard async I/O traits from `crate::io`

## Architecture Patterns

- **Composition over inheritance**: Wraps existing buffer types rather than reimplementing
- **Delegation pattern**: All trait implementations forward to inner buffer chain
- **Zero-cost abstractions**: Pin projection enables efficient async operations

## Critical Constraints

- Seeking always discards internal buffers (L167-170)
- Direct access to underlying I/O object is discouraged due to buffer bypass
- Buffer inversion in `From<BufWriter<BufReader<RW>>>` requires destructuring internal fields
- SeekFrom::Current overflow edge case may require two seek operations (L174-178)

## Testing

- **assert_unpin()** (L204-206): Verifies BufStream implements Unpin trait