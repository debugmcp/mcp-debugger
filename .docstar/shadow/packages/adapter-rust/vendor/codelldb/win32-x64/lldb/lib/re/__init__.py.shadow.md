# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/re/__init__.py
@source-hash: 8ff3c37c63b917fc
@generated: 2026-02-09T18:11:21Z

**Primary Purpose**: Python's `re` module - the standard regular expression interface that provides Perl-compatible regex operations for pattern matching, searching, and text manipulation.

**Core Components**:

- **RegexFlag Enum (L141-156)**: Defines regex compilation flags including ASCII, IGNORECASE, LOCALE, MULTILINE, DOTALL, VERBOSE, UNICODE, plus experimental TEMPLATE and DEBUG flags
- **Public API Functions (L164-246)**: Complete regex interface including:
  - `match()` (L164): Pattern matching at string start
  - `fullmatch()` (L169): Full string pattern matching  
  - `search()` (L174): Pattern search anywhere in string
  - `sub()/subn()` (L179-197): Pattern substitution with/without count
  - `split()` (L199): Pattern-based string splitting
  - `findall()/finditer()` (L209-224): Find all matches as list/iterator
  - `compile()` (L226): Explicit pattern compilation
  - `purge()` (L230): Cache clearing
  - `template()` (L236): Deprecated template compilation
  - `escape()` (L255): Special character escaping

**Key Dependencies**:
- `_compiler`: Core compilation engine from SRE
- `_parser`: Pattern parsing functionality  
- `_sre`: Low-level C extension module
- `enum`: For flag definitions
- `functools`: For LRU caching
- `copyreg`: For pickle support

**Internal Architecture**:

- **Dual Caching System (L274-329)**: 
  - `_cache`: LRU cache (512 entries) for better hit rates
  - `_cache2`: FIFO cache (256 entries) for better latency
  - `_compile()` function manages both caches with eviction policies

- **Template Compilation (L331-334)**: LRU-cached template pattern compilation using `_sre.template()`

- **Type Definitions (L265-266)**: Dynamic creation of Pattern and Match types from compiled empty pattern

- **Scanner Class (L348-385)**: Experimental lexical scanner that combines multiple patterns into compound regex for tokenization

**Critical Patterns**:
- All public functions delegate to `_compile()` which handles caching and returns compiled Pattern objects
- Flags can be passed as RegexFlag enum or integer values (converted in `_compile()`)
- Error handling preserves original SRE exceptions via `error = _compiler.error` (L159)
- Pickle support registered for Pattern objects via `copyreg` (L340-343)

**Special Features**:
- Comprehensive regex syntax documentation in module docstring (L17-122)
- Special character mapping for escape function (L253)
- Deprecation warnings for TEMPLATE flag and template() function
- Global enum registration for RegexFlag enabling direct flag access