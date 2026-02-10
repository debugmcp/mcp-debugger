# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/plistlib.py
@source-hash: 502ea7953e190f0b
@generated: 2026-02-09T18:07:52Z

## Primary Purpose
Python standard library module for reading and writing Apple Property List (.plist) files. Supports both XML (default) and binary plist formats with comprehensive serialization/deserialization capabilities.

## Core API Functions
- **load(fp, fmt=None, dict_type=dict) (L865-884)**: Read plist from file object, auto-detects format
- **loads(value, fmt=None, dict_type=dict) (L887-892)**: Read plist from bytes object  
- **dump(value, fp, fmt=FMT_XML, sort_keys=True, skipkeys=False) (L895-903)**: Write plist to file object
- **dumps(value, fmt=FMT_XML, skipkeys=False, sort_keys=True) (L906-911)**: Write plist to bytes object

## Key Classes

### UID (L77-102)
Represents unique identifiers in binary plists. Wraps integer data with validation (0 ≤ value < 2^64). Implements comparison, hashing, and serialization protocols.

### XML Format Support
- **_PlistParser (L173-281)**: XML parser using expat, handles all plist data types with security protection against entity declarations
- **_DumbXMLWriter (L283-319)**: Basic XML writer with indentation support
- **_PlistWriter (L321-413)**: Specialized plist XML writer, extends _DumbXMLWriter with type-specific serialization

### Binary Format Support  
- **_BinaryPlistParser (L456-614)**: Binary plist parser following Apple's binary format specification
- **_BinaryPlistWriter (L631-840)**: Binary plist writer with object deduplication and reference tracking

## Supported Data Types
Strings, integers, floats, booleans, tuples, lists, dictionaries (string keys only), bytes/bytearray, datetime.datetime objects, and UID objects.

## Format Detection
- **_is_fmt_xml(header) (L415-441)**: Detects XML format by checking prefixes and BOMs
- **_is_fmt_binary(header) (L843-844)**: Detects binary format by magic bytes 'bplist00'

## Constants & Configuration
- **PlistFormat enum (L73-74)**: FMT_XML and FMT_BINARY format constants
- **_FORMATS dict (L851-862)**: Maps format constants to parser/writer implementations
- **PLISTHEADER (L110-113)**: Standard XML header for plist files

## Key Dependencies
- xml.parsers.expat for XML parsing
- struct for binary format handling  
- datetime for timestamp support
- binascii for base64 encoding/decoding

## Security Features
Entity declaration rejection in XML parsing (L189-193) to prevent XML vulnerabilities.

## Notable Patterns
- Format auto-detection by reading file headers
- Object reference system in binary format for space efficiency
- Type validation with meaningful error messages
- Configurable dict types for parsing output