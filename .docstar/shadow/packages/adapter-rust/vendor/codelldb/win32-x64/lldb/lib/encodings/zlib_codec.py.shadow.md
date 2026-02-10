# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/zlib_codec.py
@source-hash: 6ef01e8d3a5fe1cc
@generated: 2026-02-09T18:10:59Z

## Purpose
Python codec implementation providing zlib compression/decompression functionality for the Python encodings system. Implements the standard codec interface to enable zlib compression as a bytes-to-bytes encoding.

## Key Components

### Core Functions
- `zlib_encode(input, errors='strict')` (L13-15): Compresses bytes using zlib.compress(), returns (compressed_data, input_length) tuple
- `zlib_decode(input, errors='strict')` (L17-19): Decompresses bytes using zlib.decompress(), returns (decompressed_data, input_length) tuple

### Codec Classes
- `Codec` (L21-25): Basic codec implementation with encode/decode methods that delegate to core functions
- `IncrementalEncoder` (L27-41): Stateful encoder using zlib.compressobj() for streaming compression
  - Maintains compressor state with `compressobj` attribute (L31)
  - Supports final flush on completion (L34-36)
  - Provides reset() method to reinitialize compressor (L40-41)
- `IncrementalDecoder` (L43-57): Stateful decoder using zlib.decompressobj() for streaming decompression
  - Maintains decompressor state with `decompressobj` attribute (L47)  
  - Supports final flush on completion (L50-52)
  - Provides reset() method to reinitialize decompressor (L56-57)

### Stream Classes
- `StreamWriter` (L59-60): Codec + codecs.StreamWriter mixin for file-like writing, operates on bytes
- `StreamReader` (L62-63): Codec + codecs.StreamReader mixin for file-like reading, operates on bytes

### Registration
- `getregentry()` (L67-77): Returns CodecInfo object for codec system registration with all required components

## Dependencies
- `codecs`: Python standard library codec framework
- `zlib`: Compression library (required dependency, L9)

## Design Patterns
- Standard Python codec protocol implementation
- Error handling restricted to 'strict' mode only (assertions throughout)
- Bytes-to-bytes transformation (_is_text_encoding=False, L76)
- Stateful streaming support via incremental encoder/decoder pattern

## Critical Constraints
- Only supports 'strict' error handling mode
- Input/output must be bytes objects
- Streaming operations maintain compression state between calls