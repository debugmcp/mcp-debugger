# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/codecs.py
@source-hash: 7b7839e53a779611
@generated: 2026-02-09T18:07:19Z

## Python Codec Registry and API Module

This module provides the core Python codec system for character encoding/decoding, implementing the complete codec infrastructure including registry functions, base classes, and stream wrappers.

### Core Components

**Codec Registry & Lookup (L15-18, L970-1036)**
- Imports all builtin codec functions from `_codecs` C extension
- Provides lookup functions: `getencoder()`, `getdecoder()`, `getincrementalencoder()`, etc.
- All lookup functions raise `LookupError` if encoding not found

**Byte Order Mark Constants (L35-78)**
- Defines BOM constants for UTF-8, UTF-16, UTF-32 encodings
- Platform-aware BOM selection based on `sys.byteorder`
- Legacy broken names (BOM32_*, BOM64_*) maintained for compatibility

### Base Codec Classes

**CodecInfo (L83-112)**
- Tuple subclass containing codec implementation details
- Stores encode/decode functions, stream readers/writers, incremental encoders/decoders
- `_is_text_encoding` attribute for Python 3.4 compatibility (private API)

**Codec (L114-178)**
- Abstract base class defining stateless encoder/decoder interface
- Methods: `encode(input, errors='strict')` and `decode(input, errors='strict')`
- Both methods return (output, consumed_length) tuples
- Must handle zero-length input gracefully

**IncrementalEncoder (L180-218)**
- Base class for stateful incremental encoding
- Maintains internal buffer for partial input
- Key methods: `encode(input, final=False)`, `reset()`, `getstate()/setstate()`

**BufferedIncrementalEncoder (L220-252)**
- Subclass handling buffered incremental encoding
- Implements buffering logic via `_buffer_encode()` template method
- Manages unconsumed input between calls

**IncrementalDecoder (L254-301)**
- Base class for stateful incremental decoding
- `getstate()` returns (buffered_bytes, additional_state) tuple
- `setstate()` restores decoder state

**BufferedIncrementalDecoder (L303-337)**
- Buffered version using bytes buffer
- Template method `_buffer_decode()` for subclass implementation

### Stream Classes

**StreamWriter (L346-418)**
- Wraps output streams with encoding
- Inherits from Codec, delegates to underlying stream
- Context manager support, prevents serialization
- Methods: `write()`, `writelines()`, `reset()`, `seek()`

**StreamReader (L422-670)**
- Wraps input streams with decoding
- Complex buffering system: bytebuffer, charbuffer, linebuffer
- Handles partial character sequences and line boundaries
- `read()` supports firstline mode for error handling
- Sophisticated `readline()` implementation with caching

**StreamReaderWriter (L674-760)**
- Combines reader and writer for bidirectional streams
- Composition pattern: contains separate Reader/Writer instances
- Delegates operations to appropriate component

**StreamRecoder (L764-879)**
- Transcodes between two different encodings
- Frontend encoding (visible to user) vs backend encoding (stream)
- Complex read path: stream → decode → encode → return

### Utility Functions

**File Operations (L883-966)**
- `open()`: Creates encoded file wrapper, forces binary mode when encoding specified
- `EncodedFile()`: Creates transcoding file wrapper with dual encodings

**Iterator Functions (L1038-1072)**
- `iterencode()`: Lazy encoding using IncrementalEncoder
- `iterdecode()`: Lazy decoding using IncrementalDecoder

**Charmap Helpers (L1076-1105)**
- `make_identity_dict()`: Creates identity mapping for character ranges
- `make_encoding_map()`: Inverts decoding map, handles conflicts with None

**Error Handlers (L1109-1123)**
- Imports standard error handlers: strict, ignore, replace, xmlcharrefreplace, backslashreplace, namereplace
- Graceful fallback to None for disabled Unicode builds

### Dependencies
- `builtins` and `sys` modules
- Critical dependency on `_codecs` C extension
- Conditional import of `encodings` package (L1127-1129) for modulefinder