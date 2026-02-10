# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/zipapp.py
@source-hash: 56e098b62cef6c39
@generated: 2026-02-09T18:10:17Z

## Python Zipapp Archive Creation Utility

**Primary Purpose:** Creates executable Python ZIP archives (.pyz files) with optional shebang lines and entry points, supporting both directory-to-archive and archive-to-archive operations.

### Key Classes and Functions

**ZipAppError (L33-34)** - Custom exception class inheriting from ValueError for zipapp-specific errors.

**create_archive() (L76-148)** - Core function that creates executable ZIP archives from source directories or copies existing archives. Handles:
- Directory sources: Recursively packages all files with optional filtering
- Archive sources: Copies existing archives with modified shebang lines
- Entry point validation and __main__.py generation using MAIN_TEMPLATE
- Shebang line injection and executable permissions setting

**get_interpreter() (L150-153)** - Extracts interpreter path from existing archive shebang lines.

**main() (L156-203)** - Command-line interface using argparse with options for output path, interpreter, main function, compression, and info display.

### Key Utility Functions

**_maybe_open() (L37-43)** - Context manager that handles both file paths and file-like objects uniformly.

**_write_file_prefix() (L46-50)** - Writes shebang lines with platform-specific encoding (UTF-8 on Windows, filesystem encoding on Unix).

**_copy_archive() (L53-73)** - Copies archives while replacing shebang lines, preserving executable permissions.

### Important Constants and Dependencies

**MAIN_TEMPLATE (L17-21)** - UTF-8 template for generated __main__.py files when using module:function entry points.

**shebang_encoding (L27-30)** - Platform-specific encoding selection for shebang lines.

**Dependencies:** contextlib, os, pathlib, shutil, stat, sys, zipfile, argparse (imported in main)

### Architecture Patterns

- Context manager pattern for file handling (_maybe_open)
- Template-based code generation for entry points
- Platform-aware encoding handling for cross-platform compatibility
- Unified interface for file paths vs file-like objects
- Validation-heavy approach with descriptive error messages

### Critical Constraints

- Entry points must follow "module:function" format with valid Python identifiers
- Cannot specify main function for sources with existing __main__.py
- In-place archive editing is not supported
- Archive sources cannot have their main function changed during copying
- Executable permissions only set for file path targets, not file-like objects