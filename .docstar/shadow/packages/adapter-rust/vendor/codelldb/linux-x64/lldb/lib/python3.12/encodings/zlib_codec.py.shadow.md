# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/encodings/zlib_codec.py
@source-hash: 6ef01e8d3a5fe1cc
@generated: 2026-02-09T18:06:08Z

## Purpose
Python codec implementation for zlib compression/decompression. Provides bytes-to-bytes encoding using zlib compression, integrated with Python's codec system. Part of Python's standard library encodings module.

## Core Functions
- `zlib_encode(input, errors='strict')` (L13-15): Compresses bytes using zlib, returns (compressed_data, input_length) tuple
- `zlib_decode(input, errors='strict')` (L17-19): Decompresses zlib-compressed bytes, returns (decompressed_data, input_length) tuple
- `getregentry()` (L67-77): Returns CodecInfo object for codec registration with Python's encoding system

## Key Classes

### Codec (L21-25)
Basic codec wrapper implementing `codecs.Codec` interface. Delegates to module-level encode/decode functions.

### IncrementalEncoder (L27-41)
Stateful encoder for streaming compression:
- Maintains `zlib.compressobj()` for incremental processing
- `encode(input, final=False)` (L33-38): Compresses chunk, flushes on final=True
- `reset()` (L40-41): Reinitializes compressor object

### IncrementalDecoder (L43-57)
Stateful decoder for streaming decompression:
- Maintains `zlib.decompressobj()` for incremental processing  
- `decode(input, final=False)` (L49-54): Decompresses chunk, flushes on final=True
- `reset()` (L56-57): Reinitializes decompressor object

### StreamWriter/StreamReader (L59-63)
Stream-based codec interfaces inheriting from Codec and respective codecs stream classes. Both set `charbuffertype = bytes` indicating binary data handling.

## Dependencies
- `codecs`: Python's codec infrastructure
- `zlib`: Compression library (required, noted as optional in comment L9)

## Constraints
- Only supports 'strict' error handling (assertions L14, 18, 29, 45)
- Operates exclusively on bytes (not text)
- Registered as non-text encoding (`_is_text_encoding=False` L76)