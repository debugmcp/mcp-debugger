# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_sitebuiltins.py
@source-hash: b9388bc1d6d12ed6
@generated: 2026-02-09T18:08:31Z

## Purpose
Internal module for Python's site module that defines custom builtin objects (quit, exit, help, license, copyright) used in interactive Python sessions. Designed to minimize memory footprint by avoiding reference cycles with module globals.

## Key Classes

### Quitter (L13-26)
Exit handler class for `quit` and `exit` builtins.
- `__init__(name, eof)`: Sets name and EOF string for display
- `__repr__()` (L17): Returns usage instructions like "Use quit() or Ctrl-D to exit"
- `__call__(code=None)` (L19): Closes stdin and raises SystemExit with optional code

### _Printer (L29-86)
Interactive display class for license, copyright, and contributor information.
- `MAXLINES = 23` (L33): Pagination threshold
- `__init__(name, data, files=(), dirs=())` (L35): Sets up with fallback data and file search paths
- `__setup()` (L44): Lazy-loads content from files or uses fallback data, splits into lines
- `__repr__()` (L60): Shows abbreviated content or instruction to call for full text
- `__call__()` (L67): Interactive pager with "Hit Return for more" prompt

### _Helper (L88-103)
Wrapper for `help` builtin that delegates to pydoc.
- `__repr__()` (L98): Returns usage instructions
- `__call__(*args, **kwds)` (L101): Imports and delegates to pydoc.help

## Architecture Notes
- Module avoids global state to prevent memory leaks (comments L5-9)
- Uses lazy loading pattern in _Printer to defer file I/O
- Error handling with bare except clause for stdin.close() (L24)
- File search iterates through multiple directories/filenames for content discovery

## Dependencies
- `sys` module for stdin access and SystemExit
- `os` module (imported locally) for path operations  
- `pydoc` module (imported on-demand) for help functionality

## Usage Context
These classes are instantiated by the site module to create the interactive builtins available in Python REPL sessions.