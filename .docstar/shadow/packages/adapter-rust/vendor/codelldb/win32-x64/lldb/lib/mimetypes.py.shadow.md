# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/mimetypes.py
@source-hash: 549ea32a52d8012a
@generated: 2026-02-09T18:13:04Z

## MIME Type Detection and Management Module

This module provides comprehensive MIME type detection and file extension mapping functionality. It's part of a Python LLDB debug adapter in a Rust package, serving as a standard library component for content type identification.

### Core Architecture

The module implements a singleton pattern with lazy initialization through the global `_db` variable (L61) and `inited` flag (L60). The primary functionality is exposed through both instance methods via `MimeTypes` class and module-level convenience functions.

### Key Components

**MimeTypes Class (L64-289)**
- Primary MIME type datastore and processing engine
- Maintains separate mappings for strict (standard) and lenient (common but non-standard) types
- Key attributes:
  - `types_map`: tuple of dicts for (non-strict, strict) type mappings (L77)
  - `types_map_inv`: inverse mappings from types to extensions (L78)
  - `encodings_map`: extension to encoding mappings (L75)
  - `suffix_map`: extension transformation mappings (L76)

**Core Methods:**
- `guess_type(url, strict=True)` (L103-168): Main type detection logic with URL parsing and data URL support
- `add_type(type, ext, strict=True)` (L86-101): Bidirectional mapping registration
- `guess_extension(type, strict=True)` (L189-205): Extension prediction from MIME type
- `read_windows_registry(strict=True)` (L238-258): Windows registry integration for system types

**Module-Level Functions (L290-400)**
Convenience wrappers that delegate to the global `_db` instance:
- `guess_type()` (L290-310)
- `guess_extension()` (L330-344)
- `add_type()` (L346-360)
- `init()` (L363-388): Global initialization with file parsing
- `read_mime_types()` (L391-399): Single file parser

### Data Sources and Initialization

**Default Type Mappings (L402-603)**
- `_default_mime_types()` (L402-603): Establishes comprehensive built-in mappings
- `_types_map_default` (L432-584): 150+ standard MIME type associations
- `_common_types_default` (L590-600): Non-standard but commonly encountered types
- `_encodings_map_default` (L417-423): Compression format mappings
- `_suffix_map_default` (L408-415): Extension transformations (e.g., .tgz → .tar.gz)

**File Sources (L48-58)**
Known MIME type files across Unix systems including Apache, Mac OS X, and various distribution locations.

### Platform Integration

**Windows Registry Support (L238-288)**
- Dual implementation: accelerated C extension (`_mimetypes_read_windows_registry`) or pure Python fallback
- Registry enumeration through `_winreg` for system-registered MIME types
- Graceful degradation when Windows APIs unavailable

### Processing Logic

**URL/Path Analysis (L103-168)**
1. URL scheme detection and data URL parsing (L130-148)
2. Extension extraction with suffix transformation (L149-152)
3. Encoding detection (L153-157)
4. Type lookup with fallback from strict to lenient modes (L159-168)

**File Format Support**
The module recognizes 150+ file types across categories:
- Web formats (HTML, CSS, JS, JSON, WebAssembly)
- Documents (PDF, MS Office, PostScript)
- Media (images, audio, video including modern formats like AVIF, HEIC, WebM)
- Archives and compression formats
- Programming language files
- System and configuration files

### Command-Line Interface (L606-653)
Standalone utility mode with options for extension guessing and lenient type matching.