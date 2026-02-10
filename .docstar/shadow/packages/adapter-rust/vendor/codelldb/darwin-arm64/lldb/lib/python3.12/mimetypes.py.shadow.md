# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/mimetypes.py
@source-hash: 549ea32a52d8012a
@generated: 2026-02-09T18:07:19Z

# MIME Types Detection Module

**Primary Purpose**: Provides comprehensive MIME type detection and extension guessing functionality based on file URLs, paths, and extensions. Part of Python's standard library for content type determination.

## Core Architecture

**Global State Management (L48-62)**:
- `knownfiles`: List of system MIME type database file paths to parse
- `inited`: Initialization flag preventing duplicate setup
- `_db`: Global singleton MimeTypes instance

**Main Public API (L290-360)**:
- `guess_type(url, strict=True)` (L290): Returns (mime_type, encoding) tuple from file URL/path
- `guess_extension(type, strict=True)` (L330): Returns preferred file extension for MIME type  
- `guess_all_extensions(type, strict=True)` (L313): Returns all known extensions for MIME type
- `add_type(type, ext, strict=True)` (L346): Registers new MIME type mapping
- `init(files=None)` (L363): Initializes global database from system files

## Core Classes

**MimeTypes (L64-289)**: Main MIME type database class
- `__init__(filenames=(), strict=True)` (L72): Initializes with default mappings plus optional files
- `types_map`: Tuple of (non_strict, strict) extension→type dictionaries (L77)
- `types_map_inv`: Reverse mapping type→extensions for lookups (L78)
- `encodings_map`: Extension→encoding mappings (gz, bz2, etc.) (L75)
- `suffix_map`: Compound extension mappings (.tgz → .tar.gz) (L76)

**Key Methods**:
- `guess_type(url, strict=True)` (L103): Core type detection with data URL support (L130-148)
- `add_type(type, ext, strict=True)` (L86): Bidirectional mapping registration
- `read(filename, strict=True)` (L207): Parse mime.types format files
- `readfp(fp, strict=True)` (L218): Parse from file pointer with comment handling
- `read_windows_registry(strict=True)` (L238): Load types from Windows registry

## Data Structures

**Default Mappings (L402-603)**:
- `_suffix_map_default` (L408): Compound extensions (.tgz, .tbz2, etc.)
- `_encodings_map_default` (L417): Compression format detection
- `_types_map_default` (L432): Comprehensive IANA-registered MIME types (150+ entries)
- `_common_types_default` (L590): Non-standard but widely-used types

## Platform-Specific Features

**Windows Registry Integration (L238-288)**:
- `_mimetypes_read_windows_registry`: Fast C implementation when available (L32-34)
- `_read_windows_registry()` (L261): Pure Python fallback using winreg
- Registry parsing with HKEY_CLASSES_ROOT enumeration (L274-288)

## Key Behaviors

**Type Detection Algorithm (L103-168)**:
1. Handle data URLs with embedded MIME types (L130-148)
2. Process compound extensions via suffix_map (L150-151) 
3. Extract encoding from known compression extensions (L153-157)
4. Lookup final extension in strict/non-strict type maps (L159-168)

**Strict vs Non-Strict Modes**:
- `strict=True`: Only IANA-registered standard types
- `strict=False`: Includes common non-standard types (image/webp, etc.)

**File Format Support**: Parses standard mime.types format with hash comments (L226-236)

## Utilities

**Command Line Interface (L606-653)**: Direct MIME type/extension lookup tool with lenient mode support

**Standalone File Reader (L391-399)**: `read_mime_types(file)` for one-off file parsing without global state

## Dependencies
- Standard library: `os`, `sys`, `posixpath`, `urllib.parse`
- Windows-only: `winreg`, `_winapi` (optional performance enhancement)