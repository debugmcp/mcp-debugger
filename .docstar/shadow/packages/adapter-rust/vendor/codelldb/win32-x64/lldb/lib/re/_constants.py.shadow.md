# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/re/_constants.py
@source-hash: fa4fdb200f238f9e
@generated: 2026-02-09T18:11:22Z

## Regular Expression Engine Constants Module

**Primary Purpose:** Internal constants and types module for Python's SRE (Secret Labs' Regular Expression) engine. Defines opcodes, character categories, position markers, flags, and the main exception class used throughout the regex system.

### Key Components

**Core Exception:**
- `error` class (L23-53): Main exception for regex compilation/execution errors. Provides detailed error context including position, line/column numbers for both string and bytes patterns. Sets `__module__ = 're'` to appear as `re.error`.

**Named Integer Constants:**
- `_NamedIntConstant` class (L56-65): Custom int subclass that preserves symbolic names for debugging. Overrides `__repr__` to show name instead of numeric value, disables pickling via `__reduce__ = None`.
- `_makecodes` function (L69-72): Factory that creates sequential named constants and injects them into global namespace.

**Magic Numbers:**
- `MAGIC` (L16): Version identifier `20221023` for SRE bytecode compatibility
- `MAXREPEAT` and `MAXGROUPS` (L18): Core limits imported from C extension `_sre`

**Opcode Categories:**
- `OPCODES` (L75-123): 40+ regex operation codes including basic matching (LITERAL, ANY), assertions (ASSERT, AT), grouping (GROUPREF, SUBPATTERN), quantifiers (REPEAT variants), and case-insensitive variants (*_IGNORE, *_LOC_IGNORE, *_UNI_IGNORE)
- `ATCODES` (L127-135): Position assertion codes (boundaries, string start/end, line boundaries)  
- `CHCODES` (L138-150): Character category codes (digit, space, word, linebreak) with locale and unicode variants

**Operation Mapping Tables:**
- `OP_IGNORE` (L154-157): Maps case-sensitive ops to case-insensitive equivalents
- `OP_LOCALE_IGNORE` (L159-162): Locale-aware case insensitive mappings
- `OP_UNICODE_IGNORE` (L164-167): Unicode-aware case insensitive mappings
- `AT_MULTILINE` (L169-172): Multiline mode position mappings
- `AT_LOCALE`/`AT_UNICODE` (L174-182): Locale/unicode boundary mappings
- `CH_LOCALE`/`CH_UNICODE` (L184-204): Character category locale/unicode mappings

**SRE Flags (L207-220):**
- Pattern compilation flags: IGNORECASE, MULTILINE, DOTALL, VERBOSE, DEBUG, etc.
- INFO primitive flags: PREFIX, LITERAL, CHARSET for optimization hints

**Architecture Notes:**
- Uses global namespace injection pattern via `_makecodes` for constant availability
- Maintains separate constant families for different regex engine subsystems
- Supports incremental regex features (locale, unicode, possessive quantifiers, atomic groups)
- Line 124 explicitly removes parser-only opcodes from runtime opcode list