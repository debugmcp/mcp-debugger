# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/re/_parser.py
@source-hash: a51a85b37cf3f44b
@generated: 2026-02-09T18:11:28Z

## Purpose and Responsibility
Internal support module for Python's regular expression engine that converts re-style regular expressions to sre pattern format. Handles tokenization, parsing, and compilation of regex patterns into internal AST representation.

## Key Constants and Data Structures
- Character sets: `SPECIAL_CHARS` (L17), `REPEAT_CHARS` (L18), `DIGITS/OCTDIGITS/HEXDIGITS` (L20-24)
- Escape sequences: `ESCAPES` (L31-40) - basic character escapes, `CATEGORIES` (L42-53) - pattern categories like \d, \w
- Flag mappings: `FLAGS` (L55-66) - regex flag characters to constants, `TYPE_FLAGS/GLOBAL_FLAGS` (L68-69)

## Core Classes

### State (L75-110)
Manages parsing state including flags, group definitions, and width tracking.
- `__init__` (L77): Initializes flags, groupdict, groupwidths, lookbehindgroups
- `opengroup/closegroup` (L86-99): Group lifecycle management with validation
- `checkgroup/checklookbehindgroup` (L100-109): Group reference validation

### SubPattern (L111-228)  
Represents intermediate parsed pattern structure with debugging and width calculation.
- `__init__` (L113): Takes state and optional data list
- `dump` (L120): Debug output with nested indentation for pattern visualization
- `getwidth` (L178): Calculates min/max character width bounds for optimization

### Tokenizer (L230-311)
Handles pattern string tokenization with escape sequence processing.
- `__init__` (L231): Handles both str/bytes input, maintains position tracking
- `get/match` (L261-264): Token consumption methods
- `getwhile/getuntil` (L265-289): Specialized token collection
- `error` (L299): Creates positioned error messages

## Core Parsing Functions

### `_escape` (L372-447)
Processes escape sequences in main pattern context. Handles hex/unicode/octal escapes, group references, and category shortcuts. Returns tuple of (opcode, value).

### `_class_escape` (L312-370)  
Processes escape sequences within character class context. Similar to `_escape` but with character class specific rules.

### `_parse` (L512-891)
Main pattern parsing engine. Handles:
- Literals and special characters (L547-549)
- Character classes `[...]` (L550-637) 
- Quantifiers `*+?{}` (L639-704)
- Groups `(...)` with extensive option handling (L709-872)
- Anchors `^$` (L874-878)

### `_parse_sub` (L452-510)
Handles alternation (`|`) parsing with optimization for common prefixes and character sets.

### `_parse_flags` (L893-951)
Processes inline flag syntax `(?flags)` with validation for flag compatibility.

## Entry Points

### `parse` (L969-994)
Main entry point that orchestrates full pattern parsing:
1. Creates Tokenizer and State
2. Calls `_parse_sub` for main parsing
3. Validates group references
4. Optional debug output

### `parse_template` (L996-1080)
Parses replacement strings for `re.sub()`, handling group references and escape sequences.

## Architectural Patterns
- Recursive descent parser with lookahead
- AST-based intermediate representation via SubPattern
- Extensive error handling with position tracking  
- Optimization passes (common prefix extraction, character set consolidation)
- Separate handling for str vs bytes patterns

## Critical Invariants
- Group numbers must be < MAXGROUPS
- Width calculations must not exceed MAXWIDTH
- Lookbehind groups cannot reference forward groups
- Type flags (ASCII/LOCALE/UNICODE) are mutually exclusive