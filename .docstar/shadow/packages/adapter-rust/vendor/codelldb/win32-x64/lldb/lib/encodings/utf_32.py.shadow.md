# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/utf_32.py
@source-hash: 2072eece5f6026ad
@generated: 2026-02-09T18:11:04Z

## Primary Purpose
UTF-32 codec implementation for Python's encoding system, providing byte order mark (BOM) aware encoding/decoding with automatic endianness detection.

## Key Components

### Core Functions
- `encode` (L8): Direct alias to `codecs.utf_32_encode`
- `decode` (L10-11): Wrapper around `codecs.utf_32_decode` with BOM handling enabled
- `getregentry` (L141-150): Returns `CodecInfo` object for codec registration

### IncrementalEncoder (L13-47)
Stateful encoder that writes BOM on first use, then switches to platform-appropriate endian-specific encoder.
- `encode` (L18-26): First call uses `utf_32_encode` (includes BOM), subsequent calls use endian-specific encoder
- `reset`/`getstate`/`setstate` (L28-46): State management for encoder selection
- State values: 0=endianness determined, 2=undetermined

### IncrementalDecoder (L48-98) 
Buffered decoder that auto-detects endianness from BOM or raises error if missing.
- `_buffer_decode` (L53-64): Uses `utf_32_ex_decode` to detect BOM, switches to appropriate decoder
- BOM detection: -1=little-endian, 1=big-endian, missing BOM after 4+ bytes=error
- State management (L70-97): Tracks endianness determination and natural/unnatural byte order

### StreamWriter (L99-118)
Stream-based encoder with same BOM-then-endian-specific pattern as IncrementalEncoder.
- `encode` (L108-117): First call includes BOM, subsequent calls use cached endian-specific encoder

### StreamReader (L119-138)
Stream-based decoder with dynamic method replacement for endianness detection.
- `decode` (L128-137): Uses `utf_32_ex_decode`, replaces own `decode` method with endian-specific version
- `reset` (L121-126): Removes dynamically assigned decode method

## Architecture Patterns
- **Lazy endianness determination**: All classes defer endian-specific codec selection until first use
- **BOM handling**: Encoder writes BOM once, decoder expects BOM for endianness detection
- **State preservation**: Comprehensive state management for incremental processing
- **Dynamic method replacement**: StreamReader replaces its own decode method after endianness detection

## Dependencies
- `codecs`: Core codec functionality and base classes
- `sys`: Platform byte order detection via `sys.byteorder`

## Critical Constraints
- UTF-32 streams must start with BOM for proper decoding
- Missing BOM after 4+ bytes consumed raises UnicodeError
- State serialization must preserve endianness determination status