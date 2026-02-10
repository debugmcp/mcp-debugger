# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/xdrlib.py
@source-hash: 983c5e8e3090bdbe
@generated: 2026-02-09T18:11:27Z

**Purpose**: Python implementation of Sun XDR (eXternal Data Representation) protocol for serializing data structures in network-neutral format. Provides packing/unpacking of primitive types and collections according to RFC 1014.

**Deprecation Status**: Module deprecated via `warnings._deprecated(__name__, remove=(3, 13))` (L12), scheduled for removal in Python 3.13.

## Core Classes

### Error Hierarchy (L17-36)
- `Error(Exception)` (L17-33): Base exception with message attribute and standard string representations
- `ConversionError(Error)` (L35-36): Raised during data conversion failures

### Packer (L50-132)
**Purpose**: Serializes Python data types into XDR binary format using big-endian byte order.

**Key Methods**:
- `reset()` (L56-57): Reinitializes internal BytesIO buffer
- `get_buffer()` (L59-60): Returns packed binary data
- `pack_uint(x)` (L65-66): Packs unsigned 32-bit integer using `'>L'` format
- `pack_int(x)` (L69-70): Packs signed 32-bit integer using `'>l'` format  
- `pack_bool(x)` (L74-76): Packs boolean as 4-byte value (0x00000001 or 0x00000000)
- `pack_uhyper(x)` (L78-86): Packs 64-bit unsigned integer as two 32-bit parts
- `pack_float(x)` (L91-92): Packs IEEE 754 single precision using `'>f'`
- `pack_double(x)` (L95-96): Packs IEEE 754 double precision using `'>d'`
- `pack_fstring(n, s)` (L98-104): Packs fixed-length string with null padding to 4-byte boundary
- `pack_string(s)` (L108-111): Packs variable-length string with length prefix
- `pack_list(list, pack_item)` (L116-120): Packs list with continuation markers (1=more, 0=end)
- `pack_array(list, pack_item)` (L128-131): Packs array with length prefix

**Aliases**: Multiple method aliases for compatibility (e.g., `pack_enum = pack_int`, `pack_bytes = pack_string`)

### Unpacker (L135-242) 
**Purpose**: Deserializes XDR binary data back into Python types.

**State Management**:
- `__buf`: Input data buffer
- `__pos`: Current read position

**Key Methods**:
- `reset(data)` (L141-143): Sets new data buffer and resets position
- `get_position()` / `set_position()` (L145-149): Position access/control
- `done()` (L154-156): Validates all data consumed
- `unpack_uint()` (L158-164): Unpacks unsigned 32-bit integer, raises EOFError on insufficient data
- `unpack_int()` (L166-172): Unpacks signed 32-bit integer
- `unpack_bool()` (L176-177): Unpacks boolean from integer value
- `unpack_uhyper()` (L179-182): Reconstructs 64-bit value from two 32-bit parts
- `unpack_hyper()` (L184-188): Handles signed 64-bit with two's complement conversion
- `unpack_float()` / `unpack_double()` (L190-204): Unpacks IEEE 754 floating point
- `unpack_fstring(n)` (L206-214): Unpacks fixed-length string, handling 4-byte alignment
- `unpack_string()` (L218-220): Unpacks variable-length string using length prefix
- `unpack_list(unpack_item)` (L225-232): Unpacks list using continuation markers
- `unpack_array(unpack_item)` (L240-242): Unpacks array using length prefix

## Utility Functions

### raise_conversion_error (L38-47)
Decorator that catches `struct.error` exceptions and converts them to `ConversionError` for consistent error handling across pack methods.

## Dependencies
- `struct`: Binary data packing/unpacking
- `io.BytesIO`: In-memory binary buffer
- `functools.wraps`: Decorator preservation
- `warnings`: Deprecation notification

## Architecture Notes
- Strict big-endian byte order (`'>'` format codes)
- 4-byte alignment for strings and opaque data
- Hyper (64-bit) values handled as two 32-bit components for portability
- Comprehensive error handling with position tracking in Unpacker