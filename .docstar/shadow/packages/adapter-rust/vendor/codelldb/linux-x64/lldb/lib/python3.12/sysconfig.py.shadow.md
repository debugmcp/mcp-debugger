# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/sysconfig.py
@source-hash: 11422a6dbcaa7e46
@generated: 2026-02-09T18:10:14Z

## Python sysconfig Module - System Configuration Information

**Core Purpose**: Provides comprehensive access to Python's build-time and installation configuration information, including installation paths, compiler flags, and platform-specific settings.

### Key Configuration Data Structures

- **`_INSTALL_SCHEMES` (L27-99)**: Central dictionary defining installation path schemes for different platforms (posix_prefix, nt, posix_venv, nt_venv, etc.) with template variables for stdlib, purelib, platlib, include, scripts, and data paths
- **`_CONFIG_VARS` (L178)**: Global dictionary cache for configuration variables, protected by `_CONFIG_VARS_LOCK` (L177) for thread safety
- **`_ALWAYS_STR` (L23-25)**: Set of configuration keys that should never be converted to integers (e.g., MACOSX_DEPLOYMENT_TARGET)

### Platform Detection & Path Resolution

- **`get_platform()` (L743-821)**: Complex platform detection logic handling Windows (win-amd64, win-arm64), POSIX systems, cross-compilation scenarios, and special cases for Solaris, AIX, Cygwin, Darwin
- **`_getuserbase()` (L110-131)**: Determines user-specific installation base directory with platform-specific logic for Windows, macOS framework builds, and POSIX systems
- **`is_python_build()` (L224-232)**: Detects if running from Python source tree by checking for Setup files

### Core Configuration APIs

- **`get_config_vars(*args)` (L704-731)**: Thread-safe lazy initialization of configuration variables with optional argument filtering
- **`get_paths(scheme, vars, expand)` (L619-628)** & **`get_path(name, scheme, vars, expand)` (L631-636)**: Retrieve installation paths for specified schemes with variable expansion
- **`get_preferred_scheme(key)` (L304-313)** & **`get_default_scheme()` (L316-317)**: Platform-aware scheme selection with virtual environment detection

### Configuration Parsing Infrastructure

- **`_parse_makefile(filename, vars, keep_unresolved)` (L320-445)**: Complex Makefile parser handling variable interpolation, recursive expansion, and PY_ prefix handling for renamed variables (CFLAGS, LDFLAGS, CPPFLAGS)
- **`parse_config_h(fp, vars)` (L563-594)**: Parses C header files for #define and #undef directives
- **`_init_posix(vars)` (L532-538)** & **`_init_non_posix(vars)` (L540-556)**: Platform-specific initialization routines

### Build System Integration

- **`_generate_posix_vars()` (L469-530)**: Generates sysconfigdata module during Python build process, handling Darwin-specific module mocking and pybuilddir.txt creation
- **`get_makefile_filename()` (L448-458)** & **`get_config_h_filename()` (L597-606)**: Locate build configuration files with multiarch support

### Variable Expansion System

- **`_subst_vars(s, local_vars)` (L249-256)** & **`_expand_vars(scheme, vars)` (L266-281)**: Template variable substitution with environment fallback
- **`expand_makefile_vars(s, vars)` (L828-851)**: Recursive Makefile-style variable expansion using regex patterns `_findvar1_rx` and `_findvar2_rx` (L186-187)

### Dependencies & Integration Points

- Threading support via `threading.RLock` for configuration variable initialization
- Platform-specific modules: `_osx_support`, `_aix_support`, `_imp`
- File system operations with robust path handling via `_safe_realpath()` (L190-194)
- Environment variable integration for cross-compilation and customization

### Key Constants & Computed Values

- Version variables: `_PY_VERSION_SHORT` (L170), `_PY_VERSION_SHORT_NO_DOT` (L171)
- Path constants: `_PREFIX`, `_BASE_PREFIX`, `_EXEC_PREFIX`, `_PROJECT_BASE` (L172-175, L197-222)
- Regex patterns for Makefile parsing: `_variable_rx`, `_findvar1_rx`, `_findvar2_rx` (L185-187)