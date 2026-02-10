# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/gbk.py
@source-hash: eff9b8cbc9ad2ef2
@generated: 2026-02-09T18:10:47Z

**Primary Purpose**: Python Unicode codec implementation for GBK (Guojia Biaozhun Kuozhan) Chinese character encoding, providing standard Python codec interface for text encoding/decoding operations.

**Core Architecture**: 
- Uses underlying C extension `_codecs_cn` for actual encoding/decoding work (L10)
- Implements Python's standard codec interface by wrapping native codec functionality
- Follows Python codec pattern with separate classes for different operation modes

**Key Components**:

- **codec** (L10): Native GBK codec instance from `_codecs_cn.getcodec('gbk')`
- **Codec** (L12-14): Basic codec class providing encode/decode methods by delegating to native codec
- **IncrementalEncoder** (L16-18): Supports streaming encoding via multiple inheritance from `mbc.MultibyteIncrementalEncoder` and `codecs.IncrementalEncoder`
- **IncrementalDecoder** (L20-22): Supports streaming decoding with same inheritance pattern
- **StreamReader** (L24-25): File-like reading interface combining Codec, MultibyteStreamReader, and StreamReader
- **StreamWriter** (L27-28): File-like writing interface with similar multiple inheritance
- **getregentry** (L30-39): Registration function returning `CodecInfo` object for Python's codec registry

**Dependencies**:
- `_codecs_cn`: C extension providing native GBK codec implementation
- `codecs`: Python standard library codec framework
- `_multibytecodec`: Multibyte codec utilities for streaming operations

**Design Patterns**:
- **Delegation Pattern**: All encoding/decoding delegated to native `codec` instance
- **Multiple Inheritance**: Stream classes inherit from both multibyte and standard codec classes
- **Factory Pattern**: `getregentry()` creates complete codec registration object

**Integration**: This module integrates with Python's codec system, allowing GBK encoding to be used with standard `encode()/decode()` methods and file operations.