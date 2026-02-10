# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/shift_jis_2004.py
@source-hash: d21c5930f21063ea
@generated: 2026-02-09T18:10:57Z

## Primary Purpose
Python Unicode codec implementation for SHIFT_JIS_2004 encoding, providing complete text encoding/decoding capabilities through the Python codecs framework. This is a wrapper around the native `_codecs_jp` C extension module.

## Architecture & Dependencies
- **Core dependency**: `_codecs_jp.getcodec('shift_jis_2004')` (L10) - Native C codec implementation
- **Framework integration**: Uses Python's `codecs` module for standard codec interface
- **Multibyte support**: Leverages `_multibytecodec` (mbc) for incremental and streaming operations

## Key Components

### Core Codec Classes
- **`Codec` (L12-14)**: Base codec class providing `encode` and `decode` methods by delegating to the native codec
- **`IncrementalEncoder` (L16-18)**: Handles incremental encoding operations, inherits from both mbc and codecs incremental encoders
- **`IncrementalDecoder` (L20-22)**: Handles incremental decoding operations, inherits from both mbc and codecs incremental decoders

### Stream Processing Classes
- **`StreamReader` (L24-25)**: Multiple inheritance from Codec, mbc.MultibyteStreamReader, and codecs.StreamReader for reading encoded streams
- **`StreamWriter` (L27-28)**: Multiple inheritance from Codec, mbc.MultibyteStreamWriter, and codecs.StreamWriter for writing encoded streams

### Registration Function
- **`getregentry()` (L30-39)**: Returns a `CodecInfo` object that registers all codec components with the Python codecs system. Creates fresh Codec instances for the encode/decode functions.

## Design Patterns
- **Delegation Pattern**: All encoding/decoding logic delegated to native `_codecs_jp` implementation
- **Multiple Inheritance**: Stream and incremental classes combine functionality from multiple base classes
- **Factory Pattern**: `getregentry()` constructs and returns complete codec registration information

## Critical Notes
- All classes share the same `codec` instance (L10), ensuring consistent behavior
- SHIFT_JIS_2004 is a Japanese character encoding standard (JIS X 0213:2004)
- The codec supports both simple and streaming/incremental operations