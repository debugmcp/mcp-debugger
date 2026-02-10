# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/iso2022_jp_ext.py
@source-hash: f4c9ed8f3031995f
@generated: 2026-02-09T18:10:49Z

## Python Unicode Codec for ISO-2022-JP-EXT

This module implements a complete Unicode codec for the ISO-2022-JP-EXT character encoding, providing both synchronous and streaming encoding/decoding capabilities.

### Core Components

**Codec Configuration (L10):** Retrieves the underlying codec implementation from `_codecs_iso2022.getcodec('iso2022_jp_ext')`, which serves as the foundation for all encoding operations.

**Base Codec (L12-14):** The `Codec` class provides direct encode/decode methods by delegating to the retrieved codec instance.

**Incremental Processing:**
- `IncrementalEncoder` (L16-18): Handles byte-by-byte encoding using multiple inheritance from both multibytecodec and standard codecs incremental encoder classes
- `IncrementalDecoder` (L20-22): Provides streaming decode capability with the same multiple inheritance pattern

**Stream Processing:**
- `StreamReader` (L24-25): Combines codec functionality with multibytecodec stream reading for file-like object support
- `StreamWriter` (L27-28): Provides streaming write capability with multiple inheritance from Codec, multibytecodec stream writer, and standard codecs stream writer

**Registry Integration (L30-39):** The `getregentry()` function returns a complete `CodecInfo` object that registers all codec components with Python's codec system, enabling usage via `codecs.encode()`, `codecs.decode()`, and codec lookup mechanisms.

### Dependencies
- `_codecs_iso2022`: C extension providing the actual ISO-2022-JP-EXT implementation
- `_multibytecodec`: Multibyte character handling infrastructure
- `codecs`: Python's codec registration and base class framework

### Architecture Pattern
Uses composition over inheritance by wrapping a C-based codec implementation with Python codec interface classes. All codec classes share the same underlying codec instance, ensuring consistent behavior across different usage patterns.