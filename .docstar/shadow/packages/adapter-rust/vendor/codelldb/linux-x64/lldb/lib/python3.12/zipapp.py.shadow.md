# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/zipapp.py
@source-hash: 56e098b62cef6c39
@generated: 2026-02-09T18:10:13Z

## Python zipapp Module

**Primary Purpose**: Standard library module for creating and managing executable Python archive (.pyz) files that can be run directly by the Python interpreter.

### Key Components

**Exception Class:**
- `ZipAppError(ValueError)` (L33-34): Custom exception for zipapp-related errors

**Core Functions:**

- `create_archive()` (L76-148): Main function for creating Python archives
  - Creates executable .pyz files from source directories or existing archives
  - Handles shebang line insertion for cross-platform execution
  - Supports entry point specification via `main` parameter (module:function format)
  - Validates entry points and __main__.py existence
  - Optional file filtering and compression support

- `get_interpreter()` (L150-154): Extracts interpreter path from archive shebang line
  - Returns None if no shebang present
  - Handles platform-specific encoding (UTF-8 on Windows, filesystem encoding on Unix)

- `main()` (L156-203): Command-line interface implementation
  - Argument parsing with argparse
  - Supports --info flag for interpreter inspection
  - Prevents in-place archive editing
  - Validates source/output relationships

**Helper Functions:**

- `_maybe_open()` (L37-44): Context manager that handles both file paths and file objects
- `_write_file_prefix()` (L46-51): Writes shebang line with platform-appropriate encoding
- `_copy_archive()` (L53-74): Copies existing archive while modifying shebang line
  - Strips existing shebang and replaces with new interpreter
  - Sets executable permissions on Unix systems

### Architecture Patterns

**Template System:**
- `MAIN_TEMPLATE` (L17-21): UTF-8 encoded template for generated __main__.py files
- Supports module:function entry point format

**Platform Handling:**
- Encoding selection based on `sys.platform` (L27-30)
- Windows uses UTF-8, Unix uses filesystem encoding
- Executable permission handling via `stat.S_IEXEC`

**Input Validation:**
- Entry point format validation (module:function with valid Python identifiers)
- Source existence and __main__.py conflict detection
- Archive modification safety checks

### Dependencies
- Standard library: `contextlib`, `os`, `pathlib`, `shutil`, `stat`, `sys`, `zipfile`, `argparse`
- Cross-platform file handling and ZIP archive management

### Key Constraints
- Entry points must follow "module:function" format with valid Python identifiers
- Cannot specify main function when source has existing __main__.py
- Archives require either existing __main__.py or specified entry point
- In-place archive editing is prohibited
- Shebang lines limited by platform encoding capabilities