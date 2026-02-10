# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/nturl2path.py
@source-hash: 980982ba66cc403d
@generated: 2026-02-09T18:07:08Z

## Purpose
Windows NT-specific URL/pathname conversion utilities for urllib.requests. Provides bidirectional conversion between Windows file system paths and file:// URLs with NT-specific handling of drive letters, UNC paths, and path separators.

## Key Functions

### `url2pathname(url)` (L8-43)
Converts file:// URLs to Windows filesystem paths. Handles:
- Drive letter conversion using `|` separator (C|/path → C:\path)
- UNC path handling for network shares (////host/path → \\host\path)
- Slash-to-backslash conversion with proper URL unquoting
- Special case for trailing directory separators (L40-42)

Key logic:
- Replaces `:` with `|` for Windows compatibility (L19)
- Splits on `|` to extract drive letter (L30-43)
- Validates drive letter format and raises OSError on malformed URLs (L31-33)

### `pathname2url(p)` (L45-81)
Converts Windows filesystem paths to file:// URLs. Handles:
- Extended path prefixes (`\\?\` removal, L55-60)
- UNC path detection and normalization (L57-58)
- Drive letter extraction and URL encoding
- Backslash-to-slash conversion with proper URL quoting

Key logic:
- Strips Windows extended path prefix `\\?\` (L55-56)
- Handles UNC paths by converting `UNC\` prefix (L57-58)
- Splits on `:` to separate drive from path (L70-73)
- Validates single-character drive letters (L71-73)

## Dependencies
- `string` module for ASCII letter validation
- `urllib.parse` for URL encoding/decoding operations

## Architecture Notes
- Designed as internal utility for urllib.requests, not public API
- Error handling via OSError with descriptive messages
- Symmetric conversion pair with consistent URL format (///drive:/path/...)
- Special handling for Windows-specific path formats (UNC, extended paths)

## Critical Invariants
- Drive letters must be single ASCII characters
- URL format uses `|` separator internally, converted to `:` in final URLs
- UNC paths maintain double-slash prefix after conversion
- All path components are properly URL-encoded/decoded