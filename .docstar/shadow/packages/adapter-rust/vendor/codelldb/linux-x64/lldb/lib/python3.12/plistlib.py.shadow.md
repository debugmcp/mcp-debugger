# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/plistlib.py
@source-hash: 502ea7953e190f0b
@generated: 2026-02-09T18:10:21Z

**Primary Purpose**: Python library for reading, writing, and manipulating macOS property list (.plist) files in both XML and binary formats. Provides complete serialization/deserialization support for Apple's plist format with support for basic Python data types.

**Key Classes and Functions**:

- `UID` (L77-102): Wrapper class for unsigned integer identifiers used in binary plists. Validates range (0 to 2^64-1) and provides standard object methods (__eq__, __hash__, __repr__).

- `_PlistParser` (L173-281): XML plist parser using expat. Maintains parsing stack and handles all plist element types (dict, array, string, integer, real, boolean, data, date). Includes security protection against XML entity declarations.

- `_DumbXMLWriter` (L283-319): Base XML writer with indentation support. Handles element creation and proper UTF-8 encoding for plist output.

- `_PlistWriter` (L321-413): Extends _DumbXMLWriter for complete XML plist generation. Supports type-specific serialization for all plist data types with configurable key sorting and key skipping.

- `_BinaryPlistParser` (L456-614): Binary plist format parser. Implements Apple's binary plist specification with trailer parsing, object reference resolution, and recursive object reconstruction.

- `_BinaryPlistWriter` (L631-841): Binary plist writer. Handles object flattening, reference counting, and binary encoding according to Apple's specification.

**Public API Functions**:
- `load(fp, fmt=None, dict_type=dict)` (L865-884): Load plist from file object with automatic format detection
- `loads(value, fmt=None, dict_type=dict)` (L887-892): Load plist from bytes object
- `dump(value, fp, fmt=FMT_XML, sort_keys=True, skipkeys=False)` (L895-903): Write plist to file object
- `dumps(value, fmt=FMT_XML, skipkeys=False, sort_keys=True)` (L906-911): Write plist to bytes object

**Format Constants**:
- `FMT_XML`, `FMT_BINARY` (L73-74): Enum values for plist format selection

**Key Dependencies**: 
- `xml.parsers.expat` for XML parsing
- `struct`, `binascii` for binary format handling
- `datetime` for timestamp support
- `io.BytesIO` for in-memory operations

**Architectural Decisions**:
- Dual format support with automatic detection via header inspection
- Pluggable dictionary type support for custom dict classes
- Security hardening against XML entity attacks
- Reference-based object serialization in binary format to handle object graphs
- Type validation with specific error handling for unsupported types

**Critical Constraints**:
- Dictionary keys must be strings in both formats
- Binary format uses specific Apple timestamp epoch (2001-01-01)
- UID values limited to 64-bit unsigned integers
- XML format rejects control characters except tab, newline, carriage return
- Binary format has specific object reference size limits based on total object count