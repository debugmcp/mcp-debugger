# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_sitebuiltins.py
@source-hash: b9388bc1d6d12ed6
@generated: 2026-02-09T18:06:58Z

## Purpose
Provides custom builtin objects for Python's interactive environment, specifically designed to avoid memory leaks by keeping minimal global references. Used by the site module to inject interactive utilities like quit(), exit(), help(), license(), etc.

## Key Classes

### Quitter (L13-26)
Exit handler for interactive Python sessions. Creates callable objects for `quit` and `exit` builtins.
- `__init__(name, eof)`: Stores exit command name and EOF key combination
- `__repr__()` (L17-18): Returns usage instruction string
- `__call__(code=None)` (L19-26): Closes stdin and raises SystemExit with optional code

### _Printer (L29-86)
Interactive text display utility for license, copyright, and contributor information.
- **MAXLINES = 23** (L33): Controls pagination size
- `__init__(name, data, files, dirs)` (L35-42): Sets up with fallback data and file search paths
- `__setup()` (L44-58): Lazy-loads content from files or uses fallback data, splits into lines
- `__repr__()` (L60-65): Shows truncated content or instruction message
- `__call__()` (L67-85): Interactive paged display with quit option ('q')

### _Helper (L88-103)
Wrapper for Python's help system with user-friendly interactive behavior.
- `__repr__()` (L98-100): Returns usage instructions
- `__call__(*args, **kwds)` (L101-103): Delegates to pydoc.help with all arguments

## Dependencies
- `sys`: For stdin access and SystemExit
- `os`: For file path operations (imported locally)
- `pydoc`: For help functionality (imported on-demand)

## Architecture Patterns
- **Lazy initialization**: Content loading deferred until first access
- **Local imports**: Modules imported within methods to minimize global references
- **Fallback mechanism**: File-based content with embedded fallback data
- **Interactive pagination**: User-controlled text display with quit option

## Memory Management
Designed as "almost immortal" objects that avoid keeping excessive global references alive. The module explicitly avoids retaining objects in its global namespace to prevent memory leaks in long-running interactive sessions.