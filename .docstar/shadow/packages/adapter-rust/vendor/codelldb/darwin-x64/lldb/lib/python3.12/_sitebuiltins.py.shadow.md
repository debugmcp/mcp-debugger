# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_sitebuiltins.py
@source-hash: b9388bc1d6d12ed6
@generated: 2026-02-09T18:07:32Z

## Purpose
Provides custom builtin objects for Python's interactive site module, specifically implementing exit/quit functionality, help system, and interactive text display (license, copyright, etc.). This module is designed to minimize memory footprint by avoiding references to module globals.

## Key Classes

### Quitter (L13-26)
- **Purpose**: Implements `quit()` and `exit()` functions for interactive Python sessions
- **Constructor** (L14-16): Takes `name` (function name) and `eof` (EOF sequence description)
- **`__repr__`** (L17-18): Returns usage instructions showing both callable and EOF exit methods  
- **`__call__`** (L19-26): Executes exit sequence by closing stdin and raising SystemExit
- **Pattern**: Gracefully handles shell environments (like IDLE) that catch SystemExit

### _Printer (L29-86)
- **Purpose**: Interactive display system for license text, contributors, copyright notices
- **Class constant**: `MAXLINES = 23` (L33) - controls pagination
- **Constructor** (L35-42): Takes name, fallback data, and optional file/directory paths for content loading
- **`__setup`** (L44-58): Lazy initialization that loads content from files or uses fallback data
- **`__repr__`** (L60-65): Shows either full content (if ≤ MAXLINES) or instruction to call function
- **`__call__`** (L67-85): Interactive paginated display with user controls ('q' to quit, Enter for more)
- **Pattern**: Implements lazy loading and pagination for potentially large text content

### _Helper (L88-103)  
- **Purpose**: Wrapper around pydoc.help for the builtin `help` function
- **`__repr__`** (L98-100): Returns usage instructions for interactive help
- **`__call__`** (L101-103): Delegates to `pydoc.help()` with all arguments

## Dependencies
- `sys` (L11): For stdin manipulation and system interaction
- `os` (L36): For file path operations (imported locally)
- `pydoc` (L102): For help system implementation (imported locally)

## Architectural Notes
- **Memory optimization**: Module avoids keeping references in globals to prevent memory leaks
- **Local imports**: `os` and `pydoc` imported within methods to minimize module footprint  
- **Lazy initialization**: `_Printer` defers content loading until first access
- **Interactive design**: All classes provide meaningful `__repr__` and callable interfaces for REPL usage