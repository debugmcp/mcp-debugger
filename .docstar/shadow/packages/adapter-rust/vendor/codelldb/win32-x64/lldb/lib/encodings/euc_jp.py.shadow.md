# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/euc_jp.py
@source-hash: b453a439787b0efa
@generated: 2026-02-09T18:10:45Z

## Purpose
Python Unicode codec implementation for EUC-JP (Extended Unix Code for Japanese) character encoding. This module provides comprehensive encoding/decoding functionality through Python's standard codec framework.

## Key Components

**Core Codec (L10, L12-14)**
- `codec` (L10): Native EUC-JP codec obtained from `_codecs_jp.getcodec('euc_jp')`
- `Codec` class (L12-14): Basic codec wrapper providing `encode` and `decode` methods

**Incremental Processing Classes**
- `IncrementalEncoder` (L16-18): Handles streaming encoding with multibyte character support
- `IncrementalDecoder` (L20-22): Handles streaming decoding with multibyte character support
Both inherit from multibyte codec base classes and standard codec interfaces

**Stream Processing Classes**
- `StreamReader` (L24-25): File-like reading interface with EUC-JP decoding
- `StreamWriter` (L27-28): File-like writing interface with EUC-JP encoding
Both use multiple inheritance combining Codec, multibyte stream handling, and standard stream interfaces

**Registry Function (L30-39)**
- `getregentry()`: Returns `CodecInfo` object for Python's codec registry
- Registers all codec components under the name 'euc_jp'

## Dependencies
- `_codecs_jp`: Native Japanese codec implementations
- `_multibytecodec`: Multibyte character handling utilities
- `codecs`: Python's standard codec framework

## Architecture Notes
- Follows Python's standard codec pattern with separate classes for different use cases
- Uses multiple inheritance to combine functionality from multibyte and standard codec base classes
- All codec classes share the same underlying native codec instance
- Designed for integration with Python's automatic codec discovery system