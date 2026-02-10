# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/latin_1.py
@source-hash: b75503e532a27c63
@generated: 2026-02-09T18:10:53Z

## Purpose
Python codec implementation for Latin-1 (ISO 8859-1) character encoding. This file provides a complete codec interface for encoding/decoding between Unicode strings and Latin-1 byte sequences, part of Python's standard encodings module.

## Key Classes and Functions

**Codec (L13-18)**: Base codec class providing bidirectional Latin-1 encoding/decoding
- `encode` (L17): Binds to `codecs.latin_1_encode` C function
- `decode` (L18): Binds to `codecs.latin_1_decode` C function

**IncrementalEncoder (L20-22)**: Stateful encoder for streaming operations
- `encode(input, final=False)` (L21-22): Encodes input string, returns encoded bytes and length consumed

**IncrementalDecoder (L24-26)**: Stateful decoder for streaming operations  
- `decode(input, final=False)` (L25-26): Decodes input bytes, returns decoded string and bytes consumed

**StreamWriter (L28-29)**: File-like object wrapper for encoding output streams
- Inherits from both Codec and codecs.StreamWriter (empty implementation)

**StreamReader (L31-32)**: File-like object wrapper for decoding input streams
- Inherits from both Codec and codecs.StreamReader (empty implementation)

**StreamConverter (L34-37)**: Bidirectional stream converter with swapped encode/decode
- `encode` (L36): Maps to `latin_1_decode` (intentional reversal for conversion)
- `decode` (L37): Maps to `latin_1_encode` (intentional reversal for conversion)

**getregentry() (L41-50)**: Registration function for encodings module
- Returns CodecInfo object with name 'iso8859-1' and all codec components
- Entry point for Python's codec registry system

## Dependencies
- `codecs` module: Provides base classes and C-implemented Latin-1 functions

## Architecture Notes
- Uses C-level encode/decode functions for performance (`codecs.latin_1_encode/decode`)
- StreamConverter intentionally swaps encode/decode for bidirectional conversion scenarios
- All streaming classes rely on error handling via `self.errors` attribute from parent classes
- Follows Python's codec registration pattern with `getregentry()` as the module API endpoint