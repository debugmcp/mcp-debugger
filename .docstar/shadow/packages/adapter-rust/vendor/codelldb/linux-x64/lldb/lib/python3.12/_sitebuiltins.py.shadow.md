# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_sitebuiltins.py
@source-hash: b9388bc1d6d12ed6
@generated: 2026-02-09T18:11:16Z

**Primary Purpose**: Defines interactive builtin objects for Python's site module, specifically the `quit()`, `exit()`, `help()`, `license()`, `copyright()`, and `credits()` functions available at the interactive prompt. These objects provide user-friendly interfaces for common REPL operations while avoiding circular references.

**Key Classes and Functions**:

- **Quitter (L13-26)**: Implements `quit()` and `exit()` functionality
  - `__init__(name, eof)` (L14): Stores display name and EOF keystroke
  - `__repr__()` (L17): Returns usage instruction string
  - `__call__(code=None)` (L19): Closes stdin and raises SystemExit with optional code

- **_Printer (L29-86)**: Base class for displaying license/copyright/credits text
  - `MAXLINES = 23` (L33): Pagination constant for terminal display
  - `__init__(name, data, files, dirs)` (L35): Sets up name, fallback data, and file search paths
  - `__setup()` (L44): Lazy loader that reads from files or falls back to embedded data
  - `__repr__()` (L60): Shows truncated content or instruction message
  - `__call__()` (L67): Interactive paginated display with "q to quit" functionality

- **_Helper (L88-103)**: Wrapper for `help()` builtin
  - `__repr__()` (L98): Returns usage instructions
  - `__call__(*args, **kwds)` (L101): Delegates to `pydoc.help()`

**Key Dependencies**:
- `sys` (L11): For stdin manipulation and SystemExit
- `os` (L36): For file path operations in _Printer
- `pydoc` (L102): For actual help functionality

**Architectural Patterns**:
- **Callable objects**: All classes implement `__call__` to act as functions
- **Lazy initialization**: _Printer uses `__setup()` to defer file reading
- **Graceful fallbacks**: _Printer tries files first, then embedded data
- **Memory management**: Module design minimizes global references to prevent memory leaks

**Critical Behaviors**:
- Quitter closes stdin before SystemExit to handle shell environments like IDLE
- _Printer implements pagination for long text content
- All classes provide helpful `__repr__` messages for interactive discovery