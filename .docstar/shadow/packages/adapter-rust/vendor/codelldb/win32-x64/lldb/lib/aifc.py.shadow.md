# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/aifc.py
@source-hash: e027e8a33567890a
@generated: 2026-02-09T18:13:01Z

Python AIFF/AIFF-C audio file parser and writer module. Provides comprehensive reading and writing capabilities for Audio Interchange File Format (AIFF) and AIFF-C compressed audio files.

## Core Module Structure

**Public API**: `open(f, mode=None)` (L947-958) - Factory function that returns appropriate reader/writer instance based on mode

**Exception Handling**: `Error` class (L147-148) - Custom exception for AIFF-related errors

**Deprecation Warning**: Module is deprecated and will be removed in Python 3.13 (L144)

## Binary Data I/O Utilities (L152-256)

Low-level binary data parsing functions for big-endian AIFF format:
- `_read_long/_read_ulong/_read_short/_read_ushort` (L152-174) - Integer parsers
- `_read_string` (L176-184) - Pascal string parser with padding
- `_read_float` (L188-203) - IEEE 80-bit extended float parser
- `_write_*` counterparts (L205-256) - Corresponding writers

## AIFF Reader Class: `Aifc_read` (L276-546)

**Purpose**: Parses and provides read access to AIFF/AIFF-C files

**Key Methods**:
- `initfp(file)` (L314-352) - Core file parsing logic, chunk iteration
- `getnchannels/getsampwidth/getframerate/getnframes` (L391-401) - Audio parameter getters
- `getcomptype/getcompname` (L403-407) - Compression info getters
- `getparams()` (L412-415) - Returns namedtuple with all audio parameters
- `readframes(nframes)` (L434-449) - Read audio data with automatic decompression
- `setpos/tell` (L428-432, L388-389) - Position management
- `getmarkers/getmark` (L417-426) - Marker access

**Internal State**:
- File format detection via FORM/AIFC/AIFF headers (L321-329)
- Chunk parsing for COMM, SSND, FVER, MARK chunks (L332-350)
- Compression support: ULAW, ALAW, ADPCM (G722), SOWT (L512-522)
- Audio conversion methods: `_alaw2lin`, `_ulaw2lin`, `_adpcm2lin`, `_sowt2lin` (L455-481)

## AIFF Writer Class: `Aifc_write` (L547-946)

**Purpose**: Creates and writes AIFF/AIFF-C files with various compression types

**Key Methods**:
- `initfp(file)` (L595-610) - Initialize writer state
- `aiff/aifc` (L624-632) - Set output format
- `setnchannels/setsampwidth/setframerate/setnframes` (L634-673) - Parameter setters
- `setcomptype(type, name)` (L678-685) - Compression configuration
- `setparams(params)` (L698-709) - Bulk parameter setting
- `writeframes/writeframesraw` (L755-759, L744-753) - Audio data writing
- `setmark/getmark/getmarkers` (L717-739) - Marker management
- `close()` (L761-780) - File finalization with header patching

**Internal Operations**:
- Header writing with proper FORM structure (L842-891)
- Compression setup: `_lin2alaw`, `_lin2ulaw`, `_lin2adpcm`, `_lin2sowt` (L786-811)
- Dynamic header patching for correct file sizes (L906-926)
- Marker chunk writing (L928-945)

## Data Structures

**`_aifc_params` namedtuple** (L263-273) - Standardized parameter container with documented fields

## File Format Support

- **AIFF**: Uncompressed audio (FORM/AIFF header)
- **AIFF-C**: Compressed audio with supported types: NONE, ULAW, ALAW, G722 (ADPCM), SOWT
- **Chunks**: FVER (version), COMM (common parameters), SSND (sound data), MARK (markers)
- **Auto-detection**: .aiff extension defaults to AIFF format (L589-590)

## Usage Patterns

Both classes support context managers (`__enter__`/`__exit__`) and automatic cleanup (`__del__` for writer). The module includes a command-line demo script (L961-984) for file inspection and conversion.