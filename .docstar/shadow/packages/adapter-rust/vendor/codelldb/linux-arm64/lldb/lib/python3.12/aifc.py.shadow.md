# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/aifc.py
@source-hash: e027e8a33567890a
@generated: 2026-02-09T18:08:44Z

## Audio Interchange File Format (AIFF/AIFF-C) Parser

Python module for reading and writing AIFF and AIFF-C audio files. Provides a high-level interface similar to the wave module for audio file manipulation.

### Core Components

**Public Interface:**
- `open(f, mode=None)` (L947-958): Factory function that returns either `Aifc_read` or `Aifc_write` instance based on mode
- `Error` exception class (L147-148): Custom exception for AIFF-related errors

**Reader Class - `Aifc_read` (L276-546):**
Primary class for reading AIFF/AIFF-C files with comprehensive audio parameter access:

Key methods:
- `__init__(f)` (L354-364): Initialize from file path or file object
- `initfp(file)` (L314-352): Parse file structure, identify chunks (FORM, COMM, SSND, FVER, MARK)
- `readframes(nframes)` (L434-449): Read audio data with automatic decompression
- Audio parameter getters: `getnchannels()`, `getsampwidth()`, `getframerate()`, `getnframes()`, `getcomptype()`, `getcompname()` (L391-407)
- `getparams()` (L412-415): Returns namedtuple with all parameters
- Marker support: `getmarkers()`, `getmark(id)` (L417-426)
- Position control: `tell()`, `setpos(pos)`, `rewind()` (L388-432)

Internal decompression methods:
- `_alaw2lin()`, `_ulaw2lin()`, `_adpcm2lin()`, `_sowt2lin()` (L455-481): Handle various compression formats
- `_read_comm_chunk()` (L483-525): Parse COMM chunk for audio parameters
- `_readmark()` (L527-545): Parse MARK chunk for position markers

**Writer Class - `Aifc_write` (L547-946):**
Primary class for creating AIFF/AIFF-C files with parameter validation:

Key methods:
- `__init__(f)` (L579-593): Initialize, auto-detect AIFF format from .aiff extension
- `initfp(file)` (L595-610): Set up initial state
- Audio parameter setters: `setnchannels()`, `setsampwidth()`, `setframerate()`, `setnframes()`, `setcomptype()` (L634-685)
- `setparams(params)` (L698-709): Set all parameters from tuple
- `writeframes(data)`, `writeframesraw(data)` (L744-760): Write audio data with/without header patching
- `setmark(id, pos, name)` (L717-728): Add position markers
- `close()` (L761-780): Finalize file with proper header updates

Internal compression methods:
- `_lin2alaw()`, `_lin2ulaw()`, `_lin2adpcm()`, `_lin2sowt()` (L786-811): Handle compression during writing
- `_write_header()` (L842-891): Write complete file header structure
- `_patchheader()` (L906-926): Update header with final frame counts and data length

### Utility Functions

**Binary I/O Helpers (L152-256):**
- Read functions: `_read_long()`, `_read_ulong()`, `_read_short()`, `_read_ushort()`, `_read_string()`, `_read_float()` (L152-203)
- Write functions: `_write_short()`, `_write_ushort()`, `_write_long()`, `_write_ulong()`, `_write_string()`, `_write_float()` (L205-256)
- All use big-endian byte order for AIFF format compliance

### Data Structures

- `_aifc_params` namedtuple (L263-273): Standardized parameter container with documented fields
- Supported compression types: NONE, ulaw/ULAW, alaw/ALAW, G722 (ADPCM), sowt/SOWT (byte-swapped)
- Marker format: (id, position, name) tuples

### Dependencies

- `struct`: Binary data packing/unpacking
- `chunk`: IFF chunk parsing (with deprecation warning suppression)
- `audioop`: Audio format conversions (with deprecation warning suppression)
- `collections.namedtuple`: Parameter structures

### Format Support

Handles both AIFF (uncompressed) and AIFF-C (compressed) variants with automatic format detection. Supports various chunk types (FVER, MARK, COMM, SSND) and multiple compression algorithms. Provides context manager support for proper resource cleanup.