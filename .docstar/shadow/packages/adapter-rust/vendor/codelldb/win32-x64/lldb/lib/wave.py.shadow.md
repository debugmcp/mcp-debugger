# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/wave.py
@source-hash: 0330428ea9e45fee
@generated: 2026-02-09T18:14:22Z

## Purpose
Python standard library module for reading and writing WAVE (WAV) audio files. Implements RIFF chunk-based parsing with support for PCM and WAVE_FORMAT_EXTENSIBLE formats.

## Key Classes

### Error (L82-83)
Custom exception class for wave-specific errors.

### _Chunk (L106-215) 
Low-level RIFF chunk parser handling binary file structure:
- `__init__(L107-130)`: Reads chunk header (name + size), handles endianness
- `read(L167-188)`: Reads chunk data with alignment handling
- `seek(L143-160)`: Seeks within chunk boundaries
- `skip(L190-214)`: Efficiently skips remaining chunk data

### Wave_read (L217-412)
WAVE file reader with complete audio parameter access:
- `initfp(L248-277)`: Parses RIFF/WAVE structure, locates fmt/data chunks
- `_read_fmt_chunk(L377-411)`: Decodes format chunk, handles PCM/extensible formats
- `readframes(L356-371)`: Reads audio data with endianness conversion
- Audio parameter methods: `getnchannels()`, `getsampwidth()`, `getframerate()`, etc.
- Position control: `setpos(L350-354)`, `tell(L318-319)`, `rewind(L307-309)`

### Wave_write (L414-640)
WAVE file writer with lazy header generation:
- `initfp(L452-462)`: Initializes write state
- Parameter setters: `setnchannels(L476-481)`, `setsampwidth(L488-493)`, etc.
- `writeframes(L575-578)`: Writes audio data and patches header if needed
- `_write_header(L608-627)`: Generates RIFF/WAVE/fmt/data header structure
- `_patchheader(L629-639)`: Updates file size fields after writing

## Key Functions

### open(L642-653)
Factory function returning Wave_read or Wave_write based on mode parameter.

### _byteswap(L96-103) 
Utility for endianness conversion of audio sample data.

## Important Constants
- `WAVE_FORMAT_PCM = 0x0001` (L85): Standard PCM format identifier
- `WAVE_FORMAT_EXTENSIBLE = 0xFFFE` (L86): Extended format identifier
- `KSDATAFORMAT_SUBTYPE_PCM` (L88): GUID for PCM in extensible format
- `_wave_params` (L92-93): Named tuple for audio parameters

## Architecture Notes
- Uses little-endian (`<`) struct format for WAVE standard compliance
- Implements lazy header writing for output files to handle unknown frame counts
- Supports both file paths (strings) and file-like objects
- Context manager protocol implemented for proper resource cleanup
- Handles WAVE format validation and chunk ordering requirements

## Dependencies
- `struct`: Binary data packing/unpacking
- `collections.namedtuple`: Parameter tuple structure  
- `builtins`: File operations
- `sys`: Endianness detection