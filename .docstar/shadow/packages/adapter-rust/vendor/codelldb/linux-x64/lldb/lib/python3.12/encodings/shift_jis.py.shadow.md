# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/encodings/shift_jis.py
@source-hash: ad4ac50ebf582943
@generated: 2026-02-09T18:06:07Z

## Purpose
Python Unicode codec implementation for Shift JIS character encoding, providing comprehensive encoding/decoding capabilities through Python's codec framework.

## Architecture
Standard Python codec pattern using delegation to native `_codecs_jp` implementation. All classes wrap the same underlying codec instance (L10) obtained from `_codecs_jp.getcodec('shift_jis')`.

## Key Components

### Core Codec Classes
- **Codec (L12-14)**: Base codec class with direct encode/decode methods delegating to native implementation
- **IncrementalEncoder (L16-18)**: Handles incremental encoding via multiple inheritance from `mbc.MultibyteIncrementalEncoder` and `codecs.IncrementalEncoder`  
- **IncrementalDecoder (L20-22)**: Handles incremental decoding with same multiple inheritance pattern
- **StreamReader (L24-25)**: File-like reading interface combining Codec, `mbc.MultibyteStreamReader`, and `codecs.StreamReader`
- **StreamWriter (L27-28)**: File-like writing interface combining Codec, `mbc.MultibyteStreamWriter`, and `codecs.StreamWriter`

### Registration Function
- **getregentry() (L30-39)**: Returns `CodecInfo` object for codec registry, providing all required codec interfaces

## Dependencies
- `_codecs_jp`: Native Japanese codecs module providing core Shift JIS implementation
- `codecs`: Python's codec framework
- `_multibytecodec as mbc`: Multibyte codec utilities for incremental and stream operations

## Design Patterns
- **Delegation**: All codec operations delegate to single native codec instance
- **Multiple Inheritance**: Stream and incremental classes inherit from both multibyte and standard codec classes
- **Factory Pattern**: `getregentry()` constructs complete codec registration