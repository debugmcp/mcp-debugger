# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/site.py
@source-hash: 339ac97324244537
@generated: 2026-02-09T18:07:28Z

## Primary Purpose

The Python `site` module configures Python's module search path (`sys.path`) by automatically adding site-packages directories during Python initialization. It handles system-wide, user-specific, and virtual environment package locations, enabling third-party package discovery.

## Key Functions and Classes

### Path Management
- **`makepath(*paths)` (L97-103)**: Creates absolute, normalized paths from path components
- **`removeduppaths()` (L129-145)**: Removes duplicate entries from `sys.path` and converts to absolute paths
- **`abs_paths()` (L106-126)**: Converts module `__file__` and `__cached__` attributes to absolute paths for non-frozen modules

### Site Directory Processing
- **`addsitedir(sitedir, known_paths)` (L227-250)**: Adds a directory to `sys.path` and processes `.pth` files within it
- **`addpackage(sitedir, name, known_paths)` (L161-224)**: Processes individual `.pth` files, executing import lines and adding path entries
- **`getsitepackages(prefixes)` (L367-398)**: Returns list of global site-packages directories based on platform
- **`addsitepackages(known_paths, prefixes)` (L400-407)**: Adds all global site-packages directories to `sys.path`

### User Site-Packages
- **`getuserbase()` (L322-332)**: Returns user base directory, platform-specific
- **`getusersitepackages()` (L335-350)**: Returns user-specific site-packages directory
- **`addusersitepackages(known_paths)` (L352-365)**: Adds user site-packages to `sys.path`
- **`check_enableusersite()` (L253-275)**: Security check for user site enabling (UID/GID validation)

### Virtual Environment Support
- **`venv(known_paths)` (L508-560)**: Detects and configures virtual environment settings via `pyvenv.cfg`

### Interactive Features
- **`setquit()` (L409-422)**: Sets up `quit` and `exit` builtins
- **`setcopyright()` (L425-443)**: Sets up `copyright`, `credits`, and `license` builtins  
- **`sethelper()` (L446-447)**: Sets up `help` builtin
- **`enablerlcompleter()` (L449-506)**: Configures readline tab completion and history

### Customization Hooks
- **`execsitecustomize()` (L563-580)**: Imports and runs `sitecustomize` module if available
- **`execusercustomize()` (L583-600)**: Imports and runs `usercustomize` module if available

### Main Execution
- **`main()` (L603-630)**: Primary initialization function that orchestrates all site configuration
- **`_script()` (L637-689)**: Command-line interface when run as script

## Global Variables

- **`PREFIXES` (L80)**: List of system prefixes for site-packages discovery
- **`ENABLE_USER_SITE` (L83)**: Controls user site-packages inclusion
- **`USER_SITE` (L88)**: User site-packages directory path
- **`USER_BASE` (L89)**: User base directory path

## Key Dependencies

- Standard library modules: `sys`, `os`, `builtins`, `_sitebuiltins`, `io`, `stat`
- Platform-specific path handling for Windows, macOS, and Unix systems
- Security considerations with UID/GID checks on Unix systems

## Critical Patterns

- **Deferred initialization**: User paths computed lazily via global variables
- **Platform abstraction**: Different path structures for Windows vs Unix-like systems
- **Security model**: User site disabled if effective UID != real UID
- **Error resilience**: Graceful handling of missing directories and import failures
- **Performance optimization**: Copied sysconfig functions to avoid import overhead

## Execution Flow

Module automatically executes `main()` on import unless `-S` flag is used. Processing order: duplicate removal → venv detection → user site → global site → interactive setup → customization hooks.