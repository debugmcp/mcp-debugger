# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/getpass.py
@source-hash: e74fd445337ff503
@generated: 2026-02-09T18:08:41Z

**Primary Purpose**: Cross-platform password input and username retrieval utilities for Python applications. Provides secure password prompting with echo disabled across Unix/Linux, Windows, and fallback systems.

**Key Functions and Classes**:

- **GetPassWarning (L26)**: UserWarning subclass raised when password echoing cannot be disabled
- **unix_getpass(prompt, stream) (L29-94)**: Unix/Linux password input using termios to disable echo. Attempts /dev/tty first, falls back to stdin, handles terminal control failures gracefully
- **win_getpass(prompt, stream) (L97-117)**: Windows password input using msvcrt.getwch() for character-by-character input without echo. Handles backspace and keyboard interrupts
- **fallback_getpass(prompt, stream) (L120-126)**: Last resort password input when terminal control unavailable. Issues warning about potential password echoing
- **_raw_input(prompt, stream, input) (L129-151)**: Raw input helper with Unicode encoding error handling. Returns input line with newline stripped
- **getuser() (L154-169)**: Username retrieval from environment variables (LOGNAME, USER, LNAME, USERNAME) or password database via pwd module

**Architecture and Dependencies**:
- **Platform Detection (L172-185)**: Dynamic function binding based on available modules:
  - termios available → getpass = unix_getpass
  - msvcrt available → getpass = win_getpass  
  - neither available → getpass = fallback_getpass
- **Core Dependencies**: contextlib, io, os, sys, warnings
- **Platform Dependencies**: termios (Unix), msvcrt (Windows), pwd (Unix username lookup)

**Critical Patterns**:
- **Graceful Degradation**: Multiple fallback layers from secure tty control to warning-based plain input
- **Resource Management**: Uses contextlib.ExitStack for proper file descriptor cleanup
- **Terminal State Preservation**: Always restores original terminal settings via try/finally blocks
- **Cross-Platform Compatibility**: Runtime platform detection with appropriate implementation selection

**Security Considerations**:
- Disables terminal echo to prevent password visibility
- Warns users when secure input unavailable
- Handles keyboard interrupts appropriately in Windows implementation