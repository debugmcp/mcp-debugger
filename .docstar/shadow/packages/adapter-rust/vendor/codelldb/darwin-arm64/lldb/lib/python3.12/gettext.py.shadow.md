# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/gettext.py
@source-hash: a5c249a522b6b8e3
@generated: 2026-02-09T18:07:21Z

## Purpose and Responsibility

This is Python's standard `gettext` module that provides internationalization (I18N) and localization (L10N) support by interfacing with GNU gettext message catalog library. It handles loading .mo translation files, managing translation objects, and providing message translation functions.

## Key Classes

**NullTranslations (L266-322)**: Base translation class that provides no-op translation (returns original messages). Implements fallback chain pattern and basic translation API including `gettext()`, `ngettext()`, `pgettext()`, and `npgettext()`. Contains `install()` method (L315-321) to inject translation functions into builtins.

**GNUTranslations (L324-476)**: Full-featured translation class that parses GNU .mo format files. Key attributes include magic numbers for endianness detection (L326-327), context separator (L331), and version support (L334). The `_parse()` method (L340-427) handles binary .mo file parsing, including header validation, message extraction, and plural form processing. Translation methods (L429-475) perform catalog lookups with fallback support.

## Key Functions

**Plural Form Processing**: 
- `c2py()` (L188-221): Converts C-style plural expressions to Python functions using recursive descent parser
- `_tokenize()` (L87-96) and `_parse()` (L118-165): Tokenization and parsing of plural form expressions
- `_as_int()` (L168-185): Type checking with deprecation warnings for non-integer plural values

**File Location and Loading**:
- `find()` (L479-512): Locates .mo files using gettext search strategy with environment variable support
- `translation()` (L519-550): Loads and caches translation objects, supports fallback chains
- `_expand_lang()` (L224-263): Expands locale strings into component variations

**Global Translation Interface**:
- `textdomain()`/`bindtextdomain()` (L564-575): Domain management functions
- `gettext()`, `ngettext()`, `pgettext()`, `npgettext()` (L616-629): Global translation functions using current domain
- Domain-specific variants: `dgettext()`, `dngettext()`, `dpgettext()`, `dnpgettext()` (L578-613)
- `install()` (L553-555): Convenience function to install translation in global namespace

## Important Dependencies and State

**Module-level State**:
- `_default_localedir` (L62): Default locale directory path
- `_translations` (L516): Cache mapping (class, filepath) -> translation objects
- `_localedirs` (L559): Domain to locale directory mapping
- `_current_domain` (L561): Global current domain for translation functions

**External Dependencies**: `operator`, `os`, `re`, `sys`, `struct` (delayed import), `locale` (delayed import), `warnings`, `builtins`

## Notable Patterns and Architecture

**Fallback Chain Pattern**: Translation objects can chain fallbacks using `add_fallback()` method, allowing graceful degradation through multiple translation sources.

**Caching Strategy**: Translation objects are cached by (class, absolute_path) to avoid repeated file parsing. Uses copy-on-use pattern to allow per-instance customization while sharing parsed data.

**Lazy Imports**: Several imports (`struct`, `locale`, `copy`, `warnings`) are delayed until needed to speed up module loading.

**Binary Format Handling**: Robust .mo file parsing with endianness detection, version checking, and corruption detection.

## Critical Invariants and Constraints

- Plural form expressions limited to 1000 characters and 20 nesting levels to prevent DoS
- Only supports GNU .mo format versions 0 and 1
- Message catalogs must use consistent character encoding throughout
- Context-aware messages use `\x04` separator following gettext >= 0.15 convention
- All translation methods preserve fallback chains and handle missing translations gracefully