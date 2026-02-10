# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xdrlib.py
@source-hash: 983c5e8e3090bdbe
@generated: 2026-02-09T18:14:25Z

## Purpose & Responsibility
Implements Sun XDR (eXternal Data Representation) protocol for serializing/deserializing data structures into portable binary format. Part of LLDB debugging infrastructure for cross-platform data exchange.

## Core Classes

### Error (L17-33)
Base exception class for XDR operations with custom message handling. Contains `msg` attribute for error details.

### ConversionError (L35-36) 
Specialized exception for data conversion failures, inherits from Error.

### Packer (L50-132)
Serializes Python data types into XDR binary format using big-endian encoding:
- **Buffer management**: `reset()` (L56), `get_buffer()` (L59) 
- **Primitive types**: `pack_uint()` (L65), `pack_int()` (L69), `pack_bool()` (L74), `pack_float()` (L91), `pack_double()` (L95)
- **Hyper integers**: `pack_uhyper()` (L78) handles 64-bit values by splitting into high/low 32-bit parts
- **Strings/bytes**: `pack_fstring()` (L98) with padding to 4-byte boundaries, `pack_string()` (L108) with length prefix
- **Collections**: `pack_list()` (L116) with termination markers, `pack_array()` (L128) with size prefix

### Unpacker (L135-242)  
Deserializes XDR binary data back to Python types:
- **Position tracking**: `get_position()` (L145), `set_position()` (L148), `done()` (L154) for validation
- **Primitive types**: Mirror packer methods but extract from buffer at current position
- **Hyper handling**: `unpack_hyper()` (L184) reconstructs signed 64-bit from two 32-bit parts
- **Collections**: `unpack_list()` (L225) processes variable-length arrays, `unpack_farray()` (L234) for fixed-size

## Key Dependencies
- `struct` module for binary format operations using big-endian (`>`) format specifiers
- `BytesIO` for internal buffer management in Packer
- `functools.wraps` for decorator preservation

## Architecture Patterns
- **Decorator pattern**: `raise_conversion_error()` (L38-47) wraps methods to convert `struct.error` to `ConversionError`
- **Method aliases**: Multiple names for same functionality (e.g., `pack_enum = pack_int`)
- **4-byte alignment**: All data padded to 32-bit boundaries per XDR spec
- **Position-based parsing**: Unpacker maintains internal position pointer for sequential access

## Critical Constraints  
- All integers use big-endian byte order (`>L`, `>l` format codes)
- String/opaque data must be padded to 4-byte boundaries
- Lists terminated with 0 marker, arrays prefixed with element count
- Buffer underrun raises EOFError, conversion issues raise ConversionError