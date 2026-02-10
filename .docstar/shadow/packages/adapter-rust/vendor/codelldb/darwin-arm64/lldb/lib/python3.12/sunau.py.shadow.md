# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/sunau.py
@source-hash: 7e4f850f6460bcd3
@generated: 2026-02-09T18:07:33Z

## Purpose
Python module for parsing and manipulating Sun/NeXT audio files (.au/.snd format). Provides read/write capabilities for audio files with binary header parsing and frame-based audio data access.

## Key Classes

**Au_read (L160-310)** - Audio file reader class
- `__init__(self, f)` (L162): Opens file for reading, handles string paths or file objects
- `initfp(self, file)` (L181): Parses binary header, validates magic number (0x2e736e64), extracts audio parameters
- `getnchannels()`, `getsampwidth()`, `getframerate()`, `getnframes()` (L230-244): Audio parameter getters
- `getcomptype()`/`getcompname()` (L246-260): Compression type identification (ULAW/ALAW/NONE)
- `readframes(self, nframes)` (L273): Reads audio data, handles μ-law decompression via audioop
- `setpos(self, pos)`, `tell()`, `rewind()` (L288-303): Position management for seekable streams
- Context manager support via `__enter__`/`__exit__`

**Au_write (L312-520)** - Audio file writer class  
- `__init__(self, f)` (L314): Opens file for writing
- `set*()` methods (L347-414): Parameter setters for channels, sample width, frame rate, compression
- `writeframesraw(self, data)` (L424): Writes raw audio data, applies μ-law compression if needed
- `writeframes(self, data)` (L438): Writes data and patches header with correct sizes
- `_write_header()` (L472): Constructs binary header with magic number, parameters, and padding
- `_patchheader()` (L514): Updates data size field in header after writing complete

## Key Functions

**open(f, mode=None)** (L522-533) - Factory function returning Au_read or Au_write based on mode
**_read_u32(file)**, **_write_u32(file, x)** (L143-158) - Big-endian 32-bit integer I/O utilities

## Constants & Data Structures
- Audio encoding constants (L116-128): MULAW_8, LINEAR_8/16/24/32, ALAW_8, etc.
- `_sunau_params` namedtuple (L112): Parameter container for getparams() return values
- `AUDIO_FILE_MAGIC = 0x2e736e64` (L116): '.snd' magic number for file validation

## Dependencies
- `audioop` module (imported conditionally): Used for μ-law/A-law compression conversion
- `warnings` module: Handles deprecation warnings for audioop usage
- `collections.namedtuple`: For parameter tuple structure

## Architecture Notes
- File format: Fixed 24-byte header + variable info field + audio data
- Supports both file paths and file-like objects with read/write/seek methods
- Error handling via custom `Error` exception class (L140)
- Lazy header writing in Au_write - header written on first frame write
- Position tracking independent of actual file position for compatibility
- Module marked deprecated for removal in Python 3.13 (L109)