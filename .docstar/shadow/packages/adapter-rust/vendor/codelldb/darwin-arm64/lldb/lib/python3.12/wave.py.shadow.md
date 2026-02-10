# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/wave.py
@source-hash: 0330428ea9e45fee
@generated: 2026-02-09T18:07:34Z

## WAVE File Parser Module

**Primary Purpose**: Complete implementation of WAVE audio file format parser/writer supporting both reading and writing operations with PCM and WAVE_FORMAT_EXTENSIBLE formats.

### Core Classes

**Wave_read (L217-412)**: WAVE file reader class
- `initfp(file)` (L248-277): Initializes reader, validates RIFF/WAVE headers, parses fmt and data chunks
- `readframes(nframes)` (L356-371): Reads audio frame data with automatic byte-swapping for big-endian systems
- Audio parameter getters: `getnchannels()`, `getsampwidth()`, `getframerate()`, `getnframes()` (L321-331)
- Position control: `setpos(pos)`, `tell()`, `rewind()` (L307-354)
- Context manager support via `__enter__`/`__exit__` (L295-299)

**Wave_write (L414-640)**: WAVE file writer class  
- `initfp(file)` (L452-462): Initializes writer with default parameters
- Audio parameter setters: `setnchannels()`, `setsampwidth()`, `setframerate()` (L476-515)
- `writeframesraw(data)` (L562-573): Writes raw audio data without header patching
- `writeframes(data)` (L575-578): Writes audio data and patches header if needed
- `_write_header(initlength)` (L608-627): Generates RIFF/WAVE/fmt/data header structure
- `_patchheader()` (L629-639): Updates header with actual data sizes

**_Chunk (L106-215)**: Low-level chunk parser for RIFF format
- Handles chunk reading with alignment, endianness, and seekability detection
- `read(size)`, `seek(pos, whence)`, `skip()` methods for chunk navigation
- Automatic padding alignment for odd-sized chunks

### Key Functions & Constants

**open(f, mode=None) (L642-653)**: Factory function returning Wave_read or Wave_write instances based on mode

**_byteswap(data, width) (L96-103)**: Byte order conversion utility for multi-byte samples

**Format Constants**:
- `WAVE_FORMAT_PCM = 0x0001` (L85): Standard PCM format identifier  
- `WAVE_FORMAT_EXTENSIBLE = 0xFFFE` (L86): Extended format identifier
- `KSDATAFORMAT_SUBTYPE_PCM` (L88): UUID bytes for PCM subtype validation

### Dependencies & Architecture

**External Dependencies**: `collections.namedtuple`, `builtins`, `struct`, `sys`

**Data Structures**: 
- `_wave_params` namedtuple (L92-93): Standardized parameter container
- `_array_fmts` (L90): Format mapping for array conversion

**Error Handling**: Custom `Error` exception class (L82-83) for wave-specific errors

### Critical Implementation Details

**Format Support**: Handles standard PCM and WAVE_FORMAT_EXTENSIBLE with PCM subtype validation
**Endianness**: Little-endian chunk parsing with big-endian system byte-swapping support  
**File Management**: Automatic file handle management for string paths, proper cleanup in context managers
**Header Patching**: Dynamic header updates when actual data size differs from initial estimate
**Chunk Alignment**: Proper RIFF chunk boundary alignment handling

### Usage Pattern
Reader: `wave.open(file, 'r') -> Wave_read` → parameter queries → `readframes(n)` → `close()`
Writer: `wave.open(file, 'w') -> Wave_write` → parameter setup → `writeframes(data)` → `close()`