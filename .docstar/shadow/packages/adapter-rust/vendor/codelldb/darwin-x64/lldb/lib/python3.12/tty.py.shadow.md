# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/tty.py
@source-hash: 1ab5e5e047130b31
@generated: 2026-02-09T18:08:08Z

## Purpose
Python standard library module providing terminal mode utilities for setting raw and cbreak modes on terminal file descriptors. Part of the LLDB debugger's Python environment within the Rust adapter package.

## Key Constants
- **Termios indices (L10-16)**: Define positional constants for termios structure array access
  - `IFLAG=0`, `OFLAG=1`, `CFLAG=2`, `LFLAG=3`, `ISPEED=4`, `OSPEED=5`, `CC=6`

## Core Functions

### Terminal Mode Configuration
- **`cfmakeraw(mode)` (L18-44)**: Configures termios mode for raw terminal operation
  - Clears all POSIX input flags (IGNBRK, BRKINT, etc.)
  - Disables output post-processing (`OPOST`)
  - Sets 8-bit character size, disables parity
  - Clears local mode flags (ECHO, ICANON, etc.)
  - Sets non-canonical mode with MIN=1, TIME=0

- **`cfmakecbreak(mode)` (L46-57)**: Configures termios mode for cbreak operation
  - Disables echo and canonical input only
  - Preserves other terminal settings
  - Sets non-canonical mode with MIN=1, TIME=0

### Terminal Control Functions  
- **`setraw(fd, when=TCSAFLUSH)` (L59-65)**: Applies raw mode to file descriptor
  - Gets current terminal attributes, applies `cfmakeraw()`, sets new attributes
  - Returns original mode for restoration

- **`setcbreak(fd, when=TCSAFLUSH)` (L67-73)**: Applies cbreak mode to file descriptor
  - Gets current terminal attributes, applies `cfmakecbreak()`, sets new attributes  
  - Returns original mode for restoration

## Dependencies
- **`termios` module**: Imports all terminal control constants and functions via wildcard import (L5)

## Architecture Notes
- Functions modify termios mode arrays in-place using bitwise operations
- Both mode-setting functions return original terminal state for cleanup
- Uses POSIX.1-2017 terminal interface standards
- Raw mode provides completely unprocessed input/output
- Cbreak mode provides character-at-a-time input while preserving some processing