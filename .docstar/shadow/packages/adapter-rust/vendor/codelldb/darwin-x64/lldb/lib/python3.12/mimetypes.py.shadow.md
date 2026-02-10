# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/mimetypes.py
@source-hash: 549ea32a52d8012a
@generated: 2026-02-09T18:08:30Z

## MIME Type Detection and Mapping Module

Primary responsibility: Provides MIME type detection from file extensions/URLs and reverse mapping from MIME types to extensions. Core module for content type determination in file handling systems.

### Core Architecture

**Global State Management (L60-61, L364-388)**
- `inited`: Boolean flag tracking initialization state
- `_db`: Global MimeTypes instance serving as default database
- Lazy initialization pattern via `init()` function

**MimeTypes Class (L64-288)**
Main datastore class managing MIME type mappings with dual strict/non-strict categorization:
- `__init__(filenames=(), strict=True)` (L72-84): Initializes with default mappings and optional file parsing
- `types_map`: Tuple of dicts `({}, {})` for (non-strict, strict) extension→type mappings (L77)
- `types_map_inv`: Reverse mappings type→extensions (L78)
- `encodings_map`: Extension→encoding mappings (compression types) (L75)
- `suffix_map`: Extension alias mappings (e.g., .tgz→.tar.gz) (L76)

### Key Methods

**Type Detection (L103-168)**
- `guess_type(url, strict=True)`: Primary method returning (type, encoding) tuple
  - Handles data URLs specially (L130-148)
  - Uses suffix mapping for compound extensions (L150-151)
  - Falls back from strict to non-strict types (L159-168)

**Extension Prediction (L170-205)**
- `guess_all_extensions(type, strict=True)`: Returns list of possible extensions
- `guess_extension(type, strict=True)`: Returns single preferred extension

**Data Loading (L207-288)**
- `read(filename, strict=True)`: Loads mime.types format files (L207-216)
- `readfp(fp, strict=True)`: Parses file content with comment handling (L218-236)
- `read_windows_registry(strict=True)`: Windows registry integration (L238-288)

### Module-Level API (L290-400)

Convenience functions delegating to global `_db` instance:
- `guess_type(url, strict=True)` (L290-310)
- `guess_all_extensions(type, strict=True)` (L313-328)
- `guess_extension(type, strict=True)` (L330-344)
- `add_type(type, ext, strict=True)` (L346-360)
- `init(files=None)` (L363-388): Global initialization
- `read_mime_types(file)` (L391-399): Standalone file parser

### Default Type Mappings (L402-603)

**Core Mappings in `_default_mime_types()`:**
- `_suffix_map_default` (L408-415): Compound extension aliases
- `_encodings_map_default` (L417-423): Compression type mappings
- `_types_map_default` (L432-584): Comprehensive extension→MIME type mapping
- `_common_types_default` (L590-600): Non-standard but common types

### Platform Integration

**Windows Support (L31-39, L247-288)**
- Optional `_winapi._mimetypes_read_windows_registry` acceleration
- Fallback `winreg` implementation via `_read_windows_registry()` class method
- Registry enumeration with null byte filtering (L270)

**Unix/Linux Support (L48-58)**
- Hardcoded list of standard mime.types file locations
- Covers Apache, system-wide, and local configurations

### Command Line Interface (L606-653)

`_main()` function provides CLI tool:
- Type guessing: `mimetypes.py file.ext`
- Extension guessing: `mimetypes.py -e text/html`
- Lenient mode: `--lenient` flag for non-standard types

### Critical Behaviors

- Case-sensitive encoding detection, case-insensitive type detection (L152-158)
- Strict mode excludes common but non-standard types
- Data URL special handling with mediatype parsing (L130-148)
- Thread-safe after initialization (immutable mappings)
- Graceful fallback from accelerated to pure Python registry reading