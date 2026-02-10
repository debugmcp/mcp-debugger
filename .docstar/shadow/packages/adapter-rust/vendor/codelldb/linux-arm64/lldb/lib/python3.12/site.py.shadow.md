# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/site.py
@source-hash: 339ac97324244537
@generated: 2026-02-09T18:09:14Z

## Python Site Module Configuration

This is Python's standard `site.py` module responsible for initializing the Python module search path (`sys.path`) during interpreter startup. Automatically imported unless `-S` flag is used.

### Primary Purpose
- Configure `sys.path` with site-packages directories (system, user, virtual environment)
- Process `.pth` files to extend module search paths
- Set up interactive Python environment (quit, help, copyright builtins)
- Handle virtual environment detection and configuration
- Execute site customization modules

### Key Global Variables
- `PREFIXES` (L80): List of prefix directories for site-packages discovery
- `ENABLE_USER_SITE` (L83): Controls user site-packages inclusion
- `USER_SITE` (L88): User-specific site-packages directory path
- `USER_BASE` (L89): User base directory for Python installations

### Core Path Management Functions

**`removeduppaths()` (L129-145)**: Removes duplicate entries from `sys.path` and converts to absolute paths. Returns set of known paths for duplicate detection.

**`makepath()` (L97-103)**: Creates absolute, normalized paths from path components. Returns tuple of (absolute_path, normalized_case_path).

**`addpackage()` (L161-224)**: Processes individual `.pth` files within site directories. Handles both path additions and `import` statement execution. Includes UTF-8 decoding with locale fallback.

**`addsitedir()` (L227-250)**: Adds site directory to `sys.path` and processes all `.pth` files within it. Core function for site-packages integration.

### Site-Packages Discovery

**`getsitepackages()` (L367-398)**: Returns list of all global site-packages directories based on platform and prefixes. Handles Unix (`lib/python3.x/site-packages`) vs Windows (`Lib/site-packages`) conventions.

**`addsitepackages()` (L400-407)**: Adds all discovered site-packages directories to `sys.path`.

### User Site-Packages Support

**`getuserbase()` (L322-332)**: Determines user base directory, platform-specific:
- Windows: `%APPDATA%/Python`
- macOS Framework: `~/Library/Python/3.x`
- Unix: `~/.local`

**`getusersitepackages()` (L335-350)**: Returns user site-packages path using `_get_path()` helper.

**`check_enableusersite()` (L253-275)**: Security checks for user site enablement (UID/GID validation).

**`addusersitepackages()` (L352-365)**: Adds user site-packages if enabled and exists.

### Virtual Environment Support

**`venv()` (L508-560)**: Detects and configures virtual environments by:
- Looking for `pyvenv.cfg` near executable
- Parsing configuration (include-system-site-packages, home)
- Modifying `PREFIXES` and `ENABLE_USER_SITE` accordingly
- Setting `sys.prefix` and `sys.exec_prefix`

### Interactive Environment Setup

**`setquit()` (L409-422)**: Defines `quit` and `exit` builtins with platform-specific EOF hints.

**`setcopyright()` (L425-443)**: Sets `copyright`, `credits`, and `license` builtins using `_sitebuiltins._Printer`.

**`sethelper()` (L446-447)**: Sets `help` builtin.

**`enablerlcompleter()` (L449-506)**: Configures readline tab completion and history (`~/.python_history`) via `sys.__interactivehook__`.

### Customization Hooks

**`execsitecustomize()` (L563-580)**: Imports and executes `sitecustomize` module if available, with error handling.

**`execusercustomize()` (L583-600)**: Imports and executes `usercustomize` module if available.

### Main Initialization

**`main()` (L603-630)**: Primary initialization function called automatically:
1. Remove duplicate paths and make absolute
2. Handle virtual environments
3. Add user site-packages (if enabled)
4. Add system site-packages
5. Set up interactive builtins
6. Enable readline completion
7. Execute customization modules

**Script Mode** (L637-692): Provides command-line interface for querying site configuration (`--user-base`, `--user-site`).

### Dependencies
- Standard library: `sys`, `os`, `builtins`, `stat`, `io`
- Internal: `_sitebuiltins` for interactive helpers

### Architecture Notes
- Optimized startup by copying minimal parts of `sysconfig` (L278-282)
- Comprehensive error handling for missing directories/files
- Platform-aware path construction
- Security-conscious user site validation