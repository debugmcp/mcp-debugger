# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/sysconfig.py
@source-hash: 11422a6dbcaa7e46
@generated: 2026-02-09T18:09:19Z

## Purpose & Responsibility

Python's system configuration access module - provides standardized access to Python installation paths, build configuration variables, and platform-specific information. Core component for package installation, build systems, and environment introspection.

## Key Data Structures

- **_INSTALL_SCHEMES (L27-99)**: Multi-platform path templates for Python installations
  - `posix_prefix`, `posix_home`, `nt`: Standard installation schemes
  - `posix_venv`, `nt_venv`, `venv`: Virtual environment schemes (L77-105)
  - `nt_user`, `posix_user`, `osx_framework_user`: User-specific schemes (L134-164)
- **_CONFIG_VARS (L178)**: Global cache for build/configuration variables
- **_ALWAYS_STR (L23-25)**: Variable names never converted to integers

## Core Public APIs

- **get_paths(scheme, vars, expand) (L619-628)**: Returns complete path mapping for installation scheme
- **get_path(name, scheme, vars, expand) (L631-636)**: Returns single path from scheme
- **get_config_vars(*args) (L704-731)**: Thread-safe access to build configuration variables
- **get_config_var(name) (L734-740)**: Single configuration variable lookup
- **get_platform() (L743-821)**: Platform identification string generation
- **get_scheme_names() (L609-611)**: Available installation scheme names
- **parse_config_h(fp, vars) (L563-594)**: Parse C header configuration files

## Path Resolution & Variable Expansion

- **_expand_vars(scheme, vars) (L266-281)**: Expands path templates with configuration variables
- **_subst_vars(s, local_vars) (L249-256)**: Variable substitution with fallback to environment
- **expand_makefile_vars(s, vars) (L828-851)**: Makefile-style variable expansion

## Configuration Loading

- **_init_config_vars() (L639-701)**: Lazy initialization of configuration cache
- **_init_posix(vars) (L532-538)**: POSIX-specific configuration loading via sysconfigdata
- **_init_non_posix(vars) (L540-556)**: Windows-specific configuration setup
- **_parse_makefile(filename, vars, keep_unresolved) (L320-445)**: Complex Makefile parser with variable resolution

## Platform Detection & Project Structure

- **_getuserbase() (L110-130)**: Cross-platform user base directory detection
- **is_python_build(check_home) (L224-232)**: Detects development/source builds
- **get_makefile_filename() (L448-458)**: Locates Python's Makefile
- **get_config_h_filename() (L597-606)**: Locates pyconfig.h header

## Threading & Initialization

- **_CONFIG_VARS_LOCK (L177)**: RLock for thread-safe configuration loading
- **_CONFIG_VARS_INITIALIZED (L180)**: Double-checked locking pattern flag

## Architecture Notes

- Lazy initialization pattern with thread safety for configuration variables
- Multi-platform abstraction through scheme-based path templating  
- Complex variable resolution supporting recursive expansion and cross-references
- Special handling for virtual environments and development builds
- Platform-specific customization hooks (Darwin via _osx_support, AIX via _aix_support)
- Environment variable overrides for cross-compilation scenarios