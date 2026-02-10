# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/rlcompleter.py
@source-hash: fee9ad9c55529be4
@generated: 2026-02-09T18:09:03Z

## Purpose
Provides tab completion functionality for GNU readline in Python interactive sessions, supporting keyword, built-in, and attribute completion with namespace evaluation.

## Core Classes

### Completer (L41-200)
Main completion engine with configurable namespace support.

**Constructor (L42-67):**
- Accepts optional namespace dictionary (defaults to `__main__.__dict__`)
- Uses lazy binding - namespace resolved at completion time, not initialization
- Validates namespace is dictionary type

**Key Methods:**
- `complete(text, state)` (L69-98): Primary completion interface called by readline with incremental state
- `global_matches(text)` (L111-136): Handles simple name completion (keywords, builtins, namespace variables)
- `attr_matches(text)` (L138-200): Handles dotted attribute completion with object evaluation
- `_callable_postfix(val, word)` (L100-109): Adds parentheses to callable completions

## Key Functions

### get_class_members(klass) (L202-207)
Recursively collects class members including inherited attributes via `__bases__` traversal.

## Architecture & Patterns

**Completion Strategy:**
- Empty text → insert tab character
- Simple names → keyword + builtin + namespace matching
- Dotted expressions → evaluate prefix, complete attributes

**Security Considerations:**
- Uses `eval()` for attribute completion (L155) - can execute arbitrary code via `__getattr__` hooks
- Filters private attributes based on prefix patterns (`_`, `__`)

**Special Handling:**
- Keywords get contextual suffixes (L124-129): `try:`/`finally:` get colons, others get spaces
- Callable detection adds parentheses, closes if no parameters (L104-105)
- Properties detected to avoid unwanted evaluation (L179-188)

## Dependencies
- **Standard library**: `atexit`, `builtins`, `inspect`, `keyword`, `re`
- **Conditional**: `readline` (graceful degradation if unavailable)
- **Global**: `__main__` for default namespace

## Module Initialization (L209-219)
- Attempts readline import with fallback flag
- Auto-registers default completer instance
- Sets up cleanup handler to release references at shutdown

## Critical Invariants
- Completion state must be tracked in `self.matches` for stateful iteration
- Namespace binding deferred until completion time for dynamic `__main__` updates
- Exception handling suppressed during completion to prevent readline disruption