# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/site.py
@source-hash: 339ac97324244537
@generated: 2026-02-09T18:08:07Z

**Primary Purpose:**
Python's core site module that automatically configures sys.path with site-specific directories during interpreter startup. Handles system-wide and user-specific site-packages, virtual environments, .pth files, and interactive session setup.

**Key Global Variables:**
- `PREFIXES` (L80): List of base directories for site-packages (sys.prefix, sys.exec_prefix)
- `ENABLE_USER_SITE` (L83): Controls user site-packages inclusion (None/False/True)
- `USER_SITE` (L88): Path to user's site-packages directory
- `USER_BASE` (L89): User's base directory for Python data

**Core Path Management Functions:**
- `makepath(*paths)` (L97-103): Creates absolute, normalized paths from components
- `removeduppaths()` (L129-145): Deduplicates sys.path entries and makes them absolute
- `_init_pathinfo()` (L148-158): Returns set of existing filesystem items from sys.path
- `abs_paths()` (L106-126): Converts module __file__ and __cached__ attributes to absolute paths

**Site Directory Processing:**
- `addpackage(sitedir, name, known_paths)` (L161-224): Processes individual .pth files within site-packages
  - Handles UTF-8/locale encoding fallback (L188-197)
  - Executes lines starting with "import " (L205-206)
  - Adds valid directory paths to sys.path (L210-212)
- `addsitedir(sitedir, known_paths)` (L227-250): Adds site directory and processes all .pth files within it

**Site-Packages Discovery:**
- `getsitepackages(prefixes)` (L367-398): Returns list of global site-packages directories
  - Platform-specific path construction (Unix: lib/pythonX.Y/site-packages, Windows: Lib/site-packages)
- `addsitepackages(known_paths, prefixes)` (L400-407): Adds all global site-packages to sys.path

**User Site-Packages:**
- `_getuserbase()` (L285-305): Platform-specific user base directory discovery
- `_get_path(userbase)` (L309-319): Constructs user site-packages path from base
- `getuserbase()` (L322-332): Public interface to get user base directory
- `getusersitepackages()` (L335-350): Public interface to get user site-packages path
- `addusersitepackages(known_paths)` (L352-365): Adds user site-packages to sys.path
- `check_enableusersite()` (L253-275): Security checks for user site directory inclusion

**Virtual Environment Support:**
- `venv(known_paths)` (L508-560): Detects and configures virtual environments
  - Searches for pyvenv.cfg configuration file (L520-529)
  - Modifies PREFIXES and ENABLE_USER_SITE based on configuration (L554-558)

**Interactive Session Setup:**
- `setquit()` (L409-422): Defines quit/exit builtins
- `setcopyright()` (L425-443): Sets copyright/credits/license builtins
- `sethelper()` (L446-447): Sets help builtin
- `enablerlcompleter()` (L449-506): Configures readline completion and history

**Customization Hooks:**
- `execsitecustomize()` (L563-581): Imports and executes sitecustomize module
- `execusercustomize()` (L583-601): Imports and executes usercustomize module

**Main Execution:**
- `main()` (L603-630): Primary initialization function called on module import
  - Orchestrates all site initialization steps
  - Only runs if not started with -S flag (L634-635)

**Utility Functions:**
- `_trace(message)` (L92-94): Debug output when verbose flag is set
- `_script()` (L637-689): Command-line interface for site information

**Architecture Notes:**
- Module automatically imports during Python startup unless -S flag is used
- Implements security checks for user site directories (uid/gid validation)
- Handles platform differences (Windows, macOS, Unix) in path construction
- Supports both system-wide and per-user package installation
- Integrates with virtual environment detection and configuration