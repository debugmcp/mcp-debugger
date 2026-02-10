# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/rlcompleter.py
@source-hash: fee9ad9c55529be4
@generated: 2026-02-09T18:07:18Z

## Purpose
GNU readline word completion module that provides intelligent completion for Python expressions, keywords, built-ins, and object attributes. Used by LLDB's Python REPL to enable tab completion.

## Core Components

### Completer Class (L41-200)
Main completion engine with configurable namespace support.

**Key Methods:**
- `__init__(namespace=None)` (L42-67): Initializes with optional custom namespace, defaults to `__main__.__dict__`
- `complete(text, state)` (L69-98): Primary completion interface called by readline with progressive state values
- `global_matches(text)` (L111-136): Handles simple name completion for keywords, built-ins, and namespace variables
- `attr_matches(text)` (L138-200): Processes dotted expressions (e.g., "sys.path") by evaluating and introspecting objects
- `_callable_postfix(val, word)` (L100-109): Adds parentheses to callable completions, with empty "()" for parameterless functions

### Utility Functions
- `get_class_members(klass)` (L202-207): Recursively collects class attributes including inherited members

## Completion Logic

### Simple Names (L111-136)
1. Matches Python keywords with appropriate spacing/punctuation
2. Searches namespace and built-ins dictionaries
3. Applies callable postfixes automatically

### Attribute Completion (L138-200)
1. Uses regex to parse dotted expressions: `(\w+(\.\w+)*)\.(\w*)`
2. Evaluates object path using `eval()` in target namespace
3. Introspects object with `dir()` plus class members
4. Handles privacy levels (public, single-underscore, double-underscore)
5. Special handling for properties to avoid unwanted evaluation

## Dependencies & Integration
- **Standard Libraries**: `atexit`, `builtins`, `inspect`, `keyword`, `re`, `__main__`
- **Optional**: `readline` module (gracefully degrades if unavailable)
- **Auto-setup**: Registers default completer and cleanup handler when readline is available (L209-218)

## Architecture Notes
- Lazy namespace binding: `__main__.__dict__` resolved at completion time, not initialization
- Exception safety: All completion errors are silently ignored to prevent readline interference
- Security consideration: Attribute completion can trigger `__getattr__` hooks during evaluation
- Memory management: Cleanup registered via `atexit` to prevent reference cycles

## Critical Behavior
- Empty text input inserts tab character when readline available
- Progressive completion via state parameter (0, 1, 2, ... until None returned)
- Privacy-aware completion with fallback logic for underscore-prefixed attributes
- Property detection prevents unwanted method evaluation during completion