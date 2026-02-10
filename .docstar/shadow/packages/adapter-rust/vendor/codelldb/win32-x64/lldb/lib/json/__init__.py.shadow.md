# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/json/__init__.py
@source-hash: d5d41e2c29049515
@generated: 2026-02-09T18:11:11Z

## JSON Module Entry Point

This is the main `__init__.py` file for a JSON library, providing a complete JSON serialization/deserialization API similar to Python's standard `json` module. Located within the LLDB debugger's vendored dependencies.

### Primary Functionality
- **Serialization**: Convert Python objects to JSON strings/streams via `dump()` and `dumps()` functions
- **Deserialization**: Parse JSON from strings/streams to Python objects via `load()` and `loads()` functions
- **Encoding Detection**: Automatic Unicode encoding detection for byte inputs
- **Customizable Processing**: Support for custom encoders, decoders, and object hooks

### Key Components

**Public API Functions:**
- `dump(obj, fp, ...)` (L120-181): Serialize object to file-like object with streaming output
- `dumps(obj, ...)` (L183-238): Serialize object to JSON string 
- `load(fp, ...)` (L274-296): Deserialize from file-like object, delegates to `loads()`
- `loads(s, ...)` (L299-359): Deserialize from string/bytes with encoding detection and validation

**Core Classes (imported):**
- `JSONEncoder` (L107): Handles object-to-JSON conversion logic
- `JSONDecoder` and `JSONDecodeError` (L106): Handles JSON-to-object parsing and error reporting

**Optimization Infrastructure:**
- `_default_encoder` (L110-118): Cached encoder instance for common use cases
- `_default_decoder` (L241): Cached decoder instance for common use cases
- Performance optimization via cached instances when using default parameters

**Encoding Detection:**
- `detect_encoding(b)` (L244-271): Auto-detects UTF-8/16/32 encoding from byte order marks and null byte patterns

### Key Parameters & Behavior
**Serialization Options:**
- `skipkeys`: Skip non-basic dict keys instead of raising TypeError
- `ensure_ascii`: Escape non-ASCII characters vs. preserve them
- `check_circular`: Enable/disable circular reference detection
- `allow_nan`: Control handling of NaN/Infinity values
- `indent`/`separators`: Pretty-printing and formatting control
- `sort_keys`: Dictionary key ordering
- `default`: Custom serialization function for unsupported types

**Deserialization Options:**
- `object_hook`/`object_pairs_hook`: Custom object construction from decoded dicts
- `parse_float`/`parse_int`/`parse_constant`: Custom number/constant parsing

### Dependencies
- Imports encoder/decoder classes from `.encoder` and `.decoder` modules
- Uses `codecs` module for BOM detection and encoding handling
- Designed as drop-in replacement for Python's standard `json` module

### Performance Characteristics
- Implements caching strategy: uses pre-configured encoder/decoder instances when parameters match defaults
- Streaming approach in `dump()` writes chunks iteratively rather than building full string in memory
- Encoding detection handles multiple Unicode formats efficiently via byte pattern matching