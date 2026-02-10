# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/sndhdr.py
@source-hash: d1cb49f6545ef831
@generated: 2026-02-09T18:07:24Z

## Sound File Header Recognition Module

**Primary Purpose**: Audio file format detection and metadata extraction library for Python's standard library, supporting multiple sound file formats (AIFC, AIFF, AU, HCOM, VOC, WAV, 8SVX, SNDT, SNDR).

**Deprecation Status**: Module deprecated as of Python 3.12 with removal scheduled for Python 3.13 (L32).

### Core API

**Main Functions**:
- `what(filename)` (L56-59): Primary entry point for sound file type detection
- `whathdr(filename)` (L62-71): Core header analysis function that reads 512-byte header and tests against format detectors

**Return Structure**:
- `SndHeaders` namedtuple (L41-54): Structured result containing `filetype`, `framerate`, `nchannels`, `nframes`, `sampwidth`

### Format Detection Architecture

**Test Registry**: `tests` list (L77) contains format detector functions, each following signature `(header_bytes, file_object) -> tuple | None`

**Format Detectors**:
- `test_aifc()` (L79-98): AIFC/AIFF detection using magic bytes 'FORM' + 'AIFC'/'AIFF'
- `test_au()` (L103-132): AU/SND detection with endian-aware parsing ('.snd', '\0ds.', 'dns.')
- `test_hcom()` (L137-146): HCOM format with fixed-offset magic bytes
- `test_voc()` (L151-161): Creative Voice File format
- `test_wav()` (L166-179): RIFF/WAVE format using wave module
- `test_8svx()` (L183-188): Amiga 8SVX format
- `test_sndt()` (L193-199): SOUND header format
- `test_sndr()` (L203-209): Raw sound format with rate validation

### Utility Functions

**Binary Data Extraction** (L217-227):
- `get_long_be()`, `get_long_le()`: 32-bit integer extraction
- `get_short_be()`, `get_short_le()`: 16-bit integer extraction

**Test Program** (L234-269):
- `test()` (L234-247): CLI entry point with recursive option
- `testall()` (L249-268): Recursive file/directory processor

### Key Dependencies
- `aifc`, `wave` modules for format-specific parsing
- `collections.namedtuple` for structured results
- `warnings` for deprecation notices

### Critical Behavior Notes
- Header detection reads first 512 bytes only
- Format detectors tested sequentially until match found
- Some formats return incomplete metadata (rates=0, frames=-1) when undeterminable
- Error handling varies by format (some use try/catch, others return None)
- Sample width encoding: integer bits, 'U' for μ-law, 'A' for A-law