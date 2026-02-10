# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/xdrlib.py
@source-hash: 983c5e8e3090bdbe
@generated: 2026-02-09T18:10:17Z

## Purpose
Python implementation of Sun XDR (eXternal Data Representation) protocol per RFC 1014. Provides binary serialization/deserialization for cross-platform data exchange with big-endian byte ordering. **DEPRECATED** - scheduled for removal in Python 3.13.

## Core Classes

### Error (L17-33)
Base exception class for XDR operations. Stores error message in `msg` attribute with custom string representation methods.

### ConversionError (L35-36)
Specialized Error subclass for data conversion failures, particularly from struct.error exceptions.

### Packer (L50-132)
Serializes Python data types to XDR binary format using big-endian encoding.

**Key Methods:**
- `reset()` (L56-57): Initializes internal BytesIO buffer
- `get_buffer()` (L59-60): Returns serialized binary data
- `pack_uint/pack_int()` (L64-72): 32-bit integer serialization with struct format '>L'/'>l'
- `pack_bool()` (L74-76): Boolean as 4-byte binary (0x00000001 or 0x00000000)
- `pack_uhyper/pack_hyper()` (L78-88): 64-bit integers as two 32-bit values
- `pack_float/pack_double()` (L90-96): IEEE floating point with '>f'/'>d' formats
- `pack_string()` (L108-111): Length-prefixed strings with padding to 4-byte boundaries
- `pack_list/pack_array()` (L116-131): Variable/fixed-length collections with item callbacks

### Unpacker (L135-242)
Deserializes XDR binary data back to Python types, maintaining position cursor.

**Key Methods:**
- `reset(data)` (L141-143): Sets buffer and resets position to 0
- `get/set_position()` (L145-149): Position cursor management
- `done()` (L154-156): Validates complete buffer consumption
- `unpack_uint/unpack_int()` (L158-174): 32-bit integer extraction with EOFError checking
- `unpack_uhyper/unpack_hyper()` (L179-188): 64-bit reconstruction with signed conversion
- `unpack_string()` (L218-220): Length-prefixed string extraction with padding skip
- `unpack_list()` (L225-232): Variable-length arrays using continuation markers (0/1)

## Architecture Patterns

**Decorator Pattern:** `raise_conversion_error()` (L38-47) wraps methods to convert struct.error to ConversionError
**Padding Strategy:** All data aligned to 4-byte boundaries per XDR specification
**Alias Methods:** Multiple method names for same functionality (e.g., pack_opaque = pack_string)
**Big-Endian Enforcement:** All struct operations use '>' prefix for network byte order

## Dependencies
- `struct`: Binary data packing/unpacking
- `io.BytesIO`: In-memory binary buffer management
- `functools.wraps`: Decorator preservation
- `warnings`: Deprecation notices

## Critical Constraints
- Module deprecated since Python 3.12, removal in 3.13
- All multi-byte data must be 4-byte aligned
- 64-bit values transmitted as high/low 32-bit pairs
- String lengths must be non-negative
- Array sizes must match declared fixed lengths