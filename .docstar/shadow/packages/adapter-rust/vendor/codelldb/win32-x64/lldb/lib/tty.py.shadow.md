# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/tty.py
@source-hash: 1ab5e5e047130b31
@generated: 2026-02-09T18:14:19Z

## Purpose
Terminal control utilities for configuring terminal modes, specifically implementing raw and cbreak modes for terminal I/O operations. Part of LLDB's Python environment for low-level terminal manipulation.

## Key Functions

### cfmakeraw(mode) (L18-44)
Core function that configures a termios mode list for raw terminal operation:
- Clears all POSIX.1-2017 input mode flags (IGNBRK, BRKINT, etc.)
- Disables output post-processing (OPOST)
- Sets 8-bit character size with no parity
- Disables echo, canonical input, and signal processing
- Configures non-canonical mode with MIN=1, TIME=0 (blocking read for 1 byte)

### cfmakecbreak(mode) (L46-57)
Lighter terminal configuration for cbreak mode:
- Disables echo and canonical input only
- Preserves other terminal settings
- Sets same non-canonical timing as raw mode

### setraw(fd, when=TCSAFLUSH) (L59-65)
High-level interface to put a file descriptor into raw mode:
- Gets current terminal attributes
- Applies raw mode configuration
- Sets new attributes with specified timing
- Returns original mode for restoration

### setcbreak(fd, when=TCSAFLUSH) (L67-73)
High-level interface for cbreak mode with same pattern as setraw.

## Constants
- Termios array indices (L10-16): IFLAG, OFLAG, CFLAG, LFLAG, ISPEED, OSPEED, CC
- Exported interface (L7): cfmakeraw, cfmakecbreak, setraw, setcbreak

## Dependencies
- `termios` module: Provides all terminal control constants and functions (tcgetattr, tcsetattr)

## Architecture Notes
- Follows POSIX.1-2017 terminal interface specification
- Uses list copying to avoid modifying original termios structures
- Implements both configuration functions (cfmake*) and application functions (set*)
- Standard restoration pattern: functions return original mode for cleanup