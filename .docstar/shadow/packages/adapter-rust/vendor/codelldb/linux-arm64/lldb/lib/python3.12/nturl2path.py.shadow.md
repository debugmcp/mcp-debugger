# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/nturl2path.py
@source-hash: 980982ba66cc403d
@generated: 2026-02-09T18:08:45Z

## Purpose
Windows NT pathname/URL conversion utilities for urllib.requests - provides OS-specific file URL handling with Windows path conventions (backslashes, drive letters).

## Key Functions

### url2pathname(url) (L8-43)
Converts file scheme URLs to Windows filesystem paths:
- Handles drive specifiers (C|/ → C:\)  
- Processes UNC paths (////host/path → \\host\path)
- Converts forward slashes to backslashes
- URL-unquotes components
- Special case handling for trailing slashes on drive roots (L40-42)

### pathname2url(p) (L45-81)
Converts Windows filesystem paths to file scheme URLs:
- Handles Windows extended paths (\\?\ prefix) (L55-60)
- Processes UNC paths (\\host → ////host)
- Converts backslashes to forward slashes
- URL-quotes path components
- Validates drive letter format

## Dependencies
- `string` module for ASCII letter validation
- `urllib.parse` for URL quoting/unquoting operations

## Key Patterns
- Bidirectional conversion between Windows paths and file URLs
- Special handling for drive letters using pipe (|) substitution
- UNC path processing with slash doubling/halving
- Error handling via OSError for malformed inputs
- Component-wise processing to preserve URL encoding

## Critical Constraints
- Designed specifically for Windows NT pathname conventions
- Not recommended for general use outside urllib.requests context
- Assumes file:// scheme URLs only
- Drive letters must be single ASCII characters