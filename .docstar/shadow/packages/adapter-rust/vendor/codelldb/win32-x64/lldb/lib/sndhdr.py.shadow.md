# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/sndhdr.py
@source-hash: d1cb49f6545ef831
@generated: 2026-02-09T18:13:08Z

## Sound File Header Recognition Library

**Primary Purpose:** Provides utilities to recognize and parse sound file headers across multiple audio formats. Returns structured metadata about audio files including format type, sample rate, channels, frame count, and bit depth.

**Core Architecture:**
- **SndHeaders namedtuple (L41-54)**: Data structure containing `filetype`, `framerate`, `nchannels`, `nframes`, `sampwidth` with detailed docstrings for each field
- **what() (L56-59)**: Simple wrapper function that calls `whathdr()` and returns result
- **whathdr() (L62-70)**: Main recognition function that reads first 512 bytes of file and tests against all format parsers

**Format Detection System:**
- **tests list (L77)**: Registry of detection functions, populated by appending individual test functions
- **Detection functions (L79-210)**: Each handles a specific format:
  - `test_aifc()` (L79-100): AIFC/AIFF files using `aifc` module
  - `test_au()` (L103-134): AU/SND files with big/little endian support
  - `test_hcom()` (L137-147): HCOM format with rate calculation
  - `test_voc()` (L151-163): Creative Voice File format
  - `test_wav()` (L166-180): WAV files using `wave` module
  - `test_8svx()` (L183-190): 8SVX format (assumes mono)
  - `test_sndt()` (L193-200): SNDT format
  - `test_sndr()` (L203-210): SNDR format with rate validation

**Binary Data Utilities (L217-227):**
- `get_long_be()`, `get_long_le()`: Extract 32-bit integers (big/little endian)
- `get_short_be()`, `get_short_le()`: Extract 16-bit integers (big/little endian)

**Test Framework (L234-268):**
- `test()` (L234-247): Main program with recursive directory option
- `testall()` (L249-268): Recursive file processing with glob pattern matching

**Key Dependencies:**
- Standard library modules: `warnings`, `collections`, `aifc`, `wave`
- File I/O operations for binary header reading
- Deprecated module (removal scheduled for Python 3.13)

**Notable Patterns:**
- Plugin-style architecture where each format parser is registered in `tests` list
- Consistent return format: tuple of (filetype, rate, channels, frames, sampwidth)
- Graceful error handling with None returns for unrecognized formats
- Binary header parsing with endian-aware utilities