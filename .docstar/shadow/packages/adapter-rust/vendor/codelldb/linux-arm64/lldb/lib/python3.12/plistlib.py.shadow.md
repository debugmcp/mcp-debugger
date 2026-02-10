# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/plistlib.py
@source-hash: 502ea7953e190f0b
@generated: 2026-02-09T18:08:57Z

**Purpose**: Python library for reading and writing Apple Property List (.plist) files in both XML and binary formats. Provides high-level API for serialization/deserialization of Python objects to/from plist format.

**Key Components**:

**Public API Functions**:
- `load(fp, *, fmt=None, dict_type=dict)` (L865-884): Read plist from file object, auto-detects format
- `loads(value, *, fmt=None, dict_type=dict)` (L887-892): Read plist from bytes object
- `dump(value, fp, *, fmt=FMT_XML, sort_keys=True, skipkeys=False)` (L895-903): Write plist to file object
- `dumps(value, *, fmt=FMT_XML, skipkeys=False, sort_keys=True)` (L906-911): Write plist to bytes object

**Core Classes**:
- `UID` (L77-102): Wrapper for unique identifiers in binary plists, validates 64-bit positive integers
- `InvalidFileException` (L448-450): Custom exception for malformed plist files

**XML Format Support**:
- `_PlistParser` (L173-281): XML parser using expat, handles element-by-element parsing with stack-based state management
- `_PlistWriter` (L321-413): XML writer, inherits from `_DumbXMLWriter`, handles type-specific serialization
- `_DumbXMLWriter` (L283-318): Low-level XML writing with indentation support

**Binary Format Support**:
- `_BinaryPlistParser` (L456-614): Binary format parser, handles Apple's binary plist specification
- `_BinaryPlistWriter` (L631-841): Binary format writer, implements object flattening and reference management

**Format Detection**:
- `_is_fmt_xml(header)` (L415-441): Detects XML format by examining headers and BOMs
- `_is_fmt_binary(header)` (L843-844): Detects binary format by checking 'bplist00' signature

**Constants & Configuration**:
- `PlistFormat` enum (L73-74): `FMT_XML`, `FMT_BINARY` format constants
- `PLISTHEADER` (L110-113): Standard XML plist header with DOCTYPE
- `_FORMATS` (L851-862): Format registry mapping formats to parsers/writers

**Supported Data Types**: strings, integers, floats, booleans, lists, dictionaries (string keys only), bytes/bytearray, datetime objects, and UID objects for binary format.

**Key Features**:
- Auto-format detection from file headers
- Configurable dictionary type for parsing
- Sort keys and skip invalid keys options
- Base64 encoding for binary data in XML format
- Reference-based object storage in binary format for efficiency
- XML entity declaration rejection for security