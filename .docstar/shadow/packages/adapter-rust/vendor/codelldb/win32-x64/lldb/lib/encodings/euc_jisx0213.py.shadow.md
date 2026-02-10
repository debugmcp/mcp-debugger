# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/euc_jisx0213.py
@source-hash: e28315910da20218
@generated: 2026-02-09T18:10:44Z

**Purpose**: Python Unicode codec implementation for EUC-JISX0213 character encoding, providing complete encode/decode functionality for Japanese text using the EUC-JISX0213 standard.

**Core Architecture**:
- Delegates actual encoding/decoding to native `_codecs_jp` module (L10)
- Implements Python's standard codec interface pattern with 5 codec classes
- Uses multiple inheritance to combine functionality from `codecs` and `_multibytecodec` modules

**Key Components**:

**Codec (L12-14)**: Base codec class providing direct encode/decode methods by delegating to the native codec implementation.

**IncrementalEncoder (L16-18)**: Handles incremental encoding for streaming scenarios, inheriting from both `MultibyteIncrementalEncoder` and `codecs.IncrementalEncoder`.

**IncrementalDecoder (L20-22)**: Handles incremental decoding for streaming scenarios, inheriting from both `MultibyteIncrementalDecoder` and `codecs.IncrementalDecoder`.

**StreamReader (L24-25)**: Combines base codec functionality with multibyte stream reading capabilities for file-like objects.

**StreamWriter (L27-28)**: Combines base codec functionality with multibyte stream writing capabilities for file-like objects.

**getregentry() (L30-39)**: Registry function that returns a `CodecInfo` object containing all codec components, enabling Python's codec system to register and use this encoding.

**Dependencies**:
- `_codecs_jp`: Native module providing the actual EUC-JISX0213 implementation
- `codecs`: Python's standard codec framework
- `_multibytecodec`: Multibyte codec support infrastructure

**Design Pattern**: Standard Python codec module pattern where a thin wrapper delegates to native implementation while providing all required codec interfaces (direct, incremental, and streaming).