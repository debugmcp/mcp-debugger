# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/zipapp.py
@source-hash: 56e098b62cef6c39
@generated: 2026-02-09T18:14:19Z

**Primary Purpose**: Python zipapp module implementation for creating executable ZIP application archives with optional shebang lines and entry points.

**Core Functionality**:
- Creates executable ZIP archives from directories or copies existing archives
- Manages shebang line handling for cross-platform execution
- Provides command-line interface for archive creation and inspection

**Key Classes & Exceptions**:
- `ZipAppError` (L33-34): Custom exception class inheriting from ValueError for zipapp-specific errors

**Primary Functions**:
- `create_archive()` (L76-148): Main function for creating ZIP application archives
  - Handles both directory sources and existing archive copying
  - Validates entry points and manages __main__.py creation
  - Supports compression, filtering, and custom interpreters
- `get_interpreter()` (L150-154): Extracts interpreter path from archive shebang line
- `main()` (L156-203): Command-line interface implementation using argparse
- `_copy_archive()` (L53-74): Internal function for copying archives with shebang modification
- `_write_file_prefix()` (L46-51): Internal function for writing shebang lines
- `_maybe_open()` (L37-44): Context manager for handling both file paths and file-like objects

**Key Constants & Variables**:
- `MAIN_TEMPLATE` (L17-21): UTF-8 encoded template for generated __main__.py files
- `shebang_encoding` (L27-30): Platform-specific encoding for shebang lines (UTF-8 on Windows, filesystem encoding on Unix)

**Dependencies**:
- Standard library modules: contextlib, os, pathlib, shutil, stat, sys, zipfile, argparse
- Uses pathlib.Path for modern path handling
- Leverages zipfile module for archive creation and manipulation

**Architectural Patterns**:
- Context manager pattern for safe file handling
- Template-based code generation for entry points
- Platform-aware encoding handling
- Separation of concerns between archive creation and CLI interface

**Critical Constraints**:
- Entry point format must be "module:function" with valid Python identifiers
- Cannot specify main function when source already has __main__.py
- In-place archive editing is prohibited
- Source directory must exist and have either __main__.py or specified entry point