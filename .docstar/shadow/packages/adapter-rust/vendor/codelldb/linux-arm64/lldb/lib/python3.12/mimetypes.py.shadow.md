# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/mimetypes.py
@source-hash: 549ea32a52d8012a
@generated: 2026-02-09T18:09:21Z

## Purpose
Python standard library module for MIME type guessing and extension mapping. Provides bidirectional mapping between file extensions and MIME types, supporting both strict (IANA-registered) and lenient (common non-standard) types.

## Core Architecture
- **Singleton Pattern**: Global `_db` variable (L61) holds shared MimeTypes instance after `init()` (L363)
- **Dual Type System**: Separates strict/standard types from non-standard common types via boolean indexing
- **Lazy Initialization**: Module-level functions check `_db is None` and call `init()` if needed

## Key Classes

### MimeTypes (L64-288)
Primary datastore class managing MIME type mappings:
- **Constructor** (L72-84): Initializes with default mappings and optional file parsing
- **Core Data Structures**:
  - `types_map` (L77): Tuple of dicts `({}, {})` for (non-strict, strict) ext→type mapping
  - `types_map_inv` (L78): Inverse mapping type→[extensions] for reverse lookups
  - `encodings_map` (L75): Extension→encoding mappings (.gz→gzip, etc.)
  - `suffix_map` (L76): Extension aliases (.tgz→.tar.gz, etc.)

### Core Methods
- **guess_type()** (L103-168): Main type detection with URL/data URL support, encoding chain resolution
- **guess_extension()** (L189-205): Returns first matching extension for MIME type
- **guess_all_extensions()** (L170-187): Returns all possible extensions for type
- **add_type()** (L86-101): Adds new type mappings with strict/non-strict categorization

## Module-Level API
Convenience functions that delegate to global `_db` instance:
- `guess_type()` (L290-310)
- `guess_extension()` (L330-344) 
- `guess_all_extensions()` (L313-328)
- `add_type()` (L346-360)

## Data Sources & Initialization
- **Default Mappings**: Comprehensive built-in type definitions (L432-584, L590-600)
- **System Files**: Unix MIME types files in `knownfiles` list (L48-58)
- **Windows Registry**: Platform-specific registry reading (L238-288)
- **init()** function (L363-388): Orchestrates initialization from all sources

## Key Features
- **URL Parsing**: Handles file://, data:, and regular paths via urllib.parse (L123-148)
- **Encoding Detection**: Multi-layer extension processing for compressed files
- **Case Handling**: Case-sensitive encodings, case-insensitive type matching
- **Windows Support**: Registry integration with fallback to accelerated C function

## Dependencies
- Standard library: os, sys, posixpath, urllib.parse
- Optional Windows: _winapi, winreg (imported conditionally L31-39)

## Global State
- `inited` (L60): Initialization flag
- `_db` (L61): Global MimeTypes instance
- Exported maps: `suffix_map`, `encodings_map`, `types_map`, `common_types` (L364, L383-387)

## Command Line Interface
`_main()` (L606-650): Provides CLI for type/extension guessing with strict/lenient modes.