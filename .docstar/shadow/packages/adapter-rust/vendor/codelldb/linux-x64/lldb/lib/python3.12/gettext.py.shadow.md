# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/gettext.py
@source-hash: a5c249a522b6b8e3
@generated: 2026-02-09T18:09:50Z

## Python gettext Module - Internationalization & Localization Support

This is Python's standard library `gettext` module providing internationalization (I18N) and localization (L10N) capabilities by interfacing with GNU gettext message catalogs (.mo files).

### Core Architecture

**Translation Classes:**
- `NullTranslations` (L266-322): Base translation class that provides pass-through behavior when no translations are available. Maintains fallback chain and basic translation interface.
- `GNUTranslations` (L324-475): Concrete implementation that parses GNU .mo files. Handles binary format parsing, plural forms, and context-based translations.

**Key Translation Methods:**
- `gettext(message)` (L283, L429): Basic string translation
- `ngettext(msgid1, msgid2, n)` (L288, L440): Plural-form aware translation
- `pgettext(context, message)` (L296, L452): Context-sensitive translation
- `npgettext(context, msgid1, msgid2, n)` (L301, L464): Context-sensitive plural translation

### Plural Form Processing

**Expression Parser (L73-222):**
- `_tokenize(plural)` (L87): Tokenizes C-style plural expressions from .mo files
- `_parse(tokens, priority)` (L118): Recursive descent parser converting C expressions to Python
- `c2py(plural)` (L188): Main converter function creating executable Python functions from C plural expressions
- Security limits: max 1000 chars, max 20 nested parentheses, recursion protection

### File Discovery & Loading

**Translation Discovery:**
- `find(domain, localedir, languages, all)` (L479): Locates .mo files using gettext search strategy
- `_expand_lang(loc)` (L224): Expands locale strings into search variants (language, territory, codeset, modifier)
- Environment variable precedence: LANGUAGE > LC_ALL > LC_MESSAGES > LANG

**Translation Management:**
- `translation(domain, localedir, languages, class_, fallback)` (L519): Factory function creating translation objects with caching
- `_translations` (L516): Global cache mapping (class, filepath) -> Translation objects
- Fallback chaining for missing translations

### Global API Functions

**Domain Management:**
- `textdomain(domain)` (L564): Get/set current global domain
- `bindtextdomain(domain, localedir)` (L571): Bind domain to locale directory

**Translation Functions:**
- `dgettext/dngettext/dpgettext/dnpgettext` (L578-613): Domain-specific translation functions
- `gettext/ngettext/pgettext/npgettext` (L616-629): Current domain translation functions
- `install(domain, localedir, names)` (L553): Installs translation functions into builtins

### File Format Support

**GNU .mo File Format (L325-427):**
- Magic numbers: `LE_MAGIC = 0x950412de`, `BE_MAGIC = 0xde120495`
- Supports versions 0 and 1
- Binary format parsing with endianness detection
- Metadata extraction from empty msgid (Content-Type, Plural-Forms)
- Context encoding using `"\x04"` separator (L331)

### Dependencies & Configuration

- **External:** `os`, `sys`, `re`, `operator`, `locale`, `struct` (lazy import)
- **Default locale dir:** `{sys.base_prefix}/share/locale` (L62)
- **Backwards compatibility:** `Catalog = translation` alias (L646)

### Security Considerations

- Input validation for plural expressions (length, complexity, recursion depth)
- Safe execution of generated plural functions in controlled namespace
- File corruption detection in .mo parsing