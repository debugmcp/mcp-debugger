# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/glob.py
@source-hash: c9e5f9ae0752660e
@generated: 2026-02-09T18:09:41Z

## Purpose
Python filename globbing utility providing shell-style pathname pattern matching with wildcards. Implements the standard library's glob functionality with support for recursive matching, hidden files, and file descriptor-based operations.

## Public API Functions

- **`glob()` (L13-29)**: Main entry point returning list of paths matching a pattern. Supports `root_dir`, `dir_fd`, `recursive`, and `include_hidden` parameters.
- **`iglob()` (L31-58)**: Iterator version of glob, more memory-efficient for large result sets. Handles security auditing via `sys.audit()` calls.
- **`escape()` (L239-249)**: Escapes special glob characters by wrapping `*?[` in square brackets to treat them as literals.

## Core Implementation Functions

- **`_iglob()` (L60-99)**: Recursive core glob implementation handling pattern decomposition, directory traversal, and magic character detection.
- **`_glob0()` (L111-120)**: Handles literal basename matching (no wildcards).
- **`_glob1()` (L105-109)**: Non-recursive pattern matching within a single directory using `fnmatch.filter()`.
- **`_glob2()` (L133-138)**: Handles recursive `**` patterns, yielding all paths within directory trees.

## Directory Operations

- **`_iterdir()` (L142-174)**: Low-level directory iteration with file descriptor support, handles encoding and directory-only filtering.
- **`_listdir()` (L176-178)**: Wrapper converting iterator to list.
- **`_rlistdir()` (L181-189)**: Recursive directory listing with hidden file filtering.

## Utility Functions

- **`_lexists()` (L192-201)** & **`_isdir()` (L203-212)**: File system checks with optional `dir_fd` support.
- **`_join()` (L214-218)**: Optimized path joining handling empty components.
- **`has_magic()` (L223-228)**: Detects glob metacharacters using regex patterns (L220-221).
- **`_ishidden()` (L230-231)** & **`_isrecursive()` (L233-237)**: Pattern classification helpers.

## Key Dependencies
- `fnmatch`: Pattern matching engine
- `os`: File system operations and path handling
- `stat`: File type checking
- `re`: Regex for magic character detection

## Architecture Notes
- Recursive descent parser splitting paths into directory/basename components
- Supports both string and bytes paths with appropriate encoding handling
- File descriptor-based operations enable relative path resolution from specific directories
- Hidden file handling controlled by `include_hidden` parameter (defaults to excluding dot-files)
- Security auditing integrated via `sys.audit()` calls for compliance monitoring

## Global Constants
- `__all__` (L11): Public API exports
- `_dir_open_flags` (L252): File descriptor flags for directory operations
- `magic_check` patterns (L220-221): Compiled regex for detecting wildcards