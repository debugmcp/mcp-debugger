# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/getpass.py
@source-hash: e74fd445337ff503
@generated: 2026-02-09T18:09:39Z

## Purpose and Responsibility

Cross-platform password input utility module that provides secure password prompting with echo disabled and username retrieval functionality. Implements platform-specific strategies for terminal control on Unix/Linux and Windows systems.

## Key Components

### Core Functions

- **`getpass` (L172-185)**: Main entry point dynamically bound to platform-specific implementation based on available terminal control capabilities
- **`unix_getpass` (L29-94)**: Unix/Linux password input using termios for echo control, with fallback handling for terminal access failures
- **`win_getpass` (L97-117)**: Windows password input using msvcrt.getwch() for character-by-character input without echo
- **`fallback_getpass` (L120-126)**: Fallback implementation when terminal echo cannot be disabled, issues warnings to user
- **`getuser` (L154-169)**: Retrieves current username from environment variables or password database

### Utility Functions

- **`_raw_input` (L129-151)**: Internal input helper with Unicode encoding error handling and prompt display
- **`GetPassWarning` (L26)**: Custom warning class for echo control failures

## Architecture and Dependencies

**Platform Detection Strategy**: Module uses import-based capability detection (L172-185) to bind appropriate implementation:
1. Attempts termios import for Unix systems
2. Falls back to msvcrt for Windows
3. Uses fallback_getpass as last resort

**Key Dependencies**:
- `termios`: Unix terminal control (conditional import)
- `msvcrt`: Windows console I/O (conditional import) 
- `contextlib`: Resource management for file handles
- `pwd`: Password database access for username lookup

## Critical Patterns

**Terminal Control Flow**: unix_getpass implements robust error handling with nested try/except blocks and contextlib.ExitStack for resource cleanup. Attempts direct TTY access (/dev/tty) before falling back to stdin.

**Echo Disabling**: Uses termios.ECHO flag manipulation (L71) with proper restoration in finally blocks (L79) to ensure terminal state recovery.

**Character Processing**: win_getpass handles special characters including Ctrl+C (KeyboardInterrupt), backspace, and line endings in real-time input loop.

## Important Constraints

- Always restores terminal settings before returning, even on exceptions
- Warns users when echo cannot be disabled for security transparency
- Handles Unicode encoding errors gracefully in prompt display
- Cross-platform username detection with multiple environment variable fallbacks