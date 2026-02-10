# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/sunau.py
@source-hash: 7e4f850f6460bcd3
@generated: 2026-02-09T18:10:15Z

## Purpose
Python module for reading and writing Sun/NeXT audio (.au/.snd) files with a standardized interface compatible with other audio modules like `wave` and `aifc`.

## Core Architecture

**File Format Support**
- Sun/NeXT audio files with `.snd` magic word header (L116)
- Big-endian 32-bit unsigned integer fields in header
- Supports multiple audio encodings: μ-law, A-law, linear PCM (8/16/24/32-bit)
- Header structure: magic, size, data size, encoding, sample rate, channels, info

**Main Classes**

### Au_read (L160-311)
**Purpose**: Read-only interface for Sun audio files
- `__init__(f)` (L162): Accepts filename string or file-like object
- `initfp(file)` (L181): Core header parsing and validation logic
- Audio parameter getters: `getnchannels()` (L230), `getsampwidth()` (L233), `getframerate()` (L236), `getnframes()` (L239)
- Compression info: `getcomptype()` (L246), `getcompname()` (L254)
- Data access: `readframes(nframes)` (L273), `rewind()` (L288), `setpos(pos)` (L297), `tell()` (L294)
- Compatibility methods: `getmarkers()` (L267), `getmark(id)` (L270)

### Au_write (L312-521)
**Purpose**: Write interface for creating Sun audio files
- `__init__(f)` (L314): Accepts filename string or file-like object
- Parameter setters: `setnchannels()` (L347), `setsampwidth()` (L359), `setframerate()` (L371), `setnframes()` (L381)
- Compression control: `setcomptype()` (L391), `setparams()` (L408)
- Data writing: `writeframesraw()` (L424), `writeframes()` (L438)
- Header management: `_ensure_header_written()` (L462), `_write_header()` (L472), `_patchheader()` (L514)

**Utility Functions**
- `open(f, mode=None)` (L522): Factory function returning appropriate reader/writer
- `_read_u32(file)` (L143): Read big-endian 32-bit unsigned integer
- `_write_u32(file, x)` (L152): Write big-endian 32-bit unsigned integer

**Constants and Configuration**
- Audio format constants (L116-131): Magic numbers and encoding types
- `_simple_encodings` (L133): List of supported simple encoding formats
- `_sunau_params` (L112): Named tuple for parameter grouping

## Key Design Patterns

**Context Manager Support**: Both classes implement `__enter__`/`__exit__` for safe resource management
**Lazy Header Writing**: Au_write defers header writing until first frame data is written
**Parameter Validation**: Strict validation prevents parameter changes after writing begins
**Compatibility Layer**: Provides methods matching `wave`/`aifc` module interfaces
**Automatic Cleanup**: `__del__` methods ensure file handles are closed

## Critical Constraints

- Parameters cannot be changed after writing begins (enforced in Au_write setters)
- Limited to simple encodings only; complex formats not supported
- μ-law/A-law data automatically converted using deprecated `audioop` module
- Header patching required if frame count or data size changes during writing
- File seeking capability required for random access operations

## Dependencies
- `collections.namedtuple` for parameter grouping
- `audioop` (deprecated) for μ-law/A-law conversion with warning suppression
- `warnings` module for deprecation notices