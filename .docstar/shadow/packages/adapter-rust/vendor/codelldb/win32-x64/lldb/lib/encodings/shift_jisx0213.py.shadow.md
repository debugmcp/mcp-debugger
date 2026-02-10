# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/shift_jisx0213.py
@source-hash: 2c8d0b93bb36edf3
@generated: 2026-02-09T18:10:59Z

## Python Unicode Codec for SHIFT_JISX0213

**Primary Purpose**: Implements a complete Python codec interface for the SHIFT_JISX0213 character encoding, a Japanese text encoding that extends Shift_JIS to support additional kanji characters defined in JIS X 0213.

**Core Dependencies**:
- `_codecs_jp`: Provides the underlying C implementation via `getcodec()` (L10)
- `_multibytecodec`: Supplies multibyte codec base classes for incremental and streaming operations (L8)
- `codecs`: Standard Python codec framework for registration and interfaces (L7)

**Architecture**:
The module follows Python's standard codec pattern by defining five codec classes that wrap a single underlying C codec implementation:

- **Codec (L12-14)**: Basic encode/decode interface, directly delegates to C codec methods
- **IncrementalEncoder (L16-18)**: Handles piece-by-piece encoding via multiple inheritance from multibyte and standard incremental encoders
- **IncrementalDecoder (L20-22)**: Handles piece-by-piece decoding with same inheritance pattern
- **StreamReader (L24-25)**: File-like reading interface combining Codec, multibyte stream handling, and standard stream reading
- **StreamWriter (L27-28)**: File-like writing interface with parallel inheritance structure

**Registration Function**:
- **getregentry() (L30-39)**: Returns `CodecInfo` object for codec registry, instantiating Codec() for basic operations while providing class references for incremental/streaming operations

**Key Design Patterns**:
- **Delegation Pattern**: All encoding/decoding work delegated to C implementation via shared `codec` variable (L10)
- **Multiple Inheritance**: Incremental and stream classes inherit from both multibyte-specific and standard codec base classes
- **Lazy Instantiation**: Basic codec instantiated only in `getregentry()` return value, classes store codec reference as class attribute

**Critical Invariants**:
- All codec classes must reference the same underlying C codec instance for consistency
- Multiple inheritance order ensures proper method resolution for multibyte-specific behavior