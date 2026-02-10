# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/encodings/euc_jis_2004.py
@source-hash: 9fa426cd9f17629f
@generated: 2026-02-09T18:06:09Z

## Purpose
Python Unicode codec implementation for EUC-JIS-2004 encoding, providing standard Python codec interface for Japanese text encoding/decoding using the Extended Unix Code variant that supports JIS X 0213:2004 character set.

## Architecture
Built on top of Python's multibyte codec framework, delegating actual encoding/decoding to C extension `_codecs_jp` while providing complete codec interface through class hierarchy.

## Key Components

### Core Codec Object (L10)
- `codec`: Retrieved from `_codecs_jp.getcodec('euc_jis_2004')` - C extension providing actual encode/decode functionality

### Codec Classes
- `Codec` (L12-14): Basic codec class exposing encode/decode methods directly from C extension
- `IncrementalEncoder` (L16-18): Supports incremental encoding via `mbc.MultibyteIncrementalEncoder` mixin
- `IncrementalDecoder` (L20-22): Supports incremental decoding via `mbc.MultibyteIncrementalDecoder` mixin  
- `StreamReader` (L24-25): File-like reading interface combining Codec + multibyte stream reader
- `StreamWriter` (L27-28): File-like writing interface combining Codec + multibyte stream writer

### Registry Function
- `getregentry()` (L30-39): Returns `codecs.CodecInfo` object for codec registration, providing all interface classes

## Dependencies
- `_codecs_jp`: C extension module containing actual EUC-JIS-2004 implementation
- `_multibytecodec` (mbc): Multibyte codec framework providing incremental and stream interfaces
- `codecs`: Standard library codec framework

## Usage Pattern
This module follows Python's standard codec registration pattern - `getregentry()` provides complete codec information for registration with Python's codec registry, enabling `'euc_jis_2004'.encode()` and related operations.

## Design Notes
All codec classes share the same underlying C codec object, ensuring consistent behavior across different interface types (basic, incremental, stream-based).