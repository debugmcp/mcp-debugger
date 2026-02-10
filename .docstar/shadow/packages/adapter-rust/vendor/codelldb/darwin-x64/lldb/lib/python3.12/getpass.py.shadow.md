# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/getpass.py
@source-hash: e74fd445337ff503
@generated: 2026-02-09T18:08:11Z

## Purpose
Python standard library module for secure password input and username retrieval. Provides platform-specific implementations to disable terminal echo during password entry.

## Key Components

**GetPassWarning (L26)** - UserWarning subclass issued when echo cannot be disabled during password input.

**unix_getpass (L29-94)** - Unix/Linux password input implementation using termios to control terminal settings. Attempts /dev/tty first, falls back to stdin. Manages terminal state with context managers and ensures echo is restored.

**win_getpass (L97-117)** - Windows password input implementation using msvcrt.getwch() for character-by-character input without echo. Handles backspace and Ctrl+C interrupts.

**fallback_getpass (L120-126)** - Fallback when terminal control unavailable. Issues warning and uses normal input (password visible).

**_raw_input (L129-151)** - Low-level input helper handling Unicode encoding issues and readline operations. Used by other getpass functions.

**getuser (L154-169)** - Username retrieval from environment variables (LOGNAME, USER, LNAME, USERNAME) or password database via pwd module.

**Dynamic Function Binding (L172-185)** - Runtime selection of getpass implementation based on available modules (termios for Unix, msvcrt for Windows, fallback otherwise).

## Dependencies
- Standard library: contextlib, io, os, sys, warnings
- Platform-specific: termios (Unix), msvcrt (Windows), pwd (Unix username lookup)

## Architecture Notes
- Uses try/except cascade to detect platform capabilities
- Employs context managers for proper resource cleanup
- Graceful degradation when secure input unavailable
- Handles edge cases like Unicode encoding errors and interrupted input