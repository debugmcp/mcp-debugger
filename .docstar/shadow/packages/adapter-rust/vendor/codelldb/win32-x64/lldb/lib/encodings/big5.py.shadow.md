# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/big5.py
@source-hash: 98fac6f86a20dd05
@generated: 2026-02-09T18:10:34Z

## Primary Purpose
Python Unicode codec implementation for BIG5 character encoding, providing encoding/decoding capabilities between Unicode and BIG5 (Traditional Chinese) character sets. This is a standard Python codec module that integrates with Python's `codecs` module.

## Key Components

### Core Codec (L10-14)
- **codec** (L10): Core BIG5 codec instance obtained from `_codecs_tw` module
- **Codec class** (L12-14): Basic codec wrapper implementing `encode` and `decode` methods by delegating to the native codec

### Incremental Processing Classes (L16-22)
- **IncrementalEncoder** (L16-18): Handles byte-by-byte encoding using multibyte codec infrastructure
- **IncrementalDecoder** (L20-22): Handles byte-by-byte decoding using multibyte codec infrastructure
- Both inherit from both multibyte codec classes and standard Python codec classes

### Stream Processing Classes (L24-28)
- **StreamReader** (L24-25): File-like reader for BIG5-encoded streams, combines Codec with multibyte stream reading
- **StreamWriter** (L27-28): File-like writer for BIG5-encoded streams, combines Codec with multibyte stream writing

### Registry Function (L30-39)
- **getregentry()** (L30-39): Returns `CodecInfo` object for Python codec registration system, mapping codec name 'big5' to all implementation classes

## Dependencies
- `_codecs_tw`: Native Taiwan codecs module providing core BIG5 implementation
- `_multibytecodec`: Multibyte codec infrastructure for incremental and stream processing
- `codecs`: Standard Python codec framework

## Architecture Pattern
Follows Python's standard codec pattern: thin wrapper classes around native codec implementation, providing multiple access patterns (basic, incremental, streaming) for different use cases. All classes delegate core functionality to the native `codec` instance while adding appropriate interface compliance.