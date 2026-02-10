# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/wave.py
@source-hash: 0330428ea9e45fee
@generated: 2026-02-09T18:10:16Z

## Primary Purpose
WAVE audio file parser and writer module - provides classes for reading and writing uncompressed WAVE (.wav) audio files with RIFF format support.

## Key Classes and Functions

### Wave_read (L217-412)
Primary class for reading WAVE files. Implements standard audio file interface:
- `__init__(f)` (L279): Constructor accepting filename string or file-like object
- `initfp(file)` (L248): Initializes from file pointer, validates RIFF/WAVE headers
- `readframes(nframes)` (L356): Reads audio frame data with automatic byte order conversion
- `getparams()` (L339): Returns namedtuple with all audio parameters
- Audio parameter getters: `getnchannels()`, `getsampwidth()`, `getframerate()`, `getnframes()` (L321-331)
- Navigation: `setpos(pos)`, `tell()`, `rewind()` (L350-309)

### Wave_write (L414-640)
Primary class for writing WAVE files:
- `__init__(f)` (L440): Constructor with file management
- Parameter setters: `setnchannels()`, `setsampwidth()`, `setframerate()` (L476-505)
- `writeframes(data)` (L575): Writes audio data with header patching
- `writeframesraw(data)` (L562): Writes raw audio data without header updates
- `_write_header(initlength)` (L608): Generates RIFF/WAVE header structure
- `_patchheader()` (L629): Updates header with final file size information

### _Chunk (L106-215)
Low-level chunk parser for RIFF format:
- Handles chunk reading with alignment and endianness
- `read(size)`, `seek(pos)`, `skip()` methods for chunk navigation
- Supports both seekable and non-seekable files

### Utility Functions
- `open(f, mode=None)` (L642): Factory function returning Wave_read or Wave_write based on mode
- `_byteswap(data, width)` (L96): Byte order conversion for big-endian systems

## Key Dependencies
- `struct`: Binary data packing/unpacking for WAVE format headers
- `collections.namedtuple`: For `_wave_params` return type (L92)
- `builtins`: File I/O operations

## Important Constants
- `WAVE_FORMAT_PCM = 0x0001` (L85): Standard PCM format identifier
- `WAVE_FORMAT_EXTENSIBLE = 0xFFFE` (L86): Extended format identifier  
- `KSDATAFORMAT_SUBTYPE_PCM` (L88): UUID for extended PCM subtype validation

## Critical Architectural Details
- Supports both standard PCM and WAVE_FORMAT_EXTENSIBLE formats
- Automatic byte order handling based on `sys.byteorder`
- Context manager support (`__enter__`/`__exit__`) for both read/write classes
- Lazy header writing in Wave_write - headers written on first data write
- File ownership tracking (`_i_opened_the_file`) for automatic cleanup
- Frame-based positioning abstraction over byte-level file operations

## Format Constraints
- Only supports uncompressed audio (`comptype='NONE'`)
- Sample width limited to 1-4 bytes (L491)
- Requires RIFF container format with WAVE type identifier
- Data chunk must follow fmt chunk in file structure