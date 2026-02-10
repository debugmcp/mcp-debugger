# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/plistlib.py
@source-hash: 502ea7953e190f0b
@generated: 2026-02-09T18:07:18Z

**Primary Purpose**: Python module for reading/writing macOS property list (.plist) files in both XML and binary formats.

**Key Classes & Functions**:

- **UID** (L77-103): Wrapper for unsigned integer IDs used in Key-Archiver plists. Immutable container with validation for 64-bit positive integers.

- **_PlistParser** (L173-281): XML plist parser using expat. Maintains parsing stack and handles nested dictionaries/arrays. Key methods:
  - `parse(fileobj)` (L180-187): Main entry point
  - Element handlers for dict, array, string, integer, real, boolean, data, date types
  - Security: Rejects XML entity declarations (L189-193)

- **_DumbXMLWriter** (L283-319): Basic XML writer with indentation support. Foundation for plist XML output.

- **_PlistWriter** (L321-413): XML plist writer extending _DumbXMLWriter. Handles type serialization with proper escaping and base64 encoding for binary data.

- **_BinaryPlistParser** (L456-614): Binary plist format parser following Apple's CFBinaryPList specification. Parses trailer-first format with object offset table.

- **_BinaryPlistWriter** (L631-841): Binary plist writer. Flattens object graph, writes header + objects + offset table + trailer.

**Public API** (L57-59):
- `load(fp, fmt=None, dict_type=dict)` (L865-884): Read from file object
- `loads(value, fmt=None, dict_type=dict)` (L887-892): Read from bytes  
- `dump(value, fp, fmt=FMT_XML, sort_keys=True, skipkeys=False)` (L895-903): Write to file
- `dumps(value, fmt=FMT_XML, skipkeys=False, sort_keys=True)` (L906-911): Write to bytes

**Format Detection**:
- `_is_fmt_xml()` (L415-441): Detects XML format including BOM variants
- `_is_fmt_binary()` (L843-844): Detects binary format via "bplist00" header

**Key Constants**:
- `PlistFormat` enum (L73-74): FMT_XML, FMT_BINARY
- `PLISTHEADER` (L110-113): Standard XML header with DTD
- `_FORMATS` dict (L851-862): Maps format enums to parser/writer classes

**Data Type Support**: Handles strings, integers, floats, booleans, dates, binary data (base64 in XML), dictionaries (string keys only), arrays, and UID objects.

**Architecture**: Plugin-style format system where parsers/writers are registered in _FORMATS dict. Auto-detection reads file header to determine format. Both formats share common validation and type handling patterns.