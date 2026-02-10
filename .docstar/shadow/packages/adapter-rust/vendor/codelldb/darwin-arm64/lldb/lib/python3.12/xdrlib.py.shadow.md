# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/xdrlib.py
@source-hash: 983c5e8e3090bdbe
@generated: 2026-02-09T18:07:33Z

## Purpose
Implements a subset of Sun's XDR (eXternal Data Representation) protocol for binary data serialization/deserialization. This is a legacy module deprecated as of Python 3.13.

## Key Components

### Exception Classes
- **Error (L17-33)**: Base exception class with msg attribute
- **ConversionError (L35-36)**: Inherits from Error, used for struct conversion failures
- **raise_conversion_error (L38-47)**: Decorator that wraps struct.error exceptions into ConversionError

### Packer Class (L50-132)
Primary serialization interface that packs data into XDR binary format.

**Core Methods:**
- `__init__()` & `reset()` (L53-57): Initialize/reset BytesIO buffer
- `get_buffer()` (L59-60): Returns packed binary data
- `pack_uint(x)` & `pack_int(x)` (L65-70): Pack 32-bit integers (big-endian)
- `pack_bool(x)` (L74-76): Pack boolean as 4-byte value
- `pack_uhyper(x)` & `pack_hyper(x)` (L78-88): Pack 64-bit integers as two 32-bit parts
- `pack_float(x)` & `pack_double(x)` (L91-96): Pack IEEE floating point
- `pack_fstring(n, s)` (L98-104): Pack fixed-length string with padding
- `pack_string(s)` (L108-111): Pack variable-length string with length prefix
- `pack_list(list, pack_item)` (L116-120): Pack list with terminating zero
- `pack_array(list, pack_item)` (L128-131): Pack array with length prefix

**Aliases:** pack_enum=pack_int, pack_fopaque=pack_fstring, pack_opaque/pack_bytes=pack_string

### Unpacker Class (L135-242)
Primary deserialization interface that unpacks XDR binary data.

**Core Methods:**
- `__init__(data)` & `reset(data)` (L138-143): Initialize with data buffer and position
- `get_position()` & `set_position()` (L145-149): Buffer position management
- `done()` (L154-156): Verify all data consumed
- `unpack_uint()` & `unpack_int()` (L158-172): Unpack 32-bit integers
- `unpack_bool()` (L176-177): Unpack boolean from integer
- `unpack_uhyper()` & `unpack_hyper()` (L179-188): Unpack 64-bit integers
- `unpack_float()` & `unpack_double()` (L190-204): Unpack IEEE floating point
- `unpack_fstring(n)` (L206-214): Unpack fixed-length string
- `unpack_string()` (L218-220): Unpack variable-length string
- `unpack_list(unpack_item)` (L225-232): Unpack list until zero terminator
- `unpack_array(unpack_item)` (L240-242): Unpack array using length prefix

**Aliases:** Similar to Packer for consistency

## Dependencies
- `struct`: Binary data packing/unpacking
- `io.BytesIO`: In-memory binary buffer
- `functools.wraps`: Decorator preservation
- `warnings`: Deprecation notices

## Key Patterns
- Big-endian byte order throughout ('>L', '>l', etc.)
- 4-byte alignment for strings with null padding
- Length-prefixed variable data structures
- Consistent error handling via ConversionError wrapper
- Symmetric pack/unpack API design

## Critical Invariants
- All XDR data must be 4-byte aligned
- Strings are null-padded to 4-byte boundaries
- Lists terminated with zero marker
- Position tracking maintains buffer integrity
- EOFError raised on insufficient data during unpacking