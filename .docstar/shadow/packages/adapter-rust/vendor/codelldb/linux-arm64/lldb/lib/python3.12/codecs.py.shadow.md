# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/codecs.py
@source-hash: 7b7839e53a779611
@generated: 2026-02-09T18:08:52Z

## Python Codec Registry, API and helpers

This module provides the core Python codec infrastructure for character encoding/decoding operations. It serves as the central registry and API for all text encoding transformations in Python.

### Key Dependencies
- `builtins` (L10) - For file operations
- `sys` (L11) - For byte order detection
- `_codecs` module (L16) - Core C-level codec functions, critical import failure raises SystemError

### Core Constants (L35-79)
Byte Order Mark (BOM) constants for UTF encodings:
- UTF-8 BOM: `BOM_UTF8` (L44)
- UTF-16/32 variants with endianness-specific and native endianness mappings (L47-72)
- Legacy deprecated names `BOM32_*`, `BOM64_*` (L75-78)

### Base Codec Classes

**CodecInfo** (L83-112): Tuple-based container for codec metadata
- Factory method `__new__` accepts encode/decode functions and stream classes
- `_is_text_encoding` flag for distinguishing text vs binary codecs (L92)
- Provides unified interface to codec components

**Codec** (L114-178): Abstract base class for stateless encoders/decoders
- `encode(input, errors='strict')` (L138) - Must return (output, consumed) tuple
- `decode(input, errors='strict')` (L157) - Must return (output, consumed) tuple
- Documents error handling modes: strict, ignore, replace, surrogateescape, etc.

### Incremental Codecs

**IncrementalEncoder** (L180-219): Stateful encoding with internal buffer
- `encode(input, final=False)` (L197) - Process input incrementally
- `reset()`, `getstate()`, `setstate()` methods for state management

**BufferedIncrementalEncoder** (L220-252): Subclass with input buffering
- `_buffer_encode()` (L231) - Abstract method for subclass implementation
- Manages partial input between calls automatically

**IncrementalDecoder** (L254-301): Stateful decoding counterpart
- `decode(input, final=False)` (L270)
- `getstate()` returns `(buffered_input, additional_state)` tuple (L281-293)

**BufferedIncrementalDecoder** (L303-337): Buffered decoder implementation
- `_buffer_decode()` (L314) - Abstract method for implementation

### Stream Classes

**StreamWriter** (L346-419): File-like encoding wrapper
- Wraps output stream, encodes data on write operations
- `write()` (L373), `writelines()` (L380) methods
- Context manager support and attribute delegation to underlying stream

**StreamReader** (L422-670): File-like decoding wrapper  
- Complex buffering system with `bytebuffer`, `charbuffer`, `linebuffer` (L446-449)
- `read(size=-1, chars=-1, firstline=False)` (L454) - Main reading method with sophisticated buffering
- `readline()` (L534) - Line-oriented reading with lookahead logic
- Handles incomplete byte sequences and line ending detection

**StreamReaderWriter** (L674-760): Bidirectional stream wrapper
- Combines separate reader/writer instances for full duplex operation
- Delegates operations to appropriate reader/writer components

**StreamRecoder** (L764-879): Transcoding stream wrapper
- Performs encoding transformation between different encodings
- Frontend encoding (visible to user) vs backend encoding (file storage)

### Utility Functions

**File Operations:**
- `open()` (L883-930) - Enhanced file opener with encoding support
- `EncodedFile()` (L932-966) - Creates transcoding file wrapper

**Codec Lookup Helpers** (L970-1036):
- `getencoder()`, `getdecoder()` - Function-level codec access
- `getincrementalencoder()`, `getincrementaldecoder()` - Incremental codec access  
- `getreader()`, `getwriter()` - Stream codec access

**Iterator Functions:**
- `iterencode()` (L1038-1054) - Encoding iterator using incremental encoder
- `iterdecode()` (L1056-1072) - Decoding iterator using incremental decoder

**Charmap Utilities:**
- `make_identity_dict()` (L1076-1084) - Identity mapping generator
- `make_encoding_map()` (L1086-1105) - Reverse mapping creator from decoding map

### Error Handlers (L1109-1123)
Pre-loaded standard error handlers: strict, ignore, replace, xmlcharrefreplace, backslashreplace, namereplace. Gracefully handles missing handlers in Unicode-disabled builds.

### Architectural Notes
- Extensive use of delegation pattern in stream classes
- Buffer management is critical for incremental processing
- Error handling is configurable throughout the hierarchy
- Context manager support enables proper resource cleanup
- Module uses lazy imports strategy for encodings package (L1127-1129)