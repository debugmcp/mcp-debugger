# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/euc_kr.py
@source-hash: 633a1a5504bfad04
@generated: 2026-02-09T18:10:46Z

## Purpose
Python Unicode codec implementation for EUC_KR (Extended Unix Code - Korean) character encoding. Provides complete codec infrastructure for encoding/decoding Korean text using the EUC-KR standard.

## Architecture
Built on Python's multibyte codec framework using `_codecs_kr` C extension for performance-critical operations. Follows standard Python codec pattern with separate classes for different use cases.

## Key Components

**Core Codec (L12-14)**
- `Codec`: Basic encode/decode interface wrapping C extension methods
- Delegates actual encoding/decoding to `_codecs_kr.getcodec('euc_kr')`

**Incremental Processing (L16-22)**
- `IncrementalEncoder`: Handles partial encoding for streaming data
- `IncrementalDecoder`: Handles partial decoding for streaming data
- Both inherit from multibyte base classes for Korean text processing

**Stream Interfaces (L24-28)**
- `StreamReader`: File-like reading with EUC_KR decoding
- `StreamWriter`: File-like writing with EUC_KR encoding
- Multiple inheritance pattern combining codec, multibyte, and stream functionality

**Registration Function (L30-39)**
- `getregentry()`: Returns `CodecInfo` object for Python codec registry
- Instantiates codec classes and provides all required interfaces

## Dependencies
- `_codecs_kr`: C extension providing core EUC_KR implementation
- `_multibytecodec`: Framework for multibyte character encodings
- `codecs`: Python's codec registration and interface system

## Usage Pattern
Registered with Python's codec system, accessed via `codecs.encode()`/`codecs.decode()` or `str.encode()`/`bytes.decode()` with 'euc_kr' encoding name.