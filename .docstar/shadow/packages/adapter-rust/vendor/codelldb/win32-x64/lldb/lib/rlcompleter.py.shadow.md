# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/rlcompleter.py
@source-hash: fee9ad9c55529be4
@generated: 2026-02-09T18:12:59Z

**Purpose**: GNU readline word completion module for Python interactive environments. Provides intelligent autocompletion for keywords, built-ins, globals, and object attributes in a specified namespace.

**Core Class**:
- `Completer` (L41-200): Main completion engine with configurable namespace
  - `__init__(namespace=None)` (L42-67): Initialize with optional custom namespace or default to `__main__.__dict__`
  - `complete(text, state)` (L69-98): Primary completion entry point called by readline with incremental state
  - `global_matches(text)` (L111-136): Complete simple names against keywords, built-ins, and namespace globals
  - `attr_matches(text)` (L138-200): Complete dotted expressions by evaluating objects and introspecting attributes
  - `_callable_postfix(val, word)` (L100-109): Add parentheses to callable completions, with empty params detection

**Key Functions**:
- `get_class_members(klass)` (L202-207): Recursively collect class and base class members via `dir()`

**Architecture & Dependencies**:
- Integrates with GNU readline module for terminal completion
- Uses `eval()` for dotted expression evaluation (security consideration noted)
- Depends on: `atexit`, `builtins`, `inspect`, `keyword`, `re`, `__main__`
- Auto-registers default completer on import if readline available

**Critical Behaviors**:
- Lazy namespace binding: defers `__main__.__dict__` binding until completion time (L76-77)
- Exception safety: all completion exceptions are silently ignored per readline constraints
- Special keyword handling: adds colons/spaces to keywords for better UX (L124-129)
- Private attribute filtering: progressive revelation of `_` and `__` prefixed members (L168-198)
- Property detection: avoids callable postfix for `@property` decorated methods (L179-187)

**Security Notes**:
- Uses `eval()` for attribute completion, potentially executing `__getattr__` hooks
- Limited to simple dotted expressions, no function calls or indexing operations

**Initialization**: Auto-configures readline completer and registers cleanup on module import (L209-219)