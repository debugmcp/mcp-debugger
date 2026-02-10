# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/buf_reader.rs
@source-hash: a4a2bd04b325f720
@generated: 2026-02-09T18:02:50Z

## Primary Purpose
Implements an asynchronous buffered reader that adds internal buffering to any AsyncRead implementation, optimizing performance for small and repeated read operations by reducing syscalls.

## Core Components

### BufReader Struct (L27-34)
Generic buffered reader with fields:
- `inner: R` - wrapped AsyncRead implementation (pinned)
- `buf: Box<[u8]>` - internal buffer
- `pos: usize` - current read position in buffer
- `cap: usize` - number of valid bytes in buffer
- `seek_state: SeekState` - tracks seek operation state

### Constructor Methods (L37-54)
- `new(inner: R)` (L40) - creates with DEFAULT_BUF_SIZE (8KB)
- `with_capacity(capacity, inner)` (L45) - creates with custom buffer size

### Access Methods (L56-82)
- `get_ref()` (L59) - immutable reference to inner reader
- `get_mut()` (L66) - mutable reference to inner reader  
- `get_pin_mut()` (L73) - pinned mutable reference using projection
- `into_inner()` (L80) - consumes BufReader, returns inner reader
- `buffer()` (L87) - returns currently buffered data slice

### Buffer Management (L93-97)
- `discard_buffer()` - resets pos/cap to 0, invalidating buffer contents

## Trait Implementations

### AsyncRead (L100-120)
Optimized read implementation:
- Bypasses buffer for large reads (≥ buffer size) when buffer empty
- Otherwise fills buffer via `poll_fill_buf()` and copies requested amount
- Uses `consume()` to advance buffer position

### AsyncBufRead (L122-144)
Core buffered reading logic:
- `poll_fill_buf()` (L123) - fills internal buffer from underlying reader when empty
- `consume()` (L140) - advances buffer position by specified amount

### AsyncSeek (L176-259) 
Complex seeking with buffer position tracking:
- `start_seek()` (L177) - initiates seek, sets SeekState::Start
- `poll_complete()` (L187) - handles multi-phase seek completion
- Special handling for SeekFrom::Current to account for buffered data
- Always discards buffer after seeking for consistency

### AsyncWrite (L261-289)
Pass-through implementation that delegates all write operations directly to inner reader.

## Key Types

### SeekState Enum (L146-156)
State machine for async seek operations:
- `Init` - no seek in progress
- `Start(SeekFrom)` - seek initiated
- `PendingOverflowed(i64)` - handling i64 overflow case
- `Pending` - waiting for seek completion

## Architecture Patterns
- Uses `pin_project_lite` for safe pinning projection
- Implements buffer-bypass optimization for large reads
- Complex seek state machine handles edge cases like i64 overflow
- Buffer is always discarded on seek to maintain position consistency
- Write operations bypass buffer entirely (no write buffering)

## Performance Characteristics
- Optimal for small, repeated reads from the same source
- No benefit for large single reads or in-memory sources
- 8KB default buffer size balances memory usage and syscall reduction
- Large read optimization prevents unnecessary buffer copying