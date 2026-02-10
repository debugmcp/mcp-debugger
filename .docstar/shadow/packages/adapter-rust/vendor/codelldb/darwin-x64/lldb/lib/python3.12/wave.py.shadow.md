# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/wave.py
@source-hash: 0330428ea9e45fee
@generated: 2026-02-09T18:08:19Z

## WAVE File Parser Module

**Primary Purpose**: Standard Python library module for reading and writing WAVE audio files. Provides high-level interfaces for WAVE file manipulation with support for uncompressed PCM audio data.

### Key Classes and Functions

**Error (L82-83)**: Custom exception class for wave-specific errors. Simple Exception subclass with no additional functionality.

**_Chunk (L106-215)**: Low-level chunk parser for handling binary chunks in files. Core utility for parsing structured binary data:
- `__init__(L107-130)`: Initializes chunk reading with endianness, alignment, and header options
- `read(L167-188)`: Reads data from chunk with size validation and alignment handling
- `seek(L143-160)` and `skip(L190-214)`: Navigation methods for chunk traversal
- Handles both seekable and non-seekable file objects

**Wave_read (L217-412)**: Primary class for reading WAVE files:
- `initfp(L248-277)`: Core initialization parsing RIFF/WAVE structure, locates fmt and data chunks
- `readframes(L356-371)`: Main data reading method with automatic byte order conversion
- Audio parameter accessors: `getnchannels(L321)`, `getsampwidth(L327)`, `getframerate(L330)`, `getnframes(L324)`
- `_read_fmt_chunk(L377-411)`: Parses format chunk, supports both PCM and WAVE_FORMAT_EXTENSIBLE
- Position management: `setpos(L350)`, `tell(L318)`, `rewind(L307)`

**Wave_write (L414-640)**: Primary class for writing WAVE files:
- `initfp(L452-462)`: Initializes write state with parameter tracking
- Parameter setters: `setnchannels(L476)`, `setsampwidth(L488)`, `setframerate(L500)`
- `writeframes(L575-578)` and `writeframesraw(L562-573)`: Write audio data with/without header patching
- `_write_header(L608-627)`: Generates RIFF/WAVE header structure
- `_patchheader(L629-639)`: Updates header with final sizes after writing

**open(L642-653)**: Factory function that returns Wave_read or Wave_write instances based on mode parameter.

### Key Constants and Utilities

**Format Constants (L85-88)**: WAVE format identifiers including PCM and extensible format support with UUID for PCM subtype.

**_byteswap(L96-103)**: Utility function for byte order conversion on big-endian systems.

**_wave_params (L92-93)**: Named tuple for parameter packaging, used by `getparams()` methods.

### Architecture Notes

- Uses composition with _Chunk for low-level binary parsing
- Supports both file paths and file-like objects
- Context manager support (__enter__/__exit__)
- Automatic resource cleanup in destructors
- File format validation during initialization
- Lazy header writing for output files
- Big-endian byte order conversion when needed
- Only supports uncompressed PCM audio (compression type 'NONE')

### Critical Constraints

- Write parameters cannot be changed after data writing begins
- Format chunk must precede data chunk in input files
- Output files require all parameters set before first write
- Sample width limited to 1-4 bytes
- Only supports WAVE_FORMAT_PCM and WAVE_FORMAT_EXTENSIBLE with PCM subtype