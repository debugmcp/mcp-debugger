# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_pyio.py
@source-hash: 22a2730be3230802
@generated: 2026-02-09T18:11:32Z

**Purpose:** Pure Python implementation of the `io` module, providing text and binary I/O classes as fallbacks when C implementations aren't available. Located in a LLDB Python environment for debugging Rust code.

**Key Functions:**

- `text_encoding(encoding, stacklevel=2)` (L43-67): Helper to resolve encoding parameter, defaulting to "locale" or "utf-8" based on UTF-8 mode, with optional EncodingWarning
- `open(file, mode="r", buffering=-1, ...)` (L76-280): Primary file opening function with comprehensive mode parsing, buffering logic, and stream wrapper creation
- `_open_code_with_warning(path)` (L284-298): Fallback for code file opening with deprecation warning

**Core Abstract Base Classes:**

- `IOBase` (L315-604): Root ABC for all I/O operations
  - `_unsupported(name)` (L349-352): Standard exception raiser for unsupported operations
  - Context manager support (`__enter__`/`__exit__` L494-501)
  - Iterator protocol (`__iter__`/`__next__` L566-574)
  - `readline()` (L524-564): Default implementation using peek() when available

- `RawIOBase` (L607-667): Base for raw binary I/O
  - `read(size)` delegates to `readinto()` (L621-636)
  - `readall()` (L638-647): Reads until EOF using DEFAULT_BUFFER_SIZE chunks

- `BufferedIOBase` (L670-773): Base for buffered I/O with `_readinto()` helper (L738-751)

- `TextIOBase` (L821-885): Base for text I/O with encoding/errors/newlines properties

**Concrete Stream Implementations:**

- `BytesIO` (L883-1024): In-memory binary stream using `bytearray` buffer
  - Internal position tracking with `_pos` attribute
  - `getvalue()` (L903-908) and `getbuffer()` (L910-915) for content access

- `BufferedReader` (L1026-1224): Read-buffered wrapper with internal `_read_buf`
  - Thread-safe with `_read_lock`
  - `peek(size)` (L1122-1142) for lookahead without consuming
  - Complex `_readinto()` implementation (L1163-1209) with direct buffer optimization

- `BufferedWriter` (L1226-1328): Write-buffered wrapper with `_write_buf`
  - Auto-flush when buffer exceeds `buffer_size`
  - `_flush_unlocked()` (L1288-1303) handles partial writes and BlockingIOError

- `BufferedRandom` (L1404-1475): Combined read/write buffer inheriting from both Reader and Writer
  - Coordinates read/write buffer states in `seek()`, `read()`, `write()`

- `BufferedRWPair` (L1331-1402): Separate reader/writer for bidirectional streams like sockets

**File System Integration:**

- `FileIO` (L1478-1819): Low-level file descriptor wrapper
  - Mode parsing and OS flag translation (L1525-1555)
  - Platform-specific handling (`_setmode` for Windows L13-16)
  - Comprehensive error checking and file descriptor management

**Text Processing:**

- `IncrementalNewlineDecoder` (L1888-1970): Universal newline handling
  - Tracks seen newline types in `seennl` bitmask (L1956-1958)
  - `pendingcr` state for handling split `\r\n` sequences
  - `translate` mode for newline normalization

- `TextIOWrapper` (L1973-2647): Text layer over BufferedIOBase
  - Complex position tracking with cookie-based `tell()`/`seek()` (L2326-2512)
  - Decoder/encoder management with lazy initialization
  - `_read_chunk()` (L2267-2307) handles character decoding with snapshot support
  - Line reading with universal newline support (L2552-2643)

- `StringIO` (L2650-2698): In-memory text stream using BytesIO backend

**Key Constants:**
- `DEFAULT_BUFFER_SIZE = 8192` (L27)
- `valid_seek_flags` set including SEEK_HOLE/SEEK_DATA when available (L21-24)
- Debug flags `_IOBASE_EMITS_UNRAISABLE`, `_CHECK_ERRORS` (L38-40)

**Threading:** Uses `_thread.allocate_lock` for thread safety in buffered implementations

**Error Handling:** Comprehensive validation with TypeError/ValueError for invalid parameters, UnsupportedOperation for unsupported methods, proper cleanup in exception scenarios