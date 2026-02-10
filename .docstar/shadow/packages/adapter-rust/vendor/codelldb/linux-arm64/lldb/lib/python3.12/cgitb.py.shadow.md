# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/cgitb.py
@source-hash: 08bbcca13a431551
@generated: 2026-02-09T18:08:38Z

## Purpose
Python's **cgitb** module provides comprehensive traceback formatting for web applications and scripts, generating enhanced error reports in HTML or text format with context, variable values, and source code snippets. This is a vendored copy within the LLDB debugger's Python environment.

## Key Components

### Core Formatting Functions
- **`html(einfo, context=5)`** (L106-201): Primary HTML formatter that generates rich, web-browser-friendly error reports with color-coded syntax, clickable file links, and inline variable inspection
- **`text(einfo, context=5)`** (L203-267): Plain text formatter producing console-friendly error reports with similar detail but without HTML markup
- **`scanvars(reader, frame, locals)`** (L85-104): Tokenizes Python source lines to extract variable names and resolve their values from local/global/builtin scopes
- **`lookup(name, frame, locals)`** (L69-83): Variable resolution engine that searches through namespace hierarchy (local → global → builtin)

### Exception Handling Infrastructure  
- **`Hook` class** (L269-323): Configurable exception handler that replaces `sys.excepthook`
  - `__init__`: Configures display, logging, context lines, output format
  - `handle(info)`: Core processing method that formats and outputs tracebacks
  - Supports both display and file logging with automatic filename generation
- **`enable()` function** (L325-332): Convenience installer that sets up the Hook as the system exception handler
- **`handler` instance** (L324): Pre-configured Hook instance for immediate use

### HTML Utilities
- **`reset()`** (L40-48): Returns HTML reset sequence to clear browser state
- **`small()`, `strong()`, `grey()`** (L51-67): HTML text formatting helpers
- **`__UNDEF__` sentinel** (L50): Special marker for undefined variables

## Dependencies
- `inspect`: Frame introspection and argument extraction
- `tokenize`: Python source code parsing for variable detection  
- `linecache`: Source line retrieval with caching
- `pydoc`: HTML/text representation utilities
- `traceback`: Standard traceback formatting fallback

## Architecture Patterns
- **Dual-format design**: Same analysis engine (`scanvars`, `lookup`) powers both HTML and text outputs
- **Context-aware rendering**: Configurable source line context around error points  
- **Variable introspection**: Deep inspection of local/global variables with proper scoping
- **Graceful degradation**: Falls back to standard traceback on formatting errors
- **Web-optimized**: HTML output includes file:// links and browser-friendly styling

## Critical Features
- **Variable state capture**: Shows actual values of variables at each stack frame
- **Source context**: Displays surrounding code lines with error line highlighted
- **Namespace awareness**: Distinguishes between local, global, and builtin variables
- **File logging**: Optional persistent error logging to temporary files
- **Deprecation**: Module marked for removal in Python 3.13 (L37)