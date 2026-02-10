# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/nturl2path.py
@source-hash: 980982ba66cc403d
@generated: 2026-02-09T18:09:41Z

## Primary Purpose
Windows NT pathname/file URL conversion utility for urllib.requests module. Provides OS-specific bidirectional conversion between NT file system paths and file:// URLs.

## Key Functions

### `url2pathname(url)` (L8-43)
Converts file URLs to Windows file system paths with these transformations:
- Replaces `:` with `|` for drive letter handling
- Handles UNC paths (////host/path → \\host\path)
- Converts forward slashes to backslashes
- Extracts drive letters and validates format
- URL-unquotes components
- Special case for paths ending with `:` and URLs ending with `/` (L40-42)

### `pathname2url(p)` (L45-81)
Converts Windows paths to file URLs:
- Handles special Windows path prefixes like `\\?\` and UNC paths
- Converts backslashes to forward slashes
- URL-quotes path components
- Prefixes with `///` for absolute paths with drive letters
- Validates drive letter format (single character)

## Dependencies
- `string` module (for ascii_letters validation)
- `urllib.parse` module (for quote/unquote operations)

## Key Patterns
- Input validation with OSError exceptions for malformed paths/URLs
- Drive letter extraction and case normalization (uppercase)
- Component-wise processing after splitting on delimiters
- URL encoding/decoding for special characters
- Platform-specific path separator handling (\ vs /)

## Critical Constraints
- Drive letters must be single ASCII letters
- UNC path handling requires specific slash count patterns
- Not recommended for direct use (internal urllib utility)
- Windows-specific implementation assumptions throughout