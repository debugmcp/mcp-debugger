# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/iso2022_jp.py
@source-hash: 461a0e7f72eccb8b
@generated: 2026-02-09T18:10:48Z

## Purpose
Python Unicode codec implementation for ISO-2022-JP encoding, providing comprehensive text encoding/decoding capabilities for Japanese text using the ISO-2022-JP standard.

## Key Components

**Core Codec (L12-14)**
- `Codec` class: Basic encoder/decoder wrapper around native ISO-2022-JP codec
- Delegates encode/decode operations to underlying `_codecs_iso2022` implementation

**Incremental Processing (L16-22)**
- `IncrementalEncoder` (L16-18): Handles partial encoding with state preservation
- `IncrementalDecoder` (L20-22): Handles partial decoding with state preservation
- Both inherit from multibytecodec base classes for stateful processing

**Stream Processing (L24-28)**
- `StreamReader` (L24-25): File-like object for reading ISO-2022-JP encoded streams
- `StreamWriter` (L27-28): File-like object for writing ISO-2022-JP encoded streams
- Multiple inheritance from Codec, multibytecodec, and standard codecs classes

**Registration Function (L30-39)**
- `getregentry()`: Returns `CodecInfo` object for Python codec registry
- Provides all required codec interfaces (basic, incremental, streaming)
- Creates fresh Codec instances for encode/decode operations

## Dependencies
- `_codecs_iso2022`: Native extension providing core ISO-2022-JP codec (L7, L10)
- `_multibytecodec`: Multibyte codec base classes for stateful processing (L8)
- `codecs`: Standard Python codec framework (L7)

## Architecture Pattern
Follows Python's standard codec pattern with four interface levels: basic codec, incremental encoder/decoder, and stream reader/writer. All classes delegate actual encoding/decoding to the same underlying native codec instance, ensuring consistency across interfaces.

## Critical Details
- All codec classes share the same underlying `codec` instance (L10, L18, L22, L25, L28)
- ISO-2022-JP is a stateful encoding requiring proper sequence handling
- Stream classes combine multiple inheritance for full codec functionality