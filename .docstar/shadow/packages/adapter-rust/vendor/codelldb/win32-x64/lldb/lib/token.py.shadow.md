# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/token.py
@source-hash: fc76ed1a1cbdb2c9
@generated: 2026-02-09T18:13:10Z

**Purpose**: Auto-generated Python token constants module providing tokenizer definitions for LLDB's Python integration. Part of the CodeLLDB debugging adapter's embedded Python environment.

**Core Components**:

- **Token Constants (L6-78)**: Integer constants for all Python token types including:
  - Basic tokens: ENDMARKER, NAME, NUMBER, STRING, NEWLINE
  - Delimiters: LPAR/RPAR (parentheses), LSQB/RSQB (square brackets), LBRACE/RBRACE (curly braces)
  - Operators: PLUS, MINUS, STAR, SLASH, and compound assignments (PLUSEQUAL, etc.)
  - Modern Python features: AWAIT, ASYNC, FSTRING_* tokens, TYPE_IGNORE/TYPE_COMMENT
  - Special constants: NT_OFFSET (256) for parser cooperation, N_TOKENS (68) total count

- **tok_name Dictionary (L79-81)**: Dynamic reverse mapping from token values to names, built via globals() introspection

- **EXACT_TOKEN_TYPES Dictionary (L84-133)**: Maps literal string representations to token constants for precise tokenization (e.g., '!=' → NOTEQUAL, '**=' → DOUBLESTAREQUAL)

- **Classification Functions**:
  - `ISTERMINAL(x)` (L135-136): Returns True if token is terminal (< NT_OFFSET)
  - `ISNONTERMINAL(x)` (L138-139): Returns True if token is non-terminal (>= NT_OFFSET)  
  - `ISEOF(x)` (L141-142): Returns True if token is end marker

**Dependencies**: None - pure constants module

**Architecture**: Standard Python tokenizer implementation following CPython's token module structure. Auto-generated nature ensures consistency with parser expectations.

**Key Invariants**:
- Token values are unique integers
- NT_OFFSET (256) separates terminals from non-terminals
- EXACT_TOKEN_TYPES provides bidirectional string/constant mapping
- All public constants exported via __all__