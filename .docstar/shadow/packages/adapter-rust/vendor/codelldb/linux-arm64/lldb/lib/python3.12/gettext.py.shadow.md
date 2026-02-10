# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/gettext.py
@source-hash: a5c249a522b6b8e3
@generated: 2026-02-09T18:08:59Z

## Python Internationalization/Localization (gettext) Module

**Primary Purpose**: GNU gettext-compatible internationalization and localization support for Python programs. Provides message catalog loading, translation lookup, and plural form handling for multilingual applications.

**Core Architecture**:
- Two main translation classes with fallback chain support
- C-style plural expression parser that compiles to Python functions  
- Domain-based catalog management with locale directory resolution
- Lazy loading cache for .mo file translation objects

### Key Classes

**NullTranslations (L266-322)**: Base translation class that provides no-op translation behavior. Returns messages unchanged and implements fallback chain pattern.
- `gettext()`, `ngettext()`, `pgettext()`, `npgettext()` (L283-307): Core translation methods
- `add_fallback()` (L277-281): Builds fallback chain for missing translations
- `install()` (L315-322): Injects translation functions into builtins namespace

**GNUTranslations (L324-476)**: Concrete implementation that parses GNU .mo binary files. Handles metadata extraction, plural forms, and context-sensitive translations.
- `_parse()` (L340-427): Reads .mo file format, extracts catalog and metadata
- Magic numbers: LE_MAGIC=0x950412de, BE_MAGIC=0xde120495 (L326-327)
- Context encoding: CONTEXT="%s\x04%s" for msgctxt separation (L331)
- Binary struct parsing with endianness detection
- Plural form compilation via `c2py()` function

### Critical Functions

**c2py() (L188-222)**: Compiles C-style plural expressions from .mo files into Python functions. Implements security limits (1000 char max, 20 nesting depth) to prevent code injection.

**find() (L479-512)**: Locates .mo files using gettext search strategy. Checks environment variables (LANGUAGE, LC_ALL, LC_MESSAGES, LANG) and expands locale components.

**translation() (L519-550)**: Factory function that creates translation objects with caching. Uses global `_translations` dict (L516) for .mo file reuse.

**_expand_lang() (L224-263)**: Expands locale strings into component combinations (language, territory, codeset, modifier) for fallback resolution.

### Plural Expression Parser (L73-222)

Tokenizer and recursive descent parser for C-style plural expressions:
- `_tokenize()` (L87-96): Regex-based lexical analysis
- `_parse()` (L118-165): Recursive descent with operator precedence  
- `_token_pattern` (L73-84): Supports subset of C operators
- Operator precedence table `_binary_ops` (L106-114)
- C-to-Python operator translation `_c2py_ops` (L115)

### Global State Management

- `_current_domain` (L561): Default domain for module-level functions
- `_localedirs` (L559): Domain-to-directory mappings  
- `_translations` (L516): Translation object cache
- `_default_localedir` (L62): System locale directory

### Module-Level API

High-level convenience functions that operate on current domain:
- `gettext()`, `ngettext()`, `pgettext()`, `npgettext()` (L616-629)
- Domain-specific variants: `dgettext()`, `dngettext()`, `dpgettext()`, `dnpgettext()` (L578-613)
- Configuration: `textdomain()`, `bindtextdomain()`, `install()` (L564-555)

### Security Considerations

- Plural expression length limited to 1000 characters
- Nesting depth limited to 20 levels  
- Only safe subset of C operators supported
- exec() used with controlled namespace for plural compilation

### Dependencies

- `operator`, `os`, `re`, `sys` (L49-52)
- Delayed imports: `struct` (L344), `locale` (L225), `copy` (L544), `warnings` (L175)