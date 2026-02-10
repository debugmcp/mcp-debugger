# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/ctypes/macholib/dylib.py
@source-hash: f19ee056b18165cc
@generated: 2026-02-09T18:06:05Z

## Purpose
Utility module for parsing macOS dynamic library (dylib) file paths and extracting structured metadata components.

## Key Components

### `DYLIB_RE` (L9-17)
Compiled regex pattern that parses dylib paths into named groups:
- `location`: Directory path containing the dylib
- `name`: Complete dylib filename including version/suffix
- `shortname`: Base library name without extensions
- `version`: Optional version identifier (e.g., "1.0", "2.3")
- `suffix`: Optional suffix identifier (e.g., "debug", "release")

Uses verbose regex syntax (`(?x)`) for readability with multi-line definition.

### `dylib_info(filename)` (L19-42)
Primary API function that parses a dylib path and returns structured metadata.

**Parameters:**
- `filename`: String path to analyze (can be absolute or relative)

**Returns:**
- `None` if path doesn't match dylib pattern
- Dictionary with parsed components: `location`, `name`, `shortname`, `version`, `suffix`

**Supported Formats:**
1. `Location/Name.SomeVersion_Suffix.dylib`
2. `Location/Name.SomeVersion.dylib`  
3. `Location/Name_Suffix.dylib`
4. `Location/Name.dylib`

## Dependencies
- `re`: Standard library regex module for pattern matching

## Usage Pattern
This is a standalone utility for macOS dylib path analysis, typically used by higher-level tools that need to understand library versioning and naming conventions. The regex captures optional version and suffix components, making it flexible for various dylib naming schemes.