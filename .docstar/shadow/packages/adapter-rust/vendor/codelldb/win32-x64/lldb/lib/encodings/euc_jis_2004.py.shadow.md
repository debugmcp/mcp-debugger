# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/euc_jis_2004.py
@source-hash: 9fa426cd9f17629f
@generated: 2026-02-09T18:10:46Z

**Primary Purpose**: Python Unicode codec implementation for EUC_JIS_2004 character encoding, providing complete encoding/decoding functionality for Japanese text processing within the LLDB debugger environment.

**Core Architecture**: 
- Wraps native C extension `_codecs_jp` for performance-critical encoding operations
- Implements standard Python codec interface through class hierarchy
- Provides both stateful streaming and incremental processing capabilities

**Key Components**:

**Native Codec Wrapper (L10)**:
- `codec = _codecs_jp.getcodec('euc_jis_2004')` - Retrieves optimized C implementation
- Serves as foundation for all codec classes

**Core Codec Classes**:
- `Codec` (L12-14) - Basic encode/decode interface, delegates to native implementation
- `IncrementalEncoder` (L16-18) - Handles chunk-wise encoding with state preservation
- `IncrementalDecoder` (L20-22) - Handles chunk-wise decoding with state preservation
- `StreamReader` (L24-25) - File-like reading interface with automatic decoding
- `StreamWriter` (L27-28) - File-like writing interface with automatic encoding

**Registration Function**:
- `getregentry()` (L30-39) - Returns `CodecInfo` object for Python codec registry integration

**Dependencies**:
- `_codecs_jp` - C extension providing core EUC_JIS_2004 implementation
- `_multibytecodec` - Framework for multibyte character encoding support
- `codecs` - Standard Python codec infrastructure

**Design Patterns**:
- Multiple inheritance used for combining codec functionality with stream/incremental capabilities
- Delegation pattern - all classes delegate actual work to shared native codec instance
- Factory pattern in `getregentry()` for codec instantiation

**Critical Constraints**:
- All codec classes share single native codec instance for consistency
- EUC_JIS_2004 specific - handles Japanese Industrial Standards JIS X 0213:2004 character set
- Designed for integration with Python's codec registry system