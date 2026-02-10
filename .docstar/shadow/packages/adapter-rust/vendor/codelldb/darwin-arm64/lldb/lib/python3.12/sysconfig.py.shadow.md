# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/sysconfig.py
@source-hash: 11422a6dbcaa7e46
@generated: 2026-02-09T18:07:31Z

## Primary Purpose
Python's system configuration module that provides access to installation paths, build-time configuration variables, and platform-specific information. This is the core module used to determine where Python components should be installed and retrieve build configuration data.

## Key Components

### Installation Schemes (L27-99)
- `_INSTALL_SCHEMES`: Dictionary defining path templates for different installation types
  - `posix_prefix`, `posix_home`, `nt`: Standard platform schemes
  - `posix_venv`, `nt_venv`, `venv`: Virtual environment schemes (L77-105)
  - User-specific schemes: `nt_user`, `posix_user`, `osx_framework_user` (L134-164)
- Each scheme maps path types (`stdlib`, `purelib`, `platlib`, `include`, `scripts`, `data`) to template strings

### Configuration Variables Management
- `_CONFIG_VARS`: Global dictionary storing build-time configuration (L178)
- `_CONFIG_VARS_LOCK`: Thread-safe initialization mutex (L177)
- `_init_config_vars()` (L639-701): Initializes configuration variables from system state
- `get_config_vars()` (L704-731): Thread-safe accessor with lazy initialization
- `get_config_var()` (L734-740): Single variable accessor

### Path Resolution Functions
- `get_paths()` (L619-628): Returns complete path mapping for a scheme
- `get_path()` (L631-636): Returns single path for a scheme
- `_expand_vars()` (L266-281): Expands template variables in path strings
- `_subst_vars()` (L249-256): Substitutes variables with fallback to environment

### Scheme Selection Logic
- `get_default_scheme()` (L316-317): Returns platform's default installation scheme
- `get_preferred_scheme()` (L304-313): Selects scheme based on context (venv detection)
- `_get_preferred_schemes()` (L284-301): Platform-specific scheme mappings

### Configuration File Parsing
- `_parse_makefile()` (L320-445): Parses Makefile-style configuration files with variable interpolation
- `parse_config_h()` (L563-594): Parses C header configuration files
- Complex variable expansion logic handling `$(VAR)` and `${VAR}` syntax (L371-436)

### Platform Detection
- `get_platform()` (L743-821): Generates platform identifier string
- Platform-specific logic for Windows (L764-771), Linux (L790-794), Solaris (L795-804), AIX (L805-807), Cygwin (L808-814), Darwin (L815-820)

### Build System Integration
- `is_python_build()` (L224-232): Detects if running from Python source build
- `_generate_posix_vars()` (L469-530): Generates sysconfigdata module for POSIX builds
- `get_makefile_filename()` (L448-458): Locates Python's Makefile

### User Base Directory
- `_getuserbase()` (L110-130): Determines user-specific installation directory
- Platform-specific user directory logic (Windows: `APPDATA/Python`, macOS framework, POSIX: `~/.local`)

## Critical Constants
- `_SCHEME_KEYS` (L166): Valid path type names
- `_ALWAYS_STR` (L23): Configuration variables never converted to integers
- Version variables: `_PY_VERSION_SHORT`, `_PY_VERSION_SHORT_NO_DOT` (L170-171)
- Base directories: `_PREFIX`, `_EXEC_PREFIX`, `_PROJECT_BASE` (L172-175)

## Dependencies
- Standard library: `os`, `sys`, `threading`, `re`
- Platform-specific modules: `_osx_support`, `_aix_support` (conditional imports)
- Build-time generated: `_sysconfigdata_*` modules (dynamic import)

## Architectural Patterns
- Lazy initialization with double-checked locking for configuration variables
- Template-based path generation with variable substitution
- Platform abstraction through scheme selection
- Thread-safe global state management
- Fallback mechanisms for missing configuration files

## Key Invariants
- Configuration variables are initialized exactly once per process
- Path templates must contain valid substitution variables
- Virtual environment detection affects scheme selection
- User base directory calculation is platform-dependent but consistent