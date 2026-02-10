# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/getpass.py
@source-hash: e74fd445337ff503
@generated: 2026-02-09T18:12:48Z

## Purpose
Password input utility module providing secure password prompting with echo disabled across different platforms. Contains platform-specific implementations and a fallback mechanism for when secure input is unavailable.

## Key Functions

### Core Password Input Functions
- `unix_getpass(prompt, stream)` (L29-94): Unix/Linux implementation using termios to disable echo. Attempts TTY access first, falls back to stdin control. Handles terminal restoration and proper cleanup.
- `win_getpass(prompt, stream)` (L97-117): Windows implementation using msvcrt.getwch() for character-by-character input with echo disabled. Handles backspace and special characters.
- `fallback_getpass(prompt, stream)` (L120-126): Last resort implementation that issues warning about visible password input. Used when terminal echo cannot be controlled.

### Helper Functions  
- `_raw_input(prompt, stream, input)` (L129-151): Low-level input function with Unicode encoding handling and EOF detection. Used by fallback mechanism.
- `getuser()` (L154-169): Retrieves current username from environment variables (LOGNAME, USER, LNAME, USERNAME) or password database via pwd module.

## Architecture & Platform Detection
Platform-specific function binding occurs at module load time (L172-185):
- Tries to import `termios` → binds `getpass = unix_getpass`
- Falls back to `msvcrt` → binds `getpass = win_getpass` 
- Final fallback → binds `getpass = fallback_getpass`

## Key Classes
- `GetPassWarning(UserWarning)` (L26): Custom warning class for when secure password input fails

## Dependencies
- Standard library: `contextlib`, `io`, `os`, `sys`, `warnings`
- Platform-specific: `termios` (Unix), `msvcrt` (Windows), `pwd` (Unix username lookup)

## Critical Behaviors
- Terminal state is always restored after password input via try/finally blocks
- Unicode encoding errors are handled gracefully with replacement characters
- File descriptor management uses context managers for proper cleanup
- Keyboard interrupt (Ctrl+C) is properly handled in Windows implementation