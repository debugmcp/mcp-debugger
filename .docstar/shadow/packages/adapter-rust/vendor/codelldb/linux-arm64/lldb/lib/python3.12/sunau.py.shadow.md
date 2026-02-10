# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/sunau.py
@source-hash: 7e4f850f6460bcd3
@generated: 2026-02-09T18:09:21Z

## Purpose and Responsibility

Parser and handler for Sun/NeXT audio files (.snd format). Provides reading and writing capabilities for audio files with a specific binary header format containing magic word, header size, data size, encoding, sample rate, and channel information.

## Key Classes and Functions

### Constants and Format Definitions (L116-138)
- `AUDIO_FILE_MAGIC` (L116): Magic word identifier (0x2e736e64 = ".snd")
- Audio encoding constants (L117-128): Various format encodings (μ-law, linear PCM, ADPCM, A-law)
- `AUDIO_UNKNOWN_SIZE` (L131): Sentinel value for unknown data size
- `_simple_encodings` (L133): Supported encoding formats list
- `_sunau_params` (L112): Named tuple for audio parameters

### Core I/O Utilities (L143-158)
- `_read_u32(file)` (L143): Reads 32-bit big-endian unsigned integer
- `_write_u32(file, x)` (L152): Writes 32-bit big-endian unsigned integer

### Reading Class - Au_read (L160-311)
Primary class for reading Sun audio files. Key methods:
- `__init__(f)` (L162): Constructor, handles file path or file object
- `initfp(file)` (L181): Parses header, validates format, extracts metadata
- Audio parameter getters (L230-265): `getnchannels()`, `getsampwidth()`, `getframerate()`, `getnframes()`, `getcomptype()`, `getcompname()`
- `readframes(nframes)` (L273): Reads audio data, handles μ-law decompression
- Position control (L288-303): `rewind()`, `tell()`, `setpos(pos)`
- Compatibility methods (L267-271): `getmarkers()`, `getmark(id)` for aifc module compatibility

### Writing Class - Au_write (L312-521)
Primary class for writing Sun audio files. Key methods:
- `__init__(f)` (L314): Constructor with file handling
- `initfp(file)` (L334): Initializes writer state with defaults
- Parameter setters (L347-414): `setnchannels()`, `setsampwidth()`, `setframerate()`, `setnframes()`, `setcomptype()`
- `writeframesraw(data)` (L424): Writes raw audio data with μ-law compression if needed
- `writeframes(data)` (L438): Writes frames and patches header
- Private methods (L462-521): `_ensure_header_written()`, `_write_header()`, `_patchheader()`

### Public Interface (L522-533)
- `open(f, mode=None)` (L522): Factory function returning appropriate reader/writer instance

## Important Dependencies
- `collections.namedtuple` (L106): For parameter tuples
- `warnings` (L107): Deprecated module warnings and audioop deprecation handling
- `audioop` (L283, L431): μ-law/linear conversion (conditionally imported with deprecation warnings suppressed)

## Architecture and Patterns
- Factory pattern via `open()` function
- Context manager support (`__enter__`/`__exit__`)
- Lazy header writing in writer class
- Header patching mechanism for unknown data sizes
- Error handling with custom `Error` exception class (L140)

## Critical Invariants
- Magic word validation required for reading
- Header size constraints (24-100 bytes)
- Frame size calculations based on encoding and channels
- Big-endian byte order for all header fields
- Sequential writing workflow (set parameters before writing frames)