# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_sitebuiltins.py
@source-hash: b9388bc1d6d12ed6
@generated: 2026-02-09T18:12:45Z

**Purpose:** Defines custom builtin objects used by Python's site module for interactive shell functionality (quit, help, license/copyright display). Designed to minimize memory references by avoiding globals retention.

**Architecture:** Three specialized classes providing interactive shell conveniences:

**Key Classes:**

- **Quitter (L13-26):** Implements `quit` and `exit` builtins
  - `__init__(name, eof)` - stores command name and EOF indicator
  - `__repr__()` (L17-18) - displays usage instruction
  - `__call__(code=None)` (L19-26) - closes stdin and raises SystemExit with optional code

- **_Printer (L29-86):** Displays license/copyright/contributor text with pagination
  - Class constant `MAXLINES = 23` (L33) - pagination size
  - `__init__(name, data, files=(), dirs=())` (L35-42) - constructs file paths from dirs/files combinations
  - `__setup()` (L44-58) - lazy-loads content from files or fallback to default data
  - `__repr__()` (L60-65) - shows truncated content or instruction for full display
  - `__call__()` (L67-85) - interactive paginated display with quit option ('q')

- **_Helper (L88-103):** Wrapper for pydoc.help system
  - `__repr__()` (L98-100) - shows usage instructions
  - `__call__(*args, **kwds)` (L101-103) - delegates to pydoc.help with all arguments

**Dependencies:**
- `sys` (L11) - for stdin manipulation and SystemExit
- `os` (L36) - for file path construction  
- `pydoc` (L102) - for help functionality (imported on-demand)

**Design Patterns:**
- Lazy initialization in _Printer to avoid unnecessary file I/O
- On-demand imports to minimize startup overhead
- Callable objects that also provide helpful __repr__ for interactive discovery
- Graceful error handling (OSError ignored in file loading, generic except in stdin.close())

**Memory Management:** Explicitly designed to be "almost immortal" objects that avoid keeping module globals alive, as noted in header comments (L5-9).