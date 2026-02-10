# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/gettext.py
@source-hash: a5c249a522b6b8e3
@generated: 2026-02-09T18:12:58Z

## Core Purpose
Python gettext internationalization module providing translation services for multi-language program support. Implements GNU gettext-compatible message catalog system with .mo file parsing and plural form handling.

## Key Classes

### NullTranslations (L266-322)
Base translation class providing no-op translations that return original strings. Serves as fallback when no translation files are found.
- `gettext()` (L283): Returns original message or delegates to fallback
- `ngettext()` (L288): Handles plural forms with simple n==1 logic
- `pgettext()` (L296): Context-aware translation (returns original)
- `npgettext()` (L301): Context-aware plural translation
- `install()` (L315): Installs translation functions into builtins namespace

### GNUTranslations (L324-476)
Full-featured translation class that parses GNU .mo binary files and provides actual translations.
- Magic numbers: LE_MAGIC/BE_MAGIC (L326-327) for endianness detection
- `_parse()` (L340): Core .mo file parser handling binary format, metadata extraction, and plural form compilation
- Translation methods mirror NullTranslations but lookup from `_catalog` dict
- Supports context separation using "\x04" delimiter (L331)

## Key Functions

### Plural Form Processing
- `c2py()` (L188): Converts C-style plural expressions to Python functions using recursive descent parser
- `_tokenize()` (L87): Tokenizes plural form expressions with regex pattern (L73)
- `_parse()` (L118): Recursive parser converting C operators to Python equivalents

### File Discovery & Loading
- `find()` (L479): Locates .mo files using gettext directory structure and language fallback
- `translation()` (L519): Creates translation objects with caching via `_translations` dict (L516)
- `_expand_lang()` (L224): Expands locale strings into component combinations

### Global API Functions
Module-level functions operating on current domain (`_current_domain`, L561):
- `gettext()`, `ngettext()`, `pgettext()`, `npgettext()` (L616-629)
- Domain-specific variants: `dgettext()`, `dngettext()`, `dpgettext()`, `dnpgettext()` (L578-613)
- `textdomain()` (L564): Sets/gets current translation domain
- `bindtextdomain()` (L571): Associates domains with locale directories
- `install()` (L553): Installs translation functions globally

## Dependencies & Configuration
- Standard library: `os`, `sys`, `re`, `operator`, `struct`, `locale`, `warnings`, `copy`
- Default locale directory: `sys.base_prefix/share/locale` (L62)
- Supports environment variables: LANGUAGE, LC_ALL, LC_MESSAGES, LANG (L485)

## Architecture Patterns
- Fallback chain pattern: translations can chain to fallbacks for missing entries
- Caching strategy: parsed .mo files cached by (class, filepath) key
- Lazy imports: `struct`, `copy`, `locale` imported on-demand for performance
- Parser security: expression length (1000 chars) and depth (20 levels) limits

## Critical Constraints
- .mo file format compatibility with GNU gettext versions 0-1
- Thread safety through immutable catalog dictionaries
- Memory efficiency via catalog sharing between translation instances
- Plural form security validation against malicious expressions