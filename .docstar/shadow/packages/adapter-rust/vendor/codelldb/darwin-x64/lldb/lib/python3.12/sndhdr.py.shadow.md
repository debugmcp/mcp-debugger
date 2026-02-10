# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/sndhdr.py
@source-hash: d1cb49f6545ef831
@generated: 2026-02-09T18:08:06Z

**Sound File Header Detection Module**

This is a deprecated Python module (deprecated since 3.13, L32) that provides audio file format detection by analyzing file headers. It recognizes various sound file formats that SOX can decode.

## Core Functions

**`what(filename)` (L56-59)**: Main entry point that delegates to whathdr() and returns the same result.

**`whathdr(filename)` (L62-70)**: Core detection function that:
- Opens file in binary mode
- Reads first 512 bytes as header sample
- Iterates through test functions in `tests` list
- Returns `SndHeaders` namedtuple if format recognized, None otherwise

## Data Structures

**`SndHeaders` (L41-54)**: Named tuple containing:
- `filetype`: Format string ('aifc', 'aiff', 'au', 'hcom', 'sndr', 'sndt', 'voc', 'wav', '8svx', 'sb', 'ub', 'ul')
- `framerate`: Sampling rate (0 if unknown)
- `nchannels`: Channel count (0 if unknown) 
- `nframes`: Frame count (-1 if unknown)
- `sampwidth`: Bits per sample or 'U'/'A' for μ-law/A-law

## Format Detection Functions

**`tests` list (L77)**: Registry of detection functions, populated via append() calls.

**`test_aifc(h, f)` (L79-99)**: Detects AIFC/AIFF files by checking 'FORM' signature and format identifier at bytes 8-12.

**`test_au(h, f)` (L103-133)**: Detects AU/SND files, supports both big-endian ('.snd') and little-endian variants, handles multiple encoding types.

**`test_hcom(h, f)` (L137-147)**: Detects HCOM files using 'FSSD'/'HCOM' signatures at specific byte offsets.

**`test_voc(h, f)` (L151-162)**: Detects Creative Voice Files using 'Creative Voice File\032' signature.

**`test_wav(h, f)` (L166-179)**: Detects WAV files using 'RIFF'/'WAVE'/'fmt ' signature pattern.

**`test_8svx(h, f)` (L183-189)**: Detects 8SVX files (Amiga format) using 'FORM'/'8SVX' signatures.

**`test_sndt(h, f)` (L193-199)**: Detects SNDT files using 'SOUND' signature.

**`test_sndr(h, f)` (L203-209)**: Detects SNDR files using null bytes and rate validation.

## Utility Functions

**Byte extraction utilities (L217-227)**:
- `get_long_be(b)`: Extract 32-bit big-endian integer
- `get_long_le(b)`: Extract 32-bit little-endian integer  
- `get_short_be(b)`: Extract 16-bit big-endian integer
- `get_short_le(b)`: Extract 16-bit little-endian integer

## Test Program

**`test()` (L234-247)**: Command-line interface with optional recursive directory scanning.

**`testall(list, recursive, toplevel)` (L249-268)**: Recursive file processor that applies `what()` to files/directories.

## Architecture Notes

- Uses plugin-style architecture where detection functions are registered in `tests` list
- Each detector receives header bytes and file object, returns tuple or None
- Leverages existing audio libraries (aifc, wave) for detailed parsing when possible
- Falls back to manual header parsing for formats without standard library support
- Error handling via try/catch for malformed files