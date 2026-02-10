# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/codecs.py
@source-hash: 7b7839e53a779611
@generated: 2026-02-09T18:09:44Z

**Primary Purpose:** Python standard library codec registry and API providing text encoding/decoding infrastructure. Core module for character encoding operations, stream wrappers, and codec management.

**Key Constants (L35-78):**
- BOM (Byte Order Mark) constants for UTF-8/16/32 in various endianness
- Platform-specific endianness detection using `sys.byteorder` (L58-72)
- Legacy BOM names for backward compatibility (L74-78)

**Core Registry Functions:**
Imports from `_codecs` C module (L15-18) providing:
- `register()`, `lookup()` - codec registration and discovery
- `encode()`, `decode()` - direct encoding/decoding functions
- Error handling functions: `register_error()`, `lookup_error()`

**Base Codec Classes:**

**CodecInfo (L83-112)** - Registry entry containing codec components
- Stores encode/decode functions, stream readers/writers, incremental codecs
- `_is_text_encoding` flag for Unicode vs binary codec classification

**Codec (L114-178)** - Abstract base defining stateless encode/decode interface
- `encode(input, errors='strict')` - returns (output, consumed) tuple
- `decode(input, errors='strict')` - returns (output, consumed) tuple
- Supports error handling: strict, ignore, replace, surrogateescape, xmlcharrefreplace, backslashreplace, namereplace

**Incremental Codec Classes:**

**IncrementalEncoder (L180-219)** - Stateful encoder for chunk-wise encoding
- Maintains internal buffer for partial input
- `encode(input, final=False)`, `reset()`, `getstate()/setstate()`

**BufferedIncrementalEncoder (L220-252)** - Buffering encoder subclass
- Manages unencoded input buffer between calls
- `_buffer_encode()` abstract method for subclass implementation

**IncrementalDecoder (L254-301)** - Stateful decoder for chunk-wise decoding
- `decode(input, final=False)` with state preservation
- `getstate()` returns (buffered_input, state_info) tuple

**BufferedIncrementalDecoder (L303-337)** - Buffering decoder subclass
- Handles incomplete byte sequences with internal buffer
- `_buffer_decode()` abstract method for subclass implementation

**Stream Classes:**

**StreamWriter (L346-418)** - File-like wrapper for encoded writing
- Wraps file streams with automatic encoding
- `write()`, `writelines()`, delegation via `__getattr__()`
- Context manager support, seek operations with reset

**StreamReader (L422-670)** - File-like wrapper for encoded reading
- Complex buffering: `bytebuffer`, `charbuffer`, `linebuffer`
- `read(size, chars, firstline)` with sophisticated line handling (L454-532)
- `readline()` with line ending detection and caching (L534-607)
- Iterator protocol support

**Composite Stream Classes:**

**StreamReaderWriter (L674-760)** - Bidirectional stream wrapper
- Combines reader/writer instances for read/write streams
- Delegates operations to appropriate component

**StreamRecoder (L764-879)** - Transcoding stream wrapper
- Performs encoding conversion between frontend/backend
- Uses separate encode/decode functions + reader/writer for transformation

**High-Level API Functions:**

**open() (L883-930)** - Enhanced file opening with encoding
- Wraps `builtins.open()` with codec-aware StreamReaderWriter
- Automatic binary mode for encoded files

**EncodedFile() (L932-966)** - Stream transcoding wrapper factory
- Creates StreamRecoder for transparent encoding translation

**Codec Lookup Helpers (L970-1036):**
- `getencoder/getdecoder()` - extract encode/decode functions
- `getincrementalencoder/getincrementaldecoder()` - get incremental codecs
- `getreader/getwriter()` - get stream wrapper classes

**Utility Functions:**

**iterencode/iterdecode() (L1038-1072)** - Iterator-based encoding/decoding
- Process sequences using incremental codecs

**Charmap Utilities (L1076-1105):**
- `make_identity_dict()` - create identity mapping
- `make_encoding_map()` - reverse decoding map for encoding

**Error Handler Setup (L1109-1123):**
- Pre-loads standard error handlers: strict, ignore, replace, xmlcharrefreplace, backslashreplace, namereplace
- Graceful fallback for disabled Unicode builds

**Dependencies:**
- `builtins`, `sys` - core Python modules
- `_codecs` - C extension providing low-level codec operations
- `encodings` package (hinted for modulefinder)

**Architectural Patterns:**
- Factory pattern for codec component creation
- Delegation pattern for stream method inheritance
- Buffering strategy for incremental processing
- Error handling strategy system with pluggable handlers