# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/site.py
@source-hash: 339ac97324244537
@generated: 2026-02-09T18:13:22Z

## Python Site Module - Path Configuration and Initialization

**Primary Purpose**: Core Python module responsible for automatically configuring `sys.path` with site-specific package directories during interpreter startup. Handles virtual environments, user site-packages, .pth file processing, and interactive shell enhancements.

### Key Constants & Global State (L80-89)
- `PREFIXES`: List of base directories for site-packages (`[sys.prefix, sys.exec_prefix]`)
- `ENABLE_USER_SITE`: Controls user site-packages inclusion (None/True/False)
- `USER_SITE`, `USER_BASE`: Cached paths for user-specific directories

### Core Path Management Functions

**`makepath(*paths)` (L97-103)**: Creates absolute, normalized paths from path components with OSError handling.

**`removeduppaths()` (L129-145)**: Deduplicates `sys.path` entries, converting relative to absolute paths using case-insensitive comparison on case-insensitive filesystems.

**`abs_paths()` (L106-126)**: Converts all module `__file__` and `__cached__` attributes to absolute paths, only affecting standard importlib-loaded modules.

### .pth File Processing

**`addpackage(sitedir, name, known_paths)` (L161-224)**: Processes individual .pth files within site directories. Handles UTF-8/UTF-8-sig encoding with locale fallback, executes lines starting with "import", adds valid directories to `sys.path`. Includes comprehensive error handling with traceback output.

**`addsitedir(sitedir, known_paths)` (L227-250)**: Adds a site directory to `sys.path` and processes all .pth files within it. Filters for .pth extension and non-hidden files, processes in sorted order.

### Site Directory Discovery

**`getsitepackages(prefixes)` (L367-398)**: Platform-aware discovery of site-packages directories. On Unix-like systems, uses `sys.platlibdir` (typically "lib") and version-specific paths. On Windows, uses direct prefix paths and "Lib/site-packages".

**`addsitepackages(known_paths, prefixes)` (L400-407)**: Adds all discovered site-packages directories to `sys.path` via `addsitedir()`.

### User Site-Packages Support

**`check_enableusersite()` (L253-275)**: Security check for user site directory inclusion. Returns None for security issues (uid/euid or gid/egid mismatch), False for explicit disabling, True for safe operation.

**`_getuserbase()` (L285-305)**: Platform-specific user base directory discovery:
- Windows: `%APPDATA%\Python` or `~\Python`  
- macOS Framework: `~/Library/{framework}/{version}`
- Unix: `~/.local`
- Returns None for platforms without home directories (Emscripten, VxWorks, WASI)

**`_get_path(userbase)` (L309-319)**: Constructs user site-packages path from user base, handling platform-specific layouts.

**`getusersitepackages()` (L335-350)**: Lazy initialization of `USER_SITE` global, disabling user site if no user base available.

### Virtual Environment Support

**`venv(known_paths)` (L508-560)**: Comprehensive virtual environment detection and configuration. Searches for `pyvenv.cfg` in executable directory and parent. Parses configuration for `include-system-site-packages` and `home` settings. Modifies global `PREFIXES` and `ENABLE_USER_SITE` based on configuration.

### Interactive Shell Enhancement

**`enablerlcompleter()` (L449-506)**: Sets up readline completion and history for interactive sessions. Registers `sys.__interactivehook__` that configures tab completion, reads initialization files, manages `.python_history` file with atexit cleanup.

**`setquit()`, `setcopyright()`, `sethelper()` (L409-447)**: Install interactive builtins (`quit`, `exit`, `copyright`, `credits`, `license`, `help`) using `_sitebuiltins` module.

### Customization Hooks

**`execsitecustomize()`, `execusercustomize()` (L563-600)**: Attempt to import and execute `sitecustomize` and `usercustomize` modules for site-wide and user-specific customization. Include error handling with optional verbose tracebacks.

### Main Initialization

**`main()` (L603-630)**: Primary initialization function called automatically unless `-S` flag used. Orchestrates: path deduplication, virtual environment setup, user site configuration, site-packages addition, interactive builtin setup, and customization hook execution.

**Module Execution (L634-635)**: Automatically calls `main()` unless `sys.flags.no_site` is set.

### Command-Line Interface

**`_script()` (L637-689)**: Provides command-line interface for inspecting site configuration. Supports `--user-base` and `--user-site` flags with specific exit codes indicating user site status.

### Architecture Notes
- Uses lazy initialization patterns for expensive operations
- Implements platform-specific path handling throughout
- Maintains backward compatibility with locale encoding fallback
- Includes security considerations for user site directories
- Comprehensive error handling prevents startup failures