# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/aifc.py
@source-hash: e027e8a33567890a
@generated: 2026-02-09T18:07:11Z

## Primary Purpose
Parser and writer for AIFF (Audio Interchange File Format) and AIFF-C (compressed) audio files. Provides read/write interfaces for audio metadata and sample data with support for various compression formats.

## Key Classes and Functions

### open(f, mode=None) (L947-958)
Main entry point. Returns appropriate reader/writer class based on mode:
- 'r'/'rb': returns Aifc_read instance
- 'w'/'wb': returns Aifc_write instance

### Aifc_read (L276-546)
Audio file reader class with context manager support:
- **initfp(self, file)** (L314-353): Parses AIFF/AIFC file structure, validates chunks
- **readframes(self, nframes)** (L434-449): Reads audio sample data, applies decompression
- **getparams()** (L412-415): Returns namedtuple with all audio parameters
- **Metadata accessors**: getnchannels(), getsampwidth(), getframerate(), getnframes(), getcomptype(), getcompname()
- **Positioning**: setpos(), tell(), rewind()
- **Markers**: getmarkers(), getmark()
- **Internal decompression methods**: _alaw2lin(), _ulaw2lin(), _adpcm2lin(), _sowt2lin() (L455-481)

### Aifc_write (L547-946)
Audio file writer class with context manager support:
- **initfp(self, file)** (L595-610): Initializes writer state, defaults to AIFF-C format
- **writeframes(self, data)** (L755-759): Writes audio data and patches header
- **writeframesraw(self, data)** (L744-753): Writes raw audio data without header patching
- **Parameter setters**: setnchannels(), setsampwidth(), setframerate(), setnframes(), setcomptype()
- **Format control**: aiff(), aifc() methods to switch between formats
- **Internal compression methods**: _lin2alaw(), _lin2ulaw(), _lin2adpcm(), _lin2sowt() (L786-811)

## Binary I/O Utilities
Low-level functions for reading/writing binary data in big-endian format:
- **_read_long(), _read_ulong(), _read_short(), _read_ushort()** (L152-174): Read integers
- **_read_string()** (L176-184): Read Pascal-style strings
- **_read_float()** (L188-203): Read IEEE 80-bit extended floats
- **_write_*()** equivalents (L205-256): Write counterparts

## Key Dependencies
- **struct**: Binary data packing/unpacking
- **chunk**: IFF chunk parsing (with deprecation warnings suppressed)
- **audioop**: Audio format conversions (with deprecation warnings suppressed)
- **warnings**: Module deprecation handling

## Architectural Patterns
- **IFF (Interchange File Format)**: Follows chunk-based structure with FORM/COMM/SSND chunks
- **Factory pattern**: open() function returns appropriate class instance
- **Context managers**: Both classes support with statements
- **Lazy header writing**: Headers written on first data write, patched on close
- **Format detection**: File extension (.aiff) determines default format

## Compression Support
Supported formats: NONE, ulaw/ULAW, alaw/ALAW, G722 (ADPCM), sowt/SOWT (byte-swapped)

## Critical Invariants
- COMM and SSND chunks are mandatory
- Audio parameters must be set before writing frames
- Headers require patching if actual data differs from initial estimates
- All numeric data uses big-endian byte order
- String data follows Pascal string format (length-prefixed, even-padded)