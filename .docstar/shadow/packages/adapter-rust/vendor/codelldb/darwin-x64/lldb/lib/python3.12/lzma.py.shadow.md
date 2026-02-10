# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/lzma.py
@source-hash: 58fb9d2fdc8a8af7
@generated: 2026-02-09T18:08:18Z

## lzma.py - LZMA/XZ Compression Interface Module

**Primary Purpose**: High-level Python interface to the liblzma compression library, providing file-like objects and convenience functions for LZMA/XZ compression and decompression.

### Key Components

**LZMAFile Class (L38-269)**
- Core file-like wrapper for LZMA-compressed data streams
- Inherits from `_compression.BaseStream` for standard file interface
- Supports both reading and writing compressed files
- Key methods:
  - `__init__(L49-133)`: Complex initialization handling file modes, formats, and compression parameters
  - `close(L134-157)`: Proper cleanup with flush for write mode
  - `read/write/seek/tell(L193-268)`: Standard file I/O operations
- Mode tracking via constants: `_MODE_CLOSED=0`, `_MODE_READ=1`, `_MODE_WRITE=3` (L32-36)

**Convenience Functions**
- `open(L271-317)`: Factory function supporting both binary and text modes, wraps LZMAFile with TextIOWrapper for text mode
- `compress(L319-328)`: One-shot compression using LZMACompressor
- `decompress(L331-356)`: One-shot decompression with multi-stream support and error recovery

### Key Dependencies
- `_lzma` module: Provides low-level compression classes (LZMACompressor, LZMADecompressor, LZMAError)
- `_compression.BaseStream`: Base class providing common file operations
- `_compression.DecompressReader`: Stream adapter for reading compressed data
- `io.BufferedReader/TextIOWrapper`: Standard Python I/O wrappers

### Format Support
Supports multiple LZMA container formats:
- FORMAT_AUTO: Automatic detection (read mode default)
- FORMAT_XZ: XZ format (write mode default) 
- FORMAT_ALONE: Legacy LZMA format
- FORMAT_RAW: Raw compressed streams

### Architecture Patterns
- **Mode-based state management**: Uses integer constants to track file state
- **Composition over inheritance**: Wraps underlying file objects rather than subclassing
- **Lazy initialization**: Decompressor created on-demand during reads
- **Resource management**: Proper cleanup with context manager support via BaseStream
- **Error recovery**: decompress() continues processing on stream errors when possible (L344-348)

### Critical Constraints
- Binary-only interface: All data must be bytes objects
- Write operations require upfront format/filter specification
- Seeking is emulated and can be slow for compressed streams
- Text mode support only through TextIOWrapper composition