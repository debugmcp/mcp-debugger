# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/bz2_codec.py
@source-hash: 1181a2a89102a2b1
@generated: 2026-02-09T18:10:34Z

**Primary Purpose:** Python codec implementation for bz2 compression/decompression, providing a complete encoding interface that integrates with Python's codecs framework. Enables bytes-to-bytes transformation using bz2 compression.

**Key Functions:**
- `bz2_encode(input, errors='strict')` (L15-17): Compresses input bytes using bz2, returns (compressed_data, original_length)
- `bz2_decode(input, errors='strict')` (L19-21): Decompresses bz2-compressed bytes, returns (decompressed_data, compressed_length)
- `getregentry()` (L68-78): Returns CodecInfo object for codec registration with Python's encoding system

**Core Classes:**
- `Codec` (L23-27): Basic codec implementation with encode/decode methods wrapping the standalone functions
- `IncrementalEncoder` (L29-43): Stateful encoder using BZ2Compressor for streaming compression
  - Maintains compressor state across multiple encode() calls
  - `final=True` triggers flush() to complete compression stream
- `IncrementalDecoder` (L45-58): Stateful decoder using BZ2Decompressor for streaming decompression
  - Handles EOFError gracefully by returning empty string
- `StreamWriter` (L60-61): File-like compression interface, inherits from Codec + StreamWriter
- `StreamReader` (L63-64): File-like decompression interface, inherits from Codec + StreamReader

**Dependencies:**
- `codecs` module: Python's codec framework integration
- `bz2` module: Required for BZ2Compressor/BZ2Decompressor classes and compress/decompress functions

**Architecture Notes:**
- Follows standard Python codec pattern with both stateless (encode/decode functions) and stateful (Incremental classes) interfaces
- All classes enforce 'strict' error handling only via assertions
- Stream classes set `charbuffertype = bytes` indicating binary data handling
- CodecInfo marks `_is_text_encoding=False` indicating this is a binary transformation codec
- Designed for use with bytes.transform()/bytes.untransform() methods