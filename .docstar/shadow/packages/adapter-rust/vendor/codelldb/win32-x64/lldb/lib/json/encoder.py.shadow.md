# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/json/encoder.py
@source-hash: af7bd40a0d0d0a3e
@generated: 2026-02-09T18:11:17Z

## JSON Encoder Implementation

Core JSON encoding functionality with C extension fallbacks for performance optimization.

### Key Components

**String Escaping Functions**
- `py_encode_basestring()` (L37-43): Escapes control characters in strings using ESCAPE_DCT lookup
- `py_encode_basestring_ascii()` (L49-68): ASCII-only encoding with Unicode surrogate pair handling for characters >U+FFFF
- `encode_basestring` (L46): Performance-optimized fallback that uses C extension if available
- `encode_basestring_ascii` (L71-72): Performance-optimized ASCII encoding with C fallback

**Global Constants**
- `ESCAPE` (L18): Regex for control characters requiring escaping
- `ESCAPE_ASCII` (L19): Regex for non-ASCII characters  
- `ESCAPE_DCT` (L21-33): Character escape mapping including Unicode escapes for control chars
- `INFINITY` (L35): Float infinity constant

**Main Encoder Class**
- `JSONEncoder` (L74-258): Primary JSON encoding class with configurable behavior
  - `__init__()` (L105-160): Constructor with encoding options (skipkeys, ensure_ascii, check_circular, etc.)
  - `default()` (L161-181): Override point for custom object serialization (raises TypeError by default)
  - `encode()` (L183-203): Main encoding entry point, optimized for simple string cases
  - `iterencode()` (L205-258): Generator-based encoding for large objects, uses C encoder when possible

**Core Encoding Engine**
- `_make_iterencode()` (L260-443): Factory function creating the actual encoding generator
  - `_iterencode_list()` (L278-332): Handles list/tuple encoding with indentation
  - `_iterencode_dict()` (L334-412): Handles dictionary encoding with key type validation
  - `_iterencode()` (L414-442): Main recursive encoding dispatcher with circular reference detection

### Architecture Decisions

- **Dual Implementation Strategy**: Pure Python implementations with optional C extension fallbacks for performance
- **Generator-Based Streaming**: Uses generators for memory-efficient encoding of large objects
- **Circular Reference Detection**: Optional object ID tracking to prevent infinite recursion
- **Unicode Handling**: Supports both ASCII-safe and UTF-8 output modes
- **Type Flexibility**: Allows various key types (str, int, float, bool, None) with optional strict mode

### Performance Optimizations

- Bytecode optimization via local variable binding (L262-273)
- C extension integration for string encoding and main encoder loop
- Direct type checking with `is` for singletons (None, True, False)
- Optimized string case handling in main encode() method

### Key Dependencies

- `re` module for character escaping patterns
- Optional `_json` C extension module for performance
- Built-in types: dict, list, tuple, str, int, float