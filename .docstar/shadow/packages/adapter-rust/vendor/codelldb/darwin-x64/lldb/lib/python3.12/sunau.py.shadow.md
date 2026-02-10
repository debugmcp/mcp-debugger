# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/sunau.py
@source-hash: 7e4f850f6460bcd3
@generated: 2026-02-09T18:08:17Z

Audio file parser for Sun and NeXT audio formats (.snd/.au files). This module provides read/write capabilities for uncompressed and u-law/A-law compressed audio data following the Sun audio file format specification.

## Core Classes

**Au_read (L160-310)** - Reads Sun/NeXT audio files with:
- `initfp()` (L181-225): Parses file header, validates magic number (0x2e736e64), reads audio parameters
- Audio info getters: `getnchannels()`, `getsampwidth()`, `getframerate()`, `getnframes()` (L230-244)
- `readframes(n)` (L273-286): Reads audio data, handles u-law decompression via deprecated `audioop`
- Navigation: `rewind()`, `setpos()`, `tell()` (L288-303)
- Context manager support via `__enter__`/`__exit__` (L175-179)

**Au_write (L312-520)** - Writes Sun/NeXT audio files with:
- `initfp()` (L334-345): Initializes writer state, defaults to U-law compression
- Parameter setters: `setnchannels()`, `setsampwidth()`, `setframerate()`, `setnframes()` (L347-386)
- `writeframesraw()` (L424-436): Writes raw audio data with optional u-law compression
- `writeframes()` (L438-442): Writes data and patches header if needed
- `_write_header()` (L472-512): Creates file header with proper encoding constants
- `_patchheader()` (L514-520): Updates data size in header after writing

## Key Dependencies

- `collections.namedtuple` for `_sunau_params` (L112-113)
- `warnings` module - contains deprecation notice for Python 3.13 removal (L109)
- `audioop` (imported dynamically) for u-law/linear conversion (L283-284, L431-432)

## Audio Format Support

**Encoding constants** (L116-128): Supports multiple formats including MULAW_8, LINEAR_8/16/24/32, ALAW_8
**Simple encodings list** (L133-138): Subset of supported formats for direct processing
**Magic number validation**: Files must start with 0x2e736e64 ('.snd' in ASCII)

## API Functions

**`open(f, mode=None)`** (L522-533) - Factory function returning Au_read or Au_write based on mode ('r'/'rb' vs 'w'/'wb')

## Architecture Notes

- Uses big-endian 32-bit integers for header fields via `_read_u32()`/`_write_u32()` helpers (L143-158)
- Supports both file paths (strings) and file-like objects
- Lazy header writing - header only written when first frame data is written
- Frame positioning is logical (not file byte position) for compatibility with other audio modules
- Error handling via custom `Error` exception class (L140-141)
- Automatic resource cleanup via `__del__` methods and context managers