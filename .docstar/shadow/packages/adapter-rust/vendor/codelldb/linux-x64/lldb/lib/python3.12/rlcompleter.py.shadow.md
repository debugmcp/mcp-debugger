# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/rlcompleter.py
@source-hash: fee9ad9c55529be4
@generated: 2026-02-09T18:09:55Z

**Purpose**: Python module providing intelligent tab completion for GNU readline, supporting keyword, builtin, and namespace-aware attribute completion.

**Core Components:**

**Completer Class (L41-200)**
- Primary completion engine with namespace-aware completion logic
- `__init__(namespace=None)` (L42-67): Configures completion namespace, defaults to `__main__.__dict__`
- `complete(text, state)` (L69-98): Main completion entry point called by readline with incremental state
- `global_matches(text)` (L111-136): Handles simple name completion (keywords, builtins, namespace vars)  
- `attr_matches(text)` (L138-200): Handles dotted attribute completion with expression evaluation
- `_callable_postfix(val, word)` (L100-109): Adds parentheses to callable completions

**Helper Functions:**
- `get_class_members(klass)` (L202-207): Recursively collects class attributes including inheritance chain

**Key Dependencies:**
- `readline`: GNU readline library integration (optional, L209-219)
- `__main__`: Default namespace for completions
- `builtins`, `keyword`, `inspect`: Core completion sources

**Architecture Patterns:**
- Lazy namespace binding: Defers `__main__.__dict__` binding until completion time
- State-based iteration: Returns successive matches via state parameter
- Safe evaluation: Uses `eval()` for attribute chains but limits to simple dot notation
- Graceful fallback: Works without readline, provides tab insertion

**Critical Behaviors:**
- Expression evaluation risk: `eval(expr, self.namespace)` (L155) can execute arbitrary code via `__getattr__` hooks
- Keyword formatting: Adds colons to `finally`/`try`, spaces to other keywords (L124-129)
- Private attribute filtering: Uses noprefix logic to control underscore visibility (L168-198)
- Callable detection: Adds parentheses to functions, closes for parameter-less functions (L101-107)

**Initialization Side Effects:**
- Auto-configures readline completer on import if available (L214)
- Registers cleanup handler to release references at shutdown (L218)