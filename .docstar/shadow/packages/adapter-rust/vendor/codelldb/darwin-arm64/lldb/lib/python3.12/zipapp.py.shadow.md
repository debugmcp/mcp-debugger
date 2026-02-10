# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/zipapp.py
@source-hash: 56e098b62cef6c39
@generated: 2026-02-09T18:07:27Z

## Purpose and Responsibility
This file implements the Python `zipapp` module for creating and manipulating executable ZIP application archives. It provides utilities to package Python code into self-executing ZIP files with optional shebang lines for direct execution.

## Key Components

### Exception Classes
- `ZipAppError (L33-34)`: Custom exception class inheriting from ValueError for zipapp-specific errors

### Constants and Global Variables
- `MAIN_TEMPLATE (L17-21)`: UTF-8 encoded template for generating `__main__.py` files when using module:function entry points
- `shebang_encoding (L27-30)`: Platform-specific encoding for shebang lines (UTF-8 on Windows, filesystem encoding on Unix)

### Core Functions

#### Archive Creation and Manipulation
- `create_archive (L76-148)`: Main function for creating ZIP application archives from directories or copying existing archives. Handles shebang lines, entry points, compression, and file filtering. Supports both directory sources and existing archive copying.

#### Utility Functions
- `_maybe_open (L37-43)`: Context manager that handles both file paths and file-like objects uniformly
- `_write_file_prefix (L46-50)`: Writes shebang lines to archive files using appropriate encoding
- `_copy_archive (L53-73)`: Copies existing archives while optionally modifying shebang lines. Preserves executable permissions.
- `get_interpreter (L150-153)`: Extracts interpreter path from existing archive shebang lines

#### Command Line Interface
- `main (L156-202)`: CLI implementation using argparse, supports archive creation, copying, and info display
- Entry point check `(L205-206)`: Enables direct script execution

## Key Dependencies
- Standard library modules: `contextlib`, `os`, `pathlib`, `shutil`, `stat`, `sys`, `zipfile`, `argparse`

## Architecture Patterns
- Context manager pattern for consistent file handling (`_maybe_open`)
- Template-based code generation for entry point creation
- Platform-specific encoding handling for cross-platform compatibility
- Dual-mode operation: directory-to-archive creation vs archive-to-archive copying

## Critical Invariants
- Entry point format must follow "module:function" pattern with valid Python identifiers
- Cannot specify main function when source already has `__main__.py`
- Archives must have either existing `__main__.py` or specified entry point
- In-place archive editing is prohibited
- Shebang encoding varies by platform (Windows: UTF-8, Unix: filesystem encoding)