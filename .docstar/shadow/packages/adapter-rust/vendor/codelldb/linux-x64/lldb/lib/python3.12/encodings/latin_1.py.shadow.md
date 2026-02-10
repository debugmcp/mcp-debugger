# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/encodings/latin_1.py
@source-hash: b75503e532a27c63
@generated: 2026-02-09T18:06:07Z

## Primary Purpose

This file implements the Latin-1 (ISO 8859-1) character encoding codec for Python's encoding system. It provides complete codec functionality including basic encode/decode operations, incremental processing, and streaming capabilities.

## Key Components

**Core Codec Classes:**
- `Codec` (L13-18): Base codec class that binds to C-level `codecs.latin_1_encode` and `codecs.latin_1_decode` functions for performance
- `IncrementalEncoder` (L20-22): Handles incremental encoding with error handling via `self.errors`
- `IncrementalDecoder` (L24-26): Handles incremental decoding with error handling via `self.errors`

**Streaming Classes:**
- `StreamWriter` (L28-29): Combines `Codec` and `codecs.StreamWriter` for stream-based encoding
- `StreamReader` (L31-32): Combines `Codec` and `codecs.StreamReader` for stream-based decoding
- `StreamConverter` (L34-37): Bidirectional stream converter with swapped encode/decode operations

**Registration Function:**
- `getregentry()` (L41-50): Returns `CodecInfo` object registered as 'iso8859-1' with all codec components

## Dependencies

- `codecs` module: Provides base classes and C-level Latin-1 functions
- Part of Python's standard encoding system registration mechanism

## Architecture Notes

- Uses C-function binding pattern (L15-16) for optimal performance on base codec operations
- All incremental operations return only the converted string `[0]` from codec tuples
- StreamConverter intentionally swaps encode/decode for bidirectional conversion
- Follows standard Python codec registration pattern via `getregentry()`

## Critical Constraints

- Latin-1 encoding maps directly to Unicode code points 0-255
- Error handling delegated to `self.errors` attribute in incremental classes
- Registration name 'iso8859-1' must match encoding system expectations