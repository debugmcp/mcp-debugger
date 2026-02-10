# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/oem.py
@source-hash: 481656d3a35f792d
@generated: 2026-02-09T18:10:56Z

## Purpose and Responsibility
Windows-specific OEM (Original Equipment Manufacturer) character encoding codec implementation for Python. This module provides a complete codec interface for the Windows OEM code page, enabling conversion between Unicode strings and OEM-encoded byte sequences used in Windows command line environments.

## Key Components

### Module Functions
- **encode** (L12): Direct alias to `codecs.oem_encode` for string-to-bytes conversion
- **decode** (L14-15): Wrapper around `codecs.oem_decode` with strict error handling and final=True parameter
- **getregentry** (L32-41): Returns `CodecInfo` object for codec registration with Python's encoding system

### Codec Classes
- **IncrementalEncoder** (L17-19): Stateful encoder for processing data in chunks, inherits from `codecs.IncrementalEncoder`
- **IncrementalDecoder** (L21-22): Buffered decoder using `oem_decode` as buffer decode function
- **StreamWriter** (L24-25): File-like object wrapper for encoding streams
- **StreamReader** (L27-28): File-like object wrapper for decoding streams

## Dependencies
- **codecs module**: Core Python codec infrastructure and Windows-specific OEM encode/decode functions
- **Platform requirement**: Windows-only due to explicit import of `oem_encode`/`oem_decode` (L4-6)

## Architecture
Follows Python's standard codec pattern with complete interface implementation including incremental and streaming variants. The module acts as a bridge between Python's encoding system and Windows OEM code page functionality.

## Critical Constraints
- **Windows-only**: Will raise ImportError on non-Windows systems due to platform-specific codec imports
- **Error handling**: Default strict mode for decode operations
- **Codec registration**: Designed for integration with Python's `encodings` module lookup mechanism