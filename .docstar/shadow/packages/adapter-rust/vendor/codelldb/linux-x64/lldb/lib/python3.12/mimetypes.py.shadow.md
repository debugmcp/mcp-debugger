# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/mimetypes.py
@source-hash: 549ea32a52d8012a
@generated: 2026-02-09T18:10:27Z

## Purpose & Responsibility
Python's standard MIME type detection module that maps file extensions to MIME types and vice versa. Provides both a global singleton interface and class-based interface for MIME type operations, with support for strict/non-strict type checking and platform-specific registry integration.

## Key Classes & Functions

### Core Class
- **MimeTypes (L64-288)**: Main MIME types datastore class
  - `__init__(L72-84)`: Initializes with optional filenames, copies default mappings
  - `add_type(L86-101)`: Adds type-extension mapping with strict/non-strict categorization
  - `guess_type(L103-168)`: Core method - guesses MIME type from URL/path, handles data URLs, suffix mapping, encoding detection
  - `guess_all_extensions(L170-187)`: Returns all possible extensions for a MIME type
  - `guess_extension(L189-205)`: Returns single preferred extension for a MIME type
  - `read(L207-216)` & `readfp(L218-236)`: Parse mime.types format files
  - `read_windows_registry(L238-258)`: Windows-specific registry integration
  - `_read_windows_registry(L260-288)`: Internal Windows registry parsing

### Global Functions (Module Interface)
- **guess_type(L290-310)**: Global wrapper, auto-initializes singleton
- **guess_all_extensions(L313-328)**: Global wrapper for extension guessing
- **guess_extension(L330-344)**: Global wrapper for single extension
- **add_type(L346-360)**: Global wrapper for adding mappings
- **init(L363-388)**: Initializes global state, reads system files and registry
- **read_mime_types(L391-399)**: Standalone file parser returning type mapping

## Data Structures & Configuration

### Global State Variables (L60-61, L364-365)
- `inited`: Initialization flag
- `_db`: Global MimeTypes instance
- Module-level maps exposed: `suffix_map`, `types_map`, `encodings_map`, `common_types`

### Default Mappings (L402-603)
- **_default_mime_types(L402-603)**: Initializes comprehensive default mappings
- **suffix_map (L408-415)**: Maps compressed extensions (`.tgz` → `.tar.gz`)
- **encodings_map (L417-423)**: Maps encoding extensions to compression types
- **types_map (L432-584)**: Extensive standard MIME type mappings (130+ entries)
- **common_types (L590-600)**: Non-standard but common types (strict=False mode)

### System Integration
- **knownfiles (L48-58)**: Standard Unix/Linux mime.types file locations
- Windows registry support via `_winapi` and `winreg` imports (L31-39)

## Architecture Patterns

### Lazy Initialization
Global functions check `_db is None` and call `init()` on first use, ensuring thread-safe singleton pattern.

### Strict/Non-Strict Duality  
All major operations support `strict` parameter - strict mode uses only standard IANA types, non-strict adds common non-standard types.

### Platform Abstraction
Handles Windows registry and Unix file-based MIME databases transparently through conditional imports and fallback logic.

### URL Handling
Special handling for data URLs (L130-148) with proper mediatype parsing according to RFC 2397.

## Critical Behavior Notes

- Case-insensitive extension matching with lowercase normalization (L158)
- Encoding detection happens before type detection (L153-157) 
- Suffix mapping applied recursively until no more matches (L150-151)
- Default to `text/plain` for malformed data URLs (L147)
- Windows registry integration requires either `_winapi` or `winreg` modules
- Thread-safe initialization through module-level `inited` flag