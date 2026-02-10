# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/site.py
@source-hash: 339ac97324244537
@generated: 2026-02-09T18:10:07Z

## Python Site Module - Path Configuration and Initialization

Core responsibility: Automatically configure Python's module search path (`sys.path`) during interpreter startup by adding site-packages directories, processing `.pth` files, and setting up interactive environment features.

### Key Global Variables
- `PREFIXES` (L80): List of base prefixes for site-packages directories (`[sys.prefix, sys.exec_prefix]`)
- `ENABLE_USER_SITE` (L83): Controls per-user site-packages inclusion (None/True/False)
- `USER_SITE`, `USER_BASE` (L88-89): Cached user-specific directory paths

### Core Path Management Functions

**`removeduppaths()` (L129-145)**: Deduplicates and absolutizes `sys.path` entries, returns set of known paths for tracking.

**`addsitedir(sitedir, known_paths)` (L227-250)**: Adds directory to `sys.path` and processes all `.pth` files within it. Calls `addpackage()` for each `.pth` file found.

**`addpackage(sitedir, name, known_paths)` (L161-224)**: Processes individual `.pth` files - adds path entries to `sys.path` and executes lines starting with "import". Handles UTF-8 decoding with locale fallback (L187-197).

**`getsitepackages(prefixes)` (L367-398)**: Returns list of all global site-packages directories based on platform-specific path conventions.

### User Site Management

**`getuserbase()` (L322-332)**: Returns user base directory, platform-aware (Windows: `%APPDATA%\Python`, macOS framework: `~/Library/Python`, Unix: `~/.local`).

**`getusersitepackages()` (L335-350)**: Returns user-specific site-packages path using `_get_path()` helper (L309-319).

**`addusersitepackages(known_paths)` (L352-365)**: Adds user site-packages to `sys.path` if enabled and directory exists.

**`check_enableusersite()` (L253-275)**: Security check for user site enablement - verifies process UID/GID matches effective UID/GID.

### Virtual Environment Support

**`venv(known_paths)` (L508-560)**: Detects and configures virtual environment by searching for `pyvenv.cfg` file. Modifies `sys.prefix`, `sys.exec_prefix`, and `PREFIXES` based on configuration.

### Interactive Features Setup

**`setquit()` (L409-422)**: Installs `quit`/`exit` builtins using `_sitebuiltins.Quitter`.

**`setcopyright()` (L425-443)**: Installs `copyright`, `credits`, `license` builtins using `_sitebuiltins._Printer`.

**`enablerlcompleter()` (L449-506)**: Sets up readline tab completion and history file (`~/.python_history`) via `sys.__interactivehook__`.

### Customization Hooks

**`execsitecustomize()` (L563-580)**: Attempts to import `sitecustomize` module for site-specific customizations.

**`execusercustomize()` (L583-600)**: Attempts to import `usercustomize` module for user-specific customizations.

### Main Entry Point

**`main()` (L603-630)**: Primary initialization function called automatically on import (unless `-S` flag used). Orchestrates: path deduplication, virtual environment detection, user site setup, global site-packages addition, and interactive features installation.

### Utility Functions

**`makepath(*paths)` (L97-103)**: Joins and normalizes paths, returns (absolute_path, case_normalized_path) tuple.

**`abs_paths()` (L106-126)**: Converts all module `__file__` and `__cached__` attributes to absolute paths.

**`_trace(message)` (L92-94)**: Conditional debug output to stderr when `sys.flags.verbose` is set.

### Architecture Notes

- Module uses performance-optimized copies of sysconfig functions (L278-282) to avoid import overhead
- Platform-specific path handling for Windows, macOS, and Unix-like systems
- Security considerations for user site-packages in privilege-escalated contexts
- Automatic execution on import unless `-S` interpreter flag is used (L634-635)
- Command-line interface available via `_script()` function (L637-689)