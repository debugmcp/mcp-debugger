# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/zipapp.py
@source-hash: 56e098b62cef6c39
@generated: 2026-02-09T18:08:14Z

## Purpose
Implements Python's `zipapp` module for creating executable ZIP archives (PYZ files) with optional shebang lines. Provides both programmatic API and command-line interface for packaging Python applications into self-contained executable archives.

## Key Components

### Exception Class
- **ZipAppError (L33-34)**: Custom ValueError subclass for zipapp-specific errors

### Core Functions
- **create_archive (L76-148)**: Primary function for creating executable archives from directories or copying existing archives. Handles shebang injection, entry point validation, and ZIP compression. Supports both directory sources and file-like objects.
- **get_interpreter (L150-153)**: Extracts shebang interpreter path from existing archive by reading first two bytes and subsequent line
- **main (L156-203)**: Command-line interface using argparse. Handles --info flag for archive inspection and delegates to create_archive for creation/copying

### Helper Functions  
- **_maybe_open (L37-43)**: Context manager that handles both file paths and file-like objects uniformly
- **_write_file_prefix (L46-50)**: Writes shebang line to file using platform-appropriate encoding
- **_copy_archive (L53-74)**: Copies existing archive while replacing shebang line. Strips original shebang if present and makes output executable

### Templates & Constants
- **MAIN_TEMPLATE (L17-21)**: UTF-8 template for generating __main__.py when using module:function entry points
- **shebang_encoding (L27-30)**: Platform-specific encoding (UTF-8 on Windows, filesystem encoding on Unix)

## Key Dependencies
- Standard library: `contextlib`, `os`, `pathlib`, `shutil`, `stat`, `sys`, `zipfile`, `argparse`

## Architecture Patterns
- Context manager pattern for consistent file handling across path strings and file objects
- Template-based code generation for entry point creation
- Platform-aware encoding handling for cross-platform compatibility
- Validation of module:function entry point format using string parsing and identifier checks

## Critical Invariants
- Archives must have either existing __main__.py or specified main entry point, never both
- Shebang lines are platform-encoded (UTF-8 on Windows, filesystem encoding elsewhere)
- Generated __main__.py always uses UTF-8 encoding with explicit coding cookie
- Executable permissions set only for file-path targets with interpreters, not file-like objects