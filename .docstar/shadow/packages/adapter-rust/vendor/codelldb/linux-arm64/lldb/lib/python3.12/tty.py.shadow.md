# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/tty.py
@source-hash: 1ab5e5e047130b31
@generated: 2026-02-09T18:09:12Z

**Terminal utilities for configuring termios modes**

This module provides utilities for manipulating terminal I/O settings, specifically for putting terminals into raw and cbreak modes. It's a wrapper around the lower-level termios module.

**Key Functions:**
- `cfmakeraw(mode)` (L18-44): Configures a termios mode structure for raw terminal operation by clearing all input processing flags, disabling output post-processing, setting 8-bit character size, and disabling echo/canonical mode
- `cfmakecbreak(mode)` (L46-57): Configures a termios mode for cbreak operation (minimal processing) by disabling echo and canonical input while preserving other processing
- `setraw(fd, when=TCSAFLUSH)` (L59-65): High-level function to put a file descriptor's terminal into raw mode, returns original mode for restoration
- `setcbreak(fd, when=TCSAFLUSH)` (L67-73): High-level function to put a file descriptor's terminal into cbreak mode, returns original mode for restoration

**Dependencies:**
- `termios` module: Imported with wildcard (L5) for low-level terminal control functions and constants

**Constants (L10-16):**
Indices for termios attribute list manipulation:
- IFLAG (0): Input mode flags
- OFLAG (1): Output mode flags  
- CFLAG (2): Control mode flags
- LFLAG (3): Local mode flags
- ISPEED (4): Input baud rate
- OSPEED (5): Output baud rate
- CC (6): Control characters array

**Key Behaviors:**
- Raw mode disables all terminal processing (input flags, output post-processing, echo, canonical mode)
- Cbreak mode provides minimal processing (only disables echo and canonical input)
- Both modes set non-canonical input with MIN=1, TIME=0 for immediate character availability
- Functions return original terminal state to allow restoration
- Uses TCSAFLUSH by default to flush I/O queues when applying changes