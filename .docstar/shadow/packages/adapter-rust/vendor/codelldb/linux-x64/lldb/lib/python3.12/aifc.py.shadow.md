# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/aifc.py
@source-hash: e027e8a33567890a
@generated: 2026-02-09T18:09:36Z

## AIFF/AIFF-C Audio File Parser

This module provides classes for reading and writing AIFF (Audio Interchange File Format) and AIFF-C (compressed) audio files. It's deprecated as of Python 3.13 and part of the Python standard library's audio handling suite.

### Primary Classes

**Aifc_read (L276-546)**: Reader class for AIFF/AIFF-C files
- **Constructor** (`__init__`, L354-364): Accepts file path string or file-like object
- **File parsing** (`initfp`, L314-352): Parses FORM chunks, identifies AIFF vs AIFF-C format
- **Audio properties**: `getnchannels()` (L391), `getsampwidth()` (L397), `getframerate()` (L400), `getnframes()` (L394)
- **Compression info**: `getcomptype()` (L403), `getcompname()` (L406)
- **Frame operations**: `readframes()` (L434-449), `setpos()` (L428-432), `tell()` (L388)
- **Marker support**: `getmarkers()` (L417-420), `getmark()` (L422-426)

**Aifc_write (L547-946)**: Writer class for AIFF/AIFF-C files
- **Constructor** (`__init__`, L579-593): Handles file path strings, auto-detects .aiff extension for AIFF format
- **Format selection**: `aiff()` (L624-627), `aifc()` (L629-632)
- **Parameter setters**: `setnchannels()` (L634-639), `setsampwidth()` (L646-651), `setframerate()` (L658-663)
- **Compression**: `setcomptype()` (L678-685) - supports ulaw, alaw, G722, sowt
- **Writing operations**: `writeframes()` (L755-759), `writeframesraw()` (L744-753)
- **Header management**: `_write_header()` (L842-891), `_patchheader()` (L906-926)

### Key Utility Functions

**Binary I/O helpers** (L152-224): Big-endian struct operations
- `_read_long/_write_long`, `_read_short/_write_short`, `_read_ulong/_write_ulong`, `_read_ushort/_write_ushort`
- `_read_string/_write_string` for Pascal-style strings
- `_read_float/_write_float` for IEEE 80-bit extended floats

**Audio compression converters** (L455-481, L786-811): 
- A-law/μ-law, ADPCM, byte-swapping for different compression formats
- Uses deprecated `audioop` module with warning suppression

### Module Interface

**open() function** (L947-958): Factory function that returns appropriate reader/writer based on mode
- Supports 'r'/'rb' for reading, 'w'/'wb' for writing
- Auto-detects file mode from file object if not specified

**_aifc_params namedtuple** (L263-273): Return type for `getparams()` methods

### Architecture Notes

- Uses `chunk.Chunk` class for parsing IFF-style chunk structure
- Maintains internal state for compression, markers, and audio parameters
- Context manager support via `__enter__`/`__exit__`
- File extension-based format detection (.aiff → AIFF, others → AIFF-C)
- Deprecated module with removal planned for Python 3.13

### Dependencies

- `struct` for binary data packing/unpacking
- `chunk` module for IFF chunk parsing (with deprecation warning suppressed)
- `audioop` for audio format conversions (deprecated)
- `warnings`, `builtins` for standard library support