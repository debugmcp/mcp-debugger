# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/sunau.py
@source-hash: 7e4f850f6460bcd3
@generated: 2026-02-09T18:13:22Z

## Purpose
Python module for parsing and writing Sun/NeXT audio files (.au/.snd format). Provides read/write interfaces with standard audio file methods for compatibility with other audio libraries.

## Key Classes & Functions

### Au_read (L160-311)
Audio file reader class for Sun/NeXT format files.
- `__init__(f)` (L162): Accepts filename or file-like object
- `initfp(file)` (L181): Parses header, validates magic number (0x2e736e64), extracts audio parameters
- Audio parameter getters: `getnchannels()` (L230), `getsampwidth()` (L233), `getframerate()` (L236), `getnframes()` (L239)
- Compression methods: `getcomptype()` (L246), `getcompname()` (L254) - supports ULAW, ALAW, NONE
- `readframes(nframes)` (L273): Reads audio data, handles μ-law decompression via audioop
- Position control: `rewind()` (L288), `setpos(pos)` (L297), `tell()` (L294)
- `getparams()` (L262): Returns namedtuple with all audio parameters

### Au_write (L312-521)
Audio file writer class for creating Sun/NeXT format files.
- `__init__(f)` (L314): Accepts filename or file-like object for writing
- Parameter setters: `setnchannels(n)` (L347), `setsampwidth(n)` (L359), `setframerate(n)` (L371), `setnframes(n)` (L381)
- `setcomptype(type, name)` (L391): Sets compression (ULAW or NONE)
- `writeframesraw(data)` (L424): Writes raw audio data, handles μ-law compression
- `writeframes(data)` (L438): Writes data and patches header if needed
- `_write_header()` (L472): Creates Sun audio header with proper encoding constants
- `_patchheader()` (L514): Updates header with final data size

### Utility Functions
- `open(f, mode=None)` (L522): Factory function returning Au_read or Au_write based on mode
- `_read_u32(file)` (L143): Reads big-endian 32-bit unsigned integer
- `_write_u32(file, x)` (L152): Writes big-endian 32-bit unsigned integer

## Constants & Data Structures
- Audio encoding constants (L116-128): Various linear PCM formats and compression types
- `AUDIO_FILE_MAGIC = 0x2e736e64` (L116): Magic number for Sun audio files (".snd")
- `_sunau_params` namedtuple (L112): Parameter container for audio properties
- `_simple_encodings` list (L133): Supported encoding formats

## Dependencies
- `collections.namedtuple`: For parameter structures
- `audioop`: μ-law/A-law compression (deprecated, with warnings suppressed)
- `warnings`: Module deprecation handling

## File Format
Sun/NeXT audio format with big-endian header containing:
- Magic word ('.snd')
- Header size, data size, encoding, sample rate, channel count, info field
- Supports various PCM formats and μ-law/A-law compression

## Architectural Notes
- Both classes support context manager protocol (`__enter__`/`__exit__`)
- Automatic file closure in destructors
- Error handling via custom `Error` exception class (L140)
- Lazy header writing in Au_write until first frame write
- Position tracking independent of actual file position for compatibility