# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/codecs.py
@source-hash: 7b7839e53a779611
@generated: 2026-02-09T18:13:10Z

## Primary Purpose

Core Python codec registry and API implementation providing text encoding/decoding functionality. Serves as the central interface for character encoding operations, stream wrapping, and codec lookup mechanisms in Python's standard library.

## Key Constants & BOM Definitions (L35-79)

**Byte Order Mark Constants**: UTF-8/UTF-16/UTF-32 BOM definitions with endianness variations
- `BOM_UTF8` (L44): UTF-8 BOM bytes `b'\xef\xbb\xbf'`
- `BOM_LE/BOM_BE` (L47-50): UTF-16 little/big endian BOMs
- `BOM_UTF32_LE/BE` (L53-56): UTF-32 endian-specific BOMs
- Platform-adaptive BOM selection (L58-72) based on `sys.byteorder`
- Legacy broken names for compatibility (L74-78)

## Core Classes

### CodecInfo (L83-113)
Tuple-based codec metadata container returned by codec registry lookups. Stores encode/decode functions, stream classes, and incremental codec classes. Includes `_is_text_encoding` flag for distinguishing text vs binary codecs.

### Codec Base Class (L114-179)
Abstract base defining stateless encoder/decoder interface. Key methods:
- `encode(input, errors='strict')` (L138): Returns (output, consumed) tuple
- `decode(input, errors='strict')` (L157): Returns (output, consumed) tuple
- Documents standard error handling modes: strict, ignore, replace, surrogateescape, xmlcharrefreplace, backslashreplace, namereplace

### Incremental Encoders/Decoders (L180-338)

**IncrementalEncoder (L180-219)**: Stateful encoding with buffer management
- `encode(input, final=False)` (L197): Process input chunks
- State management via `getstate()/setstate()` (L208-218)

**BufferedIncrementalEncoder (L220-253)**: Handles incomplete input sequences
- Internal buffer for unprocessed data (L229)
- Abstract `_buffer_encode()` method for subclasses (L231-234)

**IncrementalDecoder (L254-302)**: Stateful decoding counterpart
- Returns `(buffered_input, additional_state)` tuple from `getstate()` (L285-292)

**BufferedIncrementalDecoder (L303-338)**: Handles incomplete byte sequences
- Byte buffer for partial sequences (L312)
- Abstract `_buffer_decode()` method (L314-317)

### Stream Classes

**StreamWriter (L346-419)**: Encoding wrapper for write streams
- `write(object)` (L373): Encodes and writes to underlying stream
- `writelines(list)` (L380): Batch line writing
- Context manager support (L411-415)
- Attribute delegation to underlying stream (L404-409)

**StreamReader (L422-671)**: Decoding wrapper for read streams
- Complex buffering system with char/byte/line buffers (L446-449)
- `read(size, chars, firstline)` (L454): Main reading with Unicode error handling
- `readline(size, keepends)` (L534): Line-oriented reading with proper line ending detection
- Iterator protocol support (L645-654)

**StreamReaderWriter (L674-761)**: Bidirectional stream wrapper
- Composes separate Reader/Writer instances (L701-702)
- Delegates operations to appropriate component
- Synchronized reset/seek behavior (L733-742)

**StreamRecoder (L764-880)**: Encoding translation between different codecs
- Frontend (visible) vs backend (stream) encoding separation
- Transcoding pipeline: decode input → encode for storage/transmission

## Utility Functions

### Codec Lookup Helpers (L970-1036)
- `getencoder/getdecoder(encoding)` (L970-988): Extract codec functions
- `getincrementalencoder/decoder(encoding)` (L990-1016): Get incremental codec classes
- `getreader/getwriter(encoding)` (L1018-1036): Get stream wrapper classes

### High-Level File Operations
**open(filename, mode, encoding, errors, buffering)** (L883-931): Encoded file wrapper creation. Forces binary mode when encoding specified, returns StreamReaderWriter with encoding attribute.

**EncodedFile(file, data_encoding, file_encoding, errors)** (L932-966): Creates StreamRecoder for encoding translation between data and file representations.

### Iterator-Based Processing (L1038-1072)
- `iterencode(iterator, encoding, errors)` (L1038): Lazy encoding of string sequences
- `iterdecode(iterator, encoding, errors)` (L1056): Lazy decoding of byte sequences

### Charmap Utilities (L1076-1105)
- `make_identity_dict(rng)` (L1076): Identity mapping for character ranges
- `make_encoding_map(decoding_map)` (L1086): Reverse mapping creation with conflict detection

## Dependencies & Architecture

**Core Dependencies**: `builtins`, `sys`, `_codecs` (C extension)
**Error Handling**: Integrates with registry-based error handler system (L1109-1123)
**Module Discovery**: Includes modulefinder hint for encodings package (L1127-1129)

## Critical Patterns

- **Stateless vs Stateful**: Base Codec classes are stateless; Incremental* classes maintain encoding state
- **Buffer Management**: Sophisticated buffering in stream readers for handling partial sequences and line boundaries
- **Error Propagation**: Consistent error handling parameter threading through all operations
- **Resource Management**: Context manager support across all stream wrapper classes
- **Attribute Delegation**: `__getattr__` patterns for transparent stream method forwarding