# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/utf_16.py
@source-hash: 6c36257f7b8d2144
@generated: 2026-02-09T18:11:04Z

## UTF-16 Codec Implementation

**Purpose**: Python text encoding/decoding codec for UTF-16 format with BOM (Byte Order Mark) handling and automatic endianness detection.

### Core Functions
- `encode` (L13): Direct reference to `codecs.utf_16_encode` for standard UTF-16 encoding
- `decode` (L15-16): Wrapper around `codecs.utf_16_decode` with BOM consumption enabled
- `getregentry` (L146-155): Returns codec registration info for Python's encoding system

### Key Classes

**IncrementalEncoder (L18-52)**
- Lazy encoder initialization with BOM emission on first use
- `encode` (L23-31): First call emits BOM and sets platform-specific encoder
- `getstate/setstate` (L37-51): State tracking for endianness determination
- State values: 0=natural order, 2=undetermined

**IncrementalDecoder (L53-103)**
- Inherits from `BufferedIncrementalDecoder` for partial byte handling  
- `_buffer_decode` (L58-69): Auto-detects endianness from BOM, raises error if missing
- BOM detection logic: -1=little-endian, 1=big-endian, consumed>=2 without BOM=error
- Complex state management (L75-102): Tracks both buffer state and endianness

**StreamWriter (L104-123)**
- Similar to IncrementalEncoder but for stream-based writing
- BOM written once on first encode call, then switches to appropriate endian encoder

**StreamReader (L124-143)**
- Dynamic method binding: `decode` method replaced after BOM detection
- Uses `utf_16_ex_decode` for initial BOM analysis
- Self-modifying behavior: replaces own decode method with endian-specific version

### Architecture Patterns
- **Lazy initialization**: All classes defer endianness selection until first data processed
- **State machine design**: Encoders/decoders track initialization state for proper BOM handling
- **Platform awareness**: Uses `sys.byteorder` for native endianness detection
- **Self-modification**: StreamReader dynamically rebinds its decode method for efficiency

### Dependencies
- `codecs`: Core encoding infrastructure and UTF-16 primitives
- `sys`: Platform byte order detection

### Critical Invariants
- BOM must be written/read exactly once at stream start
- Endianness determination is irreversible within a codec instance
- State restoration must preserve both buffer and endianness information