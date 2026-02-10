# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/nturl2path.py
@source-hash: 980982ba66cc403d
@generated: 2026-02-09T18:08:11Z

**Purpose**: NT/Windows pathname to file URL conversion utilities for urllib internal use. Provides bidirectional conversion between Windows file system paths and file:// URLs.

**Core Functions**:
- `url2pathname(url)` (L8-43): Converts file URLs to Windows paths
  - Handles drive specifiers by converting `:` to `|` and back
  - Processes UNC paths (////host/path → \\host\path)
  - Validates drive letter format and raises OSError for malformed URLs
  - Applies URL unquoting to components
- `pathname2url(p)` (L45-81): Converts Windows paths to file URLs
  - Normalizes special Windows path forms (\\?\, UNC\)
  - Handles UNC paths (\\host\path → ////host/path)
  - Validates drive letter format
  - Applies URL quoting to components

**Key Dependencies**:
- `string` module for ASCII letter validation
- `urllib.parse` for URL quoting/unquoting operations

**Path Handling Patterns**:
- Drive letters: `C:\path` ↔ `///C:/path`
- UNC paths: `\\host\share` ↔ `////host/share`
- Special Windows prefixes: `\\?\` stripped, `UNC\` converted to `\`

**Error Conditions**:
- Invalid drive specifiers (non-alphabetic, multiple colons)
- Malformed URLs missing proper drive format
- All errors raise `OSError` with descriptive messages

**Architectural Note**: Module explicitly warns against direct use - designed solely for urllib.requests internal operations.