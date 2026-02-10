# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/tty.py
@source-hash: 1ab5e5e047130b31
@generated: 2026-02-09T18:07:24Z

## Terminal Mode Configuration Utilities

This module provides high-level functions for configuring terminal behavior on Unix-like systems by manipulating termios settings. Part of the Python standard library's terminal control interface.

### Core Functionality

**Terminal Mode Configuration Functions:**
- `cfmakeraw(mode)` (L18-44): Configures termios mode for raw terminal input by clearing all POSIX.1-2017 flags for input processing, output post-processing, parity, and local modes. Sets non-canonical input with MIN=1, TIME=0.
- `cfmakecbreak(mode)` (L46-57): Configures termios mode for cbreak input by disabling echo and canonical input while preserving other terminal features. Also sets MIN=1, TIME=0 for immediate character availability.
- `setraw(fd, when=TCSAFLUSH)` (L59-65): Convenience function that gets current terminal attributes, applies raw mode configuration, and sets the new mode. Returns original mode for restoration.
- `setcbreak(fd, when=TCSAFLUSH)` (L67-73): Convenience function that gets current terminal attributes, applies cbreak mode configuration, and sets the new mode. Returns original mode for restoration.

### Dependencies

- `termios` module: Provides low-level terminal control functions (`tcgetattr`, `tcsetattr`) and constants (flags, indices)

### Constants

**Termios Array Indices (L10-16):**
- `IFLAG`, `OFLAG`, `CFLAG`, `LFLAG`: Control different aspects of terminal behavior
- `ISPEED`, `OSPEED`: Input/output baud rates  
- `CC`: Control characters array

### Key Patterns

- **Mode Preservation**: Both `setraw` and `setcbreak` return original terminal mode to enable restoration
- **In-place Modification**: Mode configuration functions modify the passed termios list directly
- **POSIX Compliance**: Raw mode implementation follows POSIX.1-2017 specifications for terminal interface
- **Non-canonical Input**: Both modes configure immediate character availability without line buffering

### Usage Context

Typically used by terminal applications, debuggers, or interactive programs that need direct key input without line editing or echo. The `when` parameter controls when terminal changes take effect (flush behavior).