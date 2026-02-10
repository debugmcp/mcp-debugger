# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/importlib/resources/_legacy.py
@source-hash: d1329d662c712d60
@generated: 2026-02-09T18:06:07Z

## Legacy Resource Access API

This module provides deprecated legacy functions for accessing package resources, serving as a compatibility layer for older importlib.resources usage patterns. All functions are marked deprecated and redirect users to the modern `files()` API.

**Core Types:**
- `Package` (L11): Union of module object or string package name
- `Resource` (L12): String resource identifier

**Key Functions:**

### Utility Functions
- `deprecated()` (L15-27): Decorator that wraps functions to emit deprecation warnings directing users to the modern `files()` API and migration documentation
- `normalize_path()` (L30-39): Validates resource names are simple filenames without path separators, converts input to string and raises ValueError if parent directories detected

### Resource Access Functions (All Deprecated)
- `open_binary()` (L42-45): Opens package resource for binary reading, returns BinaryIO
- `read_binary()` (L48-51): Reads entire binary resource content as bytes
- `open_text()` (L54-64): Opens resource for text reading with encoding/error handling, returns TextIO
- `read_text()` (L67-80): Reads entire text resource content as decoded string
- `contents()` (L83-91): Lists all entries in package directory (includes non-resources)
- `is_resource()` (L94-104): Checks if named entry is a file resource (excludes directories)
- `path()` (L107-120): Provides context manager yielding pathlib.Path, creating temporary files for non-filesystem resources

**Dependencies:**
- `_common`: Provides core `files()` and `as_file()` functionality that legacy functions delegate to
- Standard library: functools, os, pathlib, types, warnings, typing

**Architecture Pattern:**
Legacy facade pattern - all deprecated functions delegate to modern `_common.files()` API while maintaining backward compatibility. Each function applies `normalize_path()` validation before delegating to the equivalent modern operation.