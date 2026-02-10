# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/xdrlib.py
@source-hash: 983c5e8e3090bdbe
@generated: 2026-02-09T18:08:18Z

## Purpose
Implements a subset of Sun XDR (eXternal Data Representation) protocol for serializing/deserializing binary data. This is a deprecated Python module (removal scheduled for Python 3.13) used for cross-platform data exchange.

## Core Classes

### Error (L17-32) & ConversionError (L35-36)
- Base exception class for XDR operations with message attribute
- ConversionError inherits from Error for conversion-specific failures

### Packer (L50-132)
Binary data serialization class that writes to internal BytesIO buffer:
- `reset()` (L56-57): Reinitializes buffer
- `get_buffer()` (L59-60): Returns packed binary data
- Numeric packers: `pack_uint/pack_int` (L65-70), `pack_float/pack_double` (L91-96)
- `pack_bool` (L74-76): Encodes as 4-byte big-endian 0/1
- `pack_uhyper/pack_hyper` (L78-88): 64-bit integers as two 32-bit values
- String packers: `pack_string` (L108-111), `pack_fstring` (L98-104) with padding
- Array packers: `pack_list` (L116-120), `pack_array` (L128-131), `pack_farray` (L122-126)

### Unpacker (L135-242)
Binary data deserialization class that reads from byte buffer:
- `reset()` (L141-143): Sets new buffer and position
- `get_position/set_position` (L145-149): Buffer position management
- `done()` (L154-156): Validates complete buffer consumption
- Numeric unpackers: `unpack_uint/unpack_int` (L158-172), `unpack_float/unpack_double` (L190-204)
- `unpack_bool` (L176-177): Converts int to boolean
- `unpack_uhyper/unpack_hyper` (L179-188): 64-bit reconstruction with sign handling
- String unpackers: `unpack_string` (L218-220), `unpack_fstring` (L206-214)
- Array unpackers: `unpack_list` (L225-232), `unpack_array` (L240-242), `unpack_farray` (L234-238)

## Key Patterns
- Big-endian encoding throughout ('>L', '>l', '>f', '>d' format strings)
- 4-byte alignment padding for strings/opaque data
- Error handling via `raise_conversion_error` decorator (L38-47)
- Method aliasing for semantic equivalence (pack_enum = pack_int, etc.)
- Position-based buffer reading with bounds checking

## Dependencies
- `struct`: Binary data packing/unpacking
- `io.BytesIO`: In-memory binary buffer
- `functools.wraps`: Decorator preservation
- `warnings`: Deprecation notices

## Critical Invariants
- All data must be 4-byte aligned
- Big-endian byte order enforced
- Lists terminated with 0 marker
- Fixed arrays must match declared length
- Buffer position tracking prevents double-reads