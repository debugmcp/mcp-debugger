# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/plistlib.py
@source-hash: 502ea7953e190f0b
@generated: 2026-02-09T18:14:30Z

## Purpose
Python library for reading/writing Apple property list (.plist) files in both XML and binary formats. Provides high-level API functions (`load`, `dump`, `loads`, `dumps`) with automatic format detection and support for standard Python data types.

## Key Classes

### UID (L77-103)
Represents unique identifier objects used in binary plists, particularly by Key-Archiver plist files. Wraps integer data with validation (must be positive, < 2^64) and implements equality, hashing, and serialization methods.

### _PlistParser (L173-281) 
XML plist parser using expat. Maintains parsing stack and current key state. Key methods:
- `parse()` (L180-187): Main entry point, sets up expat handlers
- `handle_entity_decl()` (L189-193): Security measure - rejects entity declarations to prevent XML vulnerabilities
- Element handlers (L232-280): Convert XML elements to Python objects (dict, array, string, integer, real, boolean, data, date)

### _DumbXMLWriter (L283-318)
Basic XML writer with indentation support. Provides element writing methods with proper escaping via `_escape()` function.

### _PlistWriter (L321-412)
XML plist writer extending _DumbXMLWriter. Key features:
- `write_value()` (L337-369): Polymorphic serialization based on Python type
- `write_dict()` (L384-402): Dictionary serialization with optional key sorting
- `write_bytes()` (L371-382): Base64 encoding for binary data with line length management

### _BinaryPlistParser (L456-614)
Binary plist format parser following Apple's CFBinaryPList specification. Complex token-based parsing:
- `parse()` (L467-490): Reads trailer, offset table, then objects
- `_read_object()` (L515-614): Recursive object deserialization based on token types
- Supports all plist data types including UIDs, with reference-based object sharing

### _BinaryPlistWriter (L631-840)
Binary plist writer with object flattening and reference management:
- `write()` (L637-680): Main serialization pipeline - flatten, write objects, write offset table, write trailer
- `_flatten()` (L682-722): Builds object list with deduplication for scalars
- `_write_object()` (L746-840): Token-based binary serialization

## Public API Functions

### load(fp, *, fmt=None, dict_type=dict) (L865-884)
Reads plist from file object with automatic format detection via header inspection.

### loads(value, *, fmt=None, dict_type=dict) (L887-892)  
Reads plist from bytes object using BytesIO wrapper.

### dump(value, fp, *, fmt=FMT_XML, sort_keys=True, skipkeys=False) (L895-903)
Writes plist to file object in specified format.

### dumps(value, *, fmt=FMT_XML, skipkeys=False, sort_keys=True) (L906-911)
Returns plist as bytes object.

## Key Constants & Utilities

- `PlistFormat` enum (L73-74): FMT_XML, FMT_BINARY format constants
- `_FORMATS` registry (L851-862): Maps formats to parser/writer classes and detection functions
- `InvalidFileException` (L448-450): Custom exception for malformed plists
- Date conversion functions (L143-159): ISO 8601 parsing/formatting
- Base64 encoding utilities (L121-135): Custom implementation with line length control

## Architecture Notes

- Pluggable parser/writer architecture via `_FORMATS` registry
- Security-conscious XML parsing (entity declaration rejection)
- Efficient binary format with object reference deduplication
- Support for both mutable (dict) and custom dictionary types
- Comprehensive type system supporting all standard Python types plus UID extension