# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/util/async_seek_ext.rs
@source-hash: 0df8c418f95b4a46
@generated: 2026-02-09T18:02:42Z

**Primary Purpose**: Extension trait providing convenient async seeking methods for types implementing `AsyncSeek`, wrapped in a conditional compilation block for I/O utilities.

**Key Components**:

- **AsyncSeekExt trait (L33-93)**: Extension trait that adds utility methods to `AsyncSeek` types
  - Requires `AsyncSeek` bound and provides three convenience methods
  - All methods return `Seek<'_, Self>` futures and require `Self: Unpin`

- **seek() method (L66-71)**: Creates a future to seek to a specified position
  - Takes `SeekFrom` parameter to specify seek origin and offset
  - Delegates to `seek()` function from `crate::io::seek` module
  - Returns new position and object reference on success

- **rewind() method (L76-81)**: Convenience method to seek to beginning of stream
  - Internally calls `self.seek(SeekFrom::Start(0))`
  - Equivalent to seeking to absolute position 0

- **stream_position() method (L87-92)**: Gets current position in stream without moving
  - Internally calls `self.seek(SeekFrom::Current(0))`
  - Returns current offset from start without changing position

- **Blanket implementation (L96)**: Implements `AsyncSeekExt` for all types that implement `AsyncSeek`

**Dependencies**:
- `crate::io::seek::{seek, Seek}` - Core seeking functionality and future type
- `crate::io::AsyncSeek` - Base async seeking trait
- `std::io::SeekFrom` - Standard library seeking origin enum

**Architectural Patterns**:
- Extension trait pattern to add methods to existing types
- Conditional compilation using `cfg_io_util!` macro
- Future-based async API design with lifetime-parameterized return types
- Blanket implementation for automatic trait coverage

**Key Constraints**:
- All methods require `Self: Unpin` for safe async operation
- Wrapped in conditional compilation block, only available when I/O utilities are enabled
- Methods consume `&mut self` requiring exclusive access during seeking operations