# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/shift_jis.py
@source-hash: ad4ac50ebf582943
@generated: 2026-02-09T18:10:56Z

**Purpose**: Python Unicode codec implementation for Shift JIS (Japanese character encoding), providing standard codec interface for encoding/decoding between Unicode strings and Shift JIS byte sequences.

**Core Architecture**:
- Delegates actual encoding/decoding to `_codecs_jp.getcodec('shift_jis')` (L10)
- Implements Python's codec registration pattern with multiple interface classes
- Uses multiple inheritance to combine multibyte codec capabilities with standard codec interfaces

**Key Classes**:
- `Codec` (L12-14): Basic codec class exposing encode/decode methods directly from underlying codec
- `IncrementalEncoder` (L16-18): Supports streaming/partial encoding via `mbc.MultibyteIncrementalEncoder`
- `IncrementalDecoder` (L20-22): Supports streaming/partial decoding via `mbc.MultibyteIncrementalDecoder`
- `StreamReader` (L24-25): File-like reading interface combining Codec + multibyte stream reading
- `StreamWriter` (L27-28): File-like writing interface combining Codec + multibyte stream writing

**Registry Function**:
- `getregentry()` (L30-39): Returns `codecs.CodecInfo` object for codec registration system
- Instantiates fresh Codec() objects for encode/decode functions (L33-34)
- Provides class references for incremental and stream interfaces

**Dependencies**:
- `_codecs_jp`: Platform-specific Japanese codec implementation
- `_multibytecodec`: Multibyte character handling utilities
- `codecs`: Python standard codec framework

**Usage Pattern**: This follows Python's codec registration pattern - `getregentry()` is called by codec registry to obtain all necessary codec interfaces for 'shift_jis' encoding.