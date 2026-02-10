# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/gettext.py
@source-hash: a5c249a522b6b8e3
@generated: 2026-02-09T18:08:23Z

## Purpose & Responsibility
Python's standard internationalization (i18n) and localization (l10n) module, providing GNU gettext message catalog support for translating programs. Handles loading .mo files, plural form processing, and text domain management for multilingual applications.

## Key Classes & Functions

### Core Translation Classes
- **`NullTranslations` (L266-322)**: Base translation class providing pass-through behavior when no translations exist. Implements fallback chain pattern and basic translation methods (`gettext`, `ngettext`, `pgettext`, `npgettext`).
- **`GNUTranslations` (L324-476)**: Main translation class that parses GNU .mo binary files. Handles magic number validation (L326-327), version checking (L334-338), and catalog loading with charset detection.

### Plural Form Processing
- **`c2py()` (L188-222)**: Converts C-style plural form expressions from .mo files into Python functions. Includes expression validation, complexity limits, and runtime compilation.
- **`_tokenize()` (L87-96)**: Tokenizer for plural form expressions using regex pattern (L73-84).
- **`_parse()` (L118-165)**: Recursive descent parser converting C operators to Python equivalents with precedence handling.

### File Discovery & Loading
- **`find()` (L479-512)**: Locates .mo files using gettext search strategy. Processes environment variables (`LANGUAGE`, `LC_ALL`, etc.) and expands locale variants.
- **`_expand_lang()` (L224-263)**: Expands locale codes into all possible combinations (language, territory, codeset, modifier).
- **`translation()` (L519-550)**: Factory function creating translation objects with caching mechanism (L516, L534-538).

### Global API Functions
- **Domain management**: `textdomain()` (L564-568), `bindtextdomain()` (L571-575)
- **Translation functions**: `gettext()` (L616-617), `ngettext()` (L620-621), `pgettext()` (L624-625), `npgettext()` (L628-629)
- **Domain-specific variants**: `dgettext()` (L578-583), `dngettext()` (L586-594), etc.
- **`install()` (L553-555)**: Installs translation functions into builtins namespace

## Key Dependencies & Architecture
- **Standard library**: `os`, `sys`, `re`, `operator`, `struct` (lazy-loaded), `locale`, `warnings`
- **File format**: GNU .mo binary format with little/big endian support
- **Caching**: Global translation cache `_translations` (L516) prevents redundant file parsing
- **Fallback pattern**: Translation objects can chain fallbacks for graceful degradation

## Important Constants & Patterns
- **Default locale directory**: `_default_localedir` (L62) points to system locale directory
- **Magic numbers**: `LE_MAGIC = 0x950412de`, `BE_MAGIC = 0xde120495` (L326-327)
- **Context separator**: `CONTEXT = "%s\x04%s"` (L331) for contextual translations
- **Global state**: `_current_domain`, `_localedirs` (L559-561) for domain management

## Critical Invariants
- .mo file parsing validates magic numbers and version compatibility
- Plural form expressions limited to 1000 chars and 20 nesting levels for security
- All text converted to Unicode using detected charset (defaults to ASCII)
- Translation objects are cached by (class, absolute_path) tuples to prevent redundant parsing
- Fallback chains allow graceful degradation when translations missing