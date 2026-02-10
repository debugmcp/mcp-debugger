# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/sysconfig.py
@source-hash: 11422a6dbcaa7e46
@generated: 2026-02-09T18:08:12Z

**Primary Purpose**: Python's sysconfig module provides access to Python installation configuration information, paths, and build-time variables. This is a core module for determining where Python files should be installed and retrieving build configuration.

**Key Constants & Data Structures**:
- `_INSTALL_SCHEMES` (L27-99): Master dictionary defining installation path schemes for different platforms (posix_prefix, posix_home, nt, posix_venv, nt_venv)
- `_ALWAYS_STR` (L23-25): Set of config variables that should never be converted to integers
- `_SCHEME_KEYS` (L166-167): Tuple of valid path types (stdlib, platstdlib, purelib, etc.)
- Global config variables (L169-181): Pre-computed version strings and path constants

**Core Path Resolution Functions**:
- `get_paths()` (L619-629): Returns mapping of installation paths for a scheme, with optional variable expansion
- `get_path()` (L631-637): Returns single path for given scheme and path name
- `_expand_vars()` (L266-281): Expands template variables in scheme paths using config vars
- `get_default_scheme()` (L316-317): Returns appropriate default scheme for current platform
- `get_preferred_scheme()` (L304-313): Platform-specific scheme selection with venv detection

**Configuration Variable Management**:
- `get_config_vars()` (L704-731): Thread-safe lazy initialization of build configuration variables
- `get_config_var()` (L734-740): Single variable accessor
- `_init_config_vars()` (L639-701): Initializes global _CONFIG_VARS with platform-specific values
- Thread safety via `_CONFIG_VARS_LOCK` (L177) and double-checked locking pattern

**Platform Detection**:
- `get_platform()` (L743-821): Comprehensive platform string generation (e.g., "linux-x86_64", "win-amd64")
- `is_python_build()` (L224-232): Detects if running from Python source build
- Platform-specific initialization: `_init_posix()` (L532-538), `_init_non_posix()` (L540-556)

**File Parsing Utilities**:
- `_parse_makefile()` (L320-445): Complex parser for Makefile-style variable definitions with recursive variable expansion
- `parse_config_h()` (L563-594): Parser for C preprocessor config headers
- `expand_makefile_vars()` (L828-851): Variable expansion utility for Makefile-style variables

**User Base Directory**:
- `_getuserbase()` (L110-130): Platform-specific user base directory detection with environment override support

**Build System Integration**:
- `_generate_posix_vars()` (L469-530): Generates sysconfigdata module during Python build process
- `get_makefile_filename()` (L448-458): Locates Python's Makefile for current installation

**Architecture Notes**:
- Lazy initialization pattern for expensive config var computation
- Thread-safe singleton for config variables using RLock
- Template-based path expansion system with recursive variable resolution
- Platform abstraction through scheme-based configuration
- Special handling for virtual environments via venv schemes
- Cross-compilation support through environment variable overrides